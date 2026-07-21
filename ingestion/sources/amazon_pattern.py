import sys, os
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")
sys.path.insert(0, "/home/runner/workspace")
from snowflake_connect import get_connection

SHARE_DB = "GIMME_BEAUTY__OUTBOUND__SHARE"
SHARE_SCHEMA = "STANDARD_SHARE"

# ─── Revenue column notes ──────────────────────────────────────────────────────
#
# Pattern's SALES_DETAIL_SHARE_VIEW revenue columns (verified via DESCRIBE TABLE):
#
#   REVENUE_TOTAL_USD       — "total revenue generated from the order in USD,
#                              after applying the currency exchange rate"
#                              This IS the consumer-facing POS price (what customers
#                              paid on Amazon). Confirmed: a $7.00 hair-band order
#                              has REVENUE_TOTAL_USD = 7.00. USE THIS.
#
#   REVENUE_TOTAL           — Same as REVENUE_TOTAL_USD for USD transactions (rate=1.0).
#   REVENUE_PENDING         — Revenue for orders still in pending/processing state.
#   REVENUE_RETURNED        — Refunded revenue (returns).
#   REVENUE_TOTAL_TAX_ADJUSTED_USD — Post-tax-adjustment net; nearly identical to
#                                    REVENUE_TOTAL_USD for US orders.
#   DISCOUNT_TOTAL          — Coupon/promo discounts applied to the order.
#
# There is NO "remittance" or "net payout to Durham" column in this share view.
# REVENUE_TOTAL_USD is the full consumer price, not a margin-adjusted figure.
#
# ─── Why revenue appeared ~50% lower than expected (the actual bug) ────────────
#
# Pattern's share view confirms orders with a lag of several days. At ingestion
# time, some orders have UNITS_PENDING > 0 and UNITS_SHIPPED = 0, so the filter
# "UNITS_SHIPPED > 0" excludes them. By the next day those orders are confirmed
# as shipped — but the old 3-day rolling window no longer reaches back to re-sync
# them, so they're permanently missed.
#
# Fix: extend the rolling window to 14 days so every late-confirming order gets
# captured on a subsequent daily run.
# ──────────────────────────────────────────────────────────────────────────────


