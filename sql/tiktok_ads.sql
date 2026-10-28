-- TikTok Ads ingestion (ingestion/sources/tiktok_ads.py, daily_scheduler.py run_tiktok()).
--
-- Two reports, kept in separate raw tables because their metrics differ:
--   TIKTOK_ADS_RAW      standard auction campaigns  (report/integrated/get, AUCTION_CAMPAIGN)
--   TIKTOK_GMV_MAX_RAW  GMV Max campaigns           (gmv_max/report/get)
-- raw_data is the API row as returned: {"dimensions": {campaign_id, stat_time_day}, "metrics": {...}}.
-- Metric values arrive as strings; cast on read.

CREATE TABLE IF NOT EXISTS MONARCH_RAW.ADS.TIKTOK_ADS_RAW (
    id             VARCHAR,
    ingested_at    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    ingestion_date DATE,
    source         VARCHAR,
    raw_data       VARIANT
);

CREATE TABLE IF NOT EXISTS MONARCH_RAW.ADS.TIKTOK_GMV_MAX_RAW (
    id             VARCHAR,
    ingested_at    TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    ingestion_date DATE,
    source         VARCHAR,
    raw_data       VARIANT
);

-- One row per day with each report's figures in its own named column, so units never mix.
-- Not created (MONARCH_ROLE lacks CREATE VIEW on ADS): rebuild_tiktok_summary() in
-- ingestion/sources/tiktok_ads.py uses the same columns directly. The tiktok_ads row in DAILY_AD_SUMMARY:
--   spend            = std_spend_usd + gmv_cost_usd
--   conversions      = gmv_orders            (std_conversion_events stays here only — it counts the
--                                             campaign's optimization event, not necessarily purchases)
--   conversion_value = gmv_gross_revenue_usd (the standard report has no revenue)
-- TikTok's ctr is a percentage and roi a ratio; neither is summed. Daily ratios are recomputed from totals.
CREATE OR REPLACE VIEW MONARCH_RAW.ADS.TIKTOK_ADS_DAILY_COMPONENTS AS
WITH std AS (
    SELECT ingestion_date,
           SUM(raw_data:metrics:spend::FLOAT)        AS std_spend_usd,
           SUM(raw_data:metrics:impressions::NUMBER) AS std_impressions,
           SUM(raw_data:metrics:clicks::NUMBER)      AS std_clicks,
           SUM(raw_data:metrics:conversion::FLOAT)   AS std_conversion_events
    FROM MONARCH_RAW.ADS.TIKTOK_ADS_RAW
    GROUP BY ingestion_date
), gmv AS (
    SELECT ingestion_date,
           SUM(raw_data:metrics:cost::FLOAT)          AS gmv_cost_usd,
           SUM(raw_data:metrics:net_cost::FLOAT)      AS gmv_net_cost_usd,
           SUM(raw_data:metrics:orders::FLOAT)        AS gmv_orders,
           SUM(raw_data:metrics:gross_revenue::FLOAT) AS gmv_gross_revenue_usd
    FROM MONARCH_RAW.ADS.TIKTOK_GMV_MAX_RAW
    GROUP BY ingestion_date
)
SELECT COALESCE(std.ingestion_date, gmv.ingestion_date) AS summary_date,
       COALESCE(std.std_spend_usd, 0)          AS std_spend_usd,
       COALESCE(std.std_impressions, 0)        AS std_impressions,
       COALESCE(std.std_clicks, 0)             AS std_clicks,
       COALESCE(std.std_conversion_events, 0)  AS std_conversion_events,
       COALESCE(gmv.gmv_cost_usd, 0)           AS gmv_cost_usd,
       COALESCE(gmv.gmv_net_cost_usd, 0)       AS gmv_net_cost_usd,
       COALESCE(gmv.gmv_orders, 0)             AS gmv_orders,
       COALESCE(gmv.gmv_gross_revenue_usd, 0)  AS gmv_gross_revenue_usd,
       CASE WHEN gmv.gmv_cost_usd > 0 THEN gmv.gmv_gross_revenue_usd / gmv.gmv_cost_usd END AS gmv_roi
FROM std FULL OUTER JOIN gmv ON std.ingestion_date = gmv.ingestion_date;
