"""Fill MONARCH_RAW.ADS.DAILY_AD_SUMMARY_WINDOWS (see sql/attribution_windows.sql).

One row per (date, channel, window_key). Dates come from the channel's DAILY_AD_SUMMARY rows,
so every window has exactly one row per summary day (zero when nothing converted).
"""

T = "MONARCH_RAW.ADS.DAILY_AD_SUMMARY_WINDOWS"
COLS = "(summary_date,channel,window_key,window_days,conversions,conversion_value,conversion_unit)"

# Google lag buckets -> upper bound in days. Windows are cumulative: the 7d window is every
# bucket up to SIX_TO_SEVEN_DAYS. Anything longer than 30 days is outside every window.
GOOGLE_LAG_DAYS = {
    "LESS_THAN_ONE_DAY": 1, "ONE_TO_TWO_DAYS": 2, "TWO_TO_THREE_DAYS": 3, "THREE_TO_FOUR_DAYS": 4,
    "FOUR_TO_FIVE_DAYS": 5, "FIVE_TO_SIX_DAYS": 6, "SIX_TO_SEVEN_DAYS": 7, "SEVEN_TO_EIGHT_DAYS": 8,
    "EIGHT_TO_NINE_DAYS": 9, "NINE_TO_TEN_DAYS": 10, "TEN_TO_ELEVEN_DAYS": 11, "ELEVEN_TO_TWELVE_DAYS": 12,
    "TWELVE_TO_THIRTEEN_DAYS": 13, "THIRTEEN_TO_FOURTEEN_DAYS": 14, "FOURTEEN_TO_TWENTY_ONE_DAYS": 21,
    "TWENTY_ONE_TO_THIRTY_DAYS": 30,
}


def _meta_sql(since):
    # Click-only toggle reads 7d_click / 28d_click; 1d_click and 1d_view are kept for reconciliation.
    windows = [("1d_click", 1), ("7d_click", 7), ("28d_click", 28), ("1d_view", 1)]
    def agg(col):
        sums = ",".join(f'SUM(f.value:"{k}"::FLOAT) AS "{k}"' for k, _ in windows)
        return f"""SELECT m.ingestion_date AS d,{sums} FROM MONARCH_RAW.ADS.META_ADS_RAW m,
            LATERAL FLATTEN(input=>m.raw_data:{col}) f
            WHERE f.value:action_type::STRING='purchase' AND m.ingestion_date>='{since}' GROUP BY 1"""
    selects = " UNION ALL ".join(
        f"""SELECT s.summary_date,'meta_ads','{k}',{days},COALESCE(a."{k}",0),COALESCE(v."{k}",0),'purchases'
            FROM s LEFT JOIN a ON a.d=s.summary_date LEFT JOIN v ON v.d=s.summary_date"""
        for k, days in windows)
    return f"""INSERT INTO {T} {COLS}
        WITH s AS (SELECT summary_date FROM MONARCH_RAW.ADS.DAILY_AD_SUMMARY WHERE channel='meta_ads' AND summary_date>='{since}'),
             a AS ({agg('actions')}), v AS ({agg('action_values')})
        {selects}"""


def _google_sql(since):
    # PURCHASE category only; begin checkout stays in the platform default (DAILY_AD_SUMMARY).
    lag = " ".join(f"WHEN '{b}' THEN {d}" for b, d in GOOGLE_LAG_DAYS.items())
    selects = " UNION ALL ".join(
        f"""SELECT s.summary_date,'google_ads','{w}d',{w},
                COALESCE(SUM(IFF(l.lag_days<={w},l.conversions,0)),0),COALESCE(SUM(IFF(l.lag_days<={w},l.conversions_value,0)),0),'purchases'
            FROM s LEFT JOIN l ON l.d=s.summary_date GROUP BY s.summary_date"""
        for w in (1, 7, 14, 30))
    return f"""INSERT INTO {T} {COLS}
        WITH s AS (SELECT summary_date FROM MONARCH_RAW.ADS.DAILY_AD_SUMMARY WHERE channel='google_ads' AND summary_date>='{since}'),
             l AS (SELECT ingestion_date AS d,
                     CASE raw_data:conversion_lag_bucket::STRING {lag} ELSE 9999 END AS lag_days,
                     raw_data:conversions::FLOAT AS conversions, raw_data:conversions_value::FLOAT AS conversions_value
                   FROM MONARCH_RAW.ADS.GOOGLE_ADS_CONV_LAG_RAW
                   WHERE raw_data:conversion_action_category::STRING='PURCHASE' AND ingestion_date>='{since}')
        {selects}"""


def _replace(cur, statements):
    """Run delete + inserts as one transaction; on any error roll back so the old rows stay."""
    cur.execute("BEGIN")
    try:
        for sql in statements:
            cur.execute(sql)
    except Exception:
        cur.execute("ROLLBACK")
        raise
    cur.execute("COMMIT")


def fill_meta_google(cur, since):
    """Replace meta_ads/google_ads window rows from `since` (daily: trailing 31 days)."""
    _replace(cur, [f"DELETE FROM {T} WHERE channel IN ('meta_ads','google_ads') AND summary_date>='{since}'",
                   _meta_sql(since), _google_sql(since)])


def fill_walmart(cur):
    """Replace all Walmart window rows (both raw tables are fully reloaded each run)."""
    # Search: orders and 30-day columns exist only from the 2026 export, so earlier days keep
    # NULL conversions (shown blank) while 14-day revenue is still reported.
    connect_sql = f"""INSERT INTO {T} {COLS}
        SELECT ad_date,'walmart_connect','14d',14,orders_14d,sales_revenue_14d,'orders' FROM MONARCH_RAW.ADS.WALMART_CONNECT_RAW
        UNION ALL
        SELECT ad_date,'walmart_connect','30d',30,orders_30d,sales_revenue_30d,'orders' FROM MONARCH_RAW.ADS.WALMART_CONNECT_RAW"""
    display_sql = f"""INSERT INTO {T} {COLS}
        SELECT ad_date,'walmart_display','14d',14,SUM(attributed_transactions),SUM(attributed_sales),'transactions'
          FROM MONARCH_RAW.ADS.WALMART_DISPLAY_RAW GROUP BY ad_date
        UNION ALL
        SELECT ad_date,'walmart_display','30d',30,SUM(attributed_transactions_30d),SUM(attributed_sales_30d),'transactions'
          FROM MONARCH_RAW.ADS.WALMART_DISPLAY_RAW GROUP BY ad_date"""
    _replace(cur, [f"DELETE FROM {T} WHERE channel IN ('walmart_connect','walmart_display')", connect_sql, display_sql])