def run_amazon_ingestion(full_refresh=False):
    print("Syncing Amazon Pattern data...")
    conn = get_connection(schema="COMMERCE")
    cur = conn.cursor()

    if full_refresh:
        start_date = "2025-01-01"
    else:
        # 14-day rolling window catches orders Pattern confirms 3–7 days late.
        start_date = (date.today() - timedelta(days=14)).isoformat()

    end_date = date.today().isoformat()
    print(f"  Date range: {start_date} to {end_date}")

    # Sync sales — uses REVENUE_TOTAL_USD (consumer POS price, see notes above)
    cur.execute(f"DELETE FROM MONARCH_RAW.COMMERCE.AMAZON_SALES_DAILY WHERE sale_date BETWEEN '{start_date}' AND '{end_date}'")
    cur.execute(f"""
INSERT INTO MONARCH_RAW.COMMERCE.AMAZON_SALES_DAILY
(sale_date, asin, sku, title, marketplace, units_shipped, units_returned, revenue, discount_total)
SELECT
    DATE::DATE,
    ASIN::STRING,
    SKU::STRING,
    TITLE::STRING,
    MARKETPLACE::STRING,
    COALESCE(UNITS_SHIPPED::INTEGER, 0),
    COALESCE(UNITS_RETURNED::INTEGER, 0),
    COALESCE(REVENUE_TOTAL_USD::FLOAT, 0),
    COALESCE(DISCOUNT_TOTAL::FLOAT, 0)
FROM {SHARE_DB}.{SHARE_SCHEMA}.SALES_DETAIL_SHARE_VIEW
WHERE DATE BETWEEN '{start_date}' AND '{end_date}'
AND UNITS_SHIPPED > 0
""")
    cur.execute(f"SELECT COUNT(*), SUM(revenue) FROM MONARCH_RAW.COMMERCE.AMAZON_SALES_DAILY WHERE sale_date BETWEEN '{start_date}' AND '{end_date}'")
    row = cur.fetchone()
    print(f"  ✅ Sales: {row[0]:,} rows, ${row[1]:,.2f}")

    # Sync ads
    cur.execute(f"DELETE FROM MONARCH_RAW.ADS.AMAZON_ADS_RAW WHERE ad_date BETWEEN '{start_date}' AND '{end_date}'")
    cur.execute(f"""
INSERT INTO MONARCH_RAW.ADS.AMAZON_ADS_RAW
(ad_date, campaign_id, campaign_name, impressions, clicks, spend, ad_revenue, conversions)
SELECT
    DATE::DATE,
    CAMPAIGN_ID::STRING,
    CAMPAIGN_NAME::STRING,
    COALESCE(IMPRESSIONS::INTEGER, 0),
    COALESCE(CLICKS::INTEGER, 0),
    COALESCE(SPEND::FLOAT, 0),
    COALESCE(AD_REVENUE::FLOAT, 0),
    COALESCE(CONVERSIONS::INTEGER, 0)
FROM {SHARE_DB}.{SHARE_SCHEMA}.ADVERTISING_CAMPAIGN_REPORT_SHARE_VIEW
WHERE DATE BETWEEN '{start_date}' AND '{end_date}'
""")
    cur.execute(f"SELECT COUNT(*), SUM(spend), SUM(ad_revenue) FROM MONARCH_RAW.ADS.AMAZON_ADS_RAW WHERE ad_date BETWEEN '{start_date}' AND '{end_date}'")
    row = cur.fetchone()
    print(f"  ✅ Ads: {row[0]:,} rows, spend=${row[1]:,.2f}, revenue=${row[2]:,.2f}")

    # Post-sync verification: compare our table against the source share view for
    # the last 7 fully-confirmed days. Drift > $1 on any day indicates a problem.
    print("\n  Verifying table matches share view (last 7 days):")
    cur.execute(f"""
SELECT
    sv.dt,
    sv.share_rev,
    COALESCE(t.tbl_rev, 0) AS tbl_rev,
    ABS(sv.share_rev - COALESCE(t.tbl_rev, 0)) AS delta
FROM (
    SELECT DATE AS dt, SUM(COALESCE(REVENUE_TOTAL_USD, 0)) AS share_rev
    FROM {SHARE_DB}.{SHARE_SCHEMA}.SALES_DETAIL_SHARE_VIEW
    WHERE DATE BETWEEN DATEADD(day, -7, CURRENT_DATE()) AND DATEADD(day, -1, CURRENT_DATE())
      AND UNITS_SHIPPED > 0
    GROUP BY DATE
) sv
LEFT JOIN (
    SELECT sale_date, SUM(revenue) AS tbl_rev
    FROM MONARCH_RAW.COMMERCE.AMAZON_SALES_DAILY
    GROUP BY sale_date
) t ON t.sale_date = sv.dt
ORDER BY sv.dt DESC
""")
    all_ok = True
    for vrow in cur.fetchall():
        dt, share_rev, tbl_rev, delta = vrow
        status = "✅" if delta < 1 else "⚠️ DRIFT"
        print(f"    {dt}: share=${share_rev:,.2f}  table=${tbl_rev:,.2f}  {status}")
        if delta >= 1:
            all_ok = False
    if all_ok:
        print("  ✅ Verification passed — table matches share view")
    else:
        print("  ⚠️  Verification found drift — consider running with --full")

    cur.close()
    conn.close()
    print("✅ Amazon Pattern sync complete!")


if __name__ == "__main__":
    import sys
    full = "--full" in sys.argv
    run_amazon_ingestion(full_refresh=full)
