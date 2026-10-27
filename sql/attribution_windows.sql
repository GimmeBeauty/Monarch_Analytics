-- Attribution-window toggle on Ad Attribution (/api/data/attribution?window=default|7|14|30).
--
-- DAILY_AD_SUMMARY stays the platform-default source (and the only source for spend,
-- impressions and clicks). This table holds per-window conversions and value for the
-- channels that report them; ingestion/attribution_windows.py fills it:
--   meta_ads, google_ads          daily_scheduler.py (trailing 31 days, delete + insert)
--   walmart_connect/_display      walmart_connect_scheduler.py (full reload)
-- Channels without rows here (Roundel, Criteo, ...) fall back to DAILY_AD_SUMMARY.

CREATE TABLE IF NOT EXISTS MONARCH_RAW.ADS.DAILY_AD_SUMMARY_WINDOWS (
    summary_date     DATE    NOT NULL,
    channel          VARCHAR NOT NULL,   -- DAILY_AD_SUMMARY channel value
    window_key       VARCHAR NOT NULL,   -- meta: 1d_click/7d_click/28d_click/1d_view; google: 1d/7d/14d/30d; walmart: 14d/30d
    window_days      NUMBER  NOT NULL,
    conversions      FLOAT,              -- NULL = not reported (Walmart Search orders before 2026)
    conversion_value FLOAT,
    conversion_unit  VARCHAR NOT NULL,   -- purchases | orders | transactions
    updated_at       TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);

-- What each channel's DAILY_AD_SUMMARY numbers mean (the "Platform default" mode), and which
-- window_key the 7/14/30 toggle reads. A NULL window key means the channel has no per-window
-- data and always shows its default.
CREATE OR REPLACE TABLE MONARCH_RAW.ADS.AD_ATTRIBUTION_DEFAULTS (
    channel           VARCHAR NOT NULL,
    default_label     VARCHAR NOT NULL,  -- shown in chips / tooltips
    default_days      NUMBER,            -- NULL when the platform default isn't a single window
    default_unit      VARCHAR NOT NULL,  -- unit of DAILY_AD_SUMMARY.conversions
    window_7_key      VARCHAR,
    window_14_key     VARCHAR,
    window_30_key     VARCHAR,
    note              VARCHAR
);

INSERT INTO MONARCH_RAW.ADS.AD_ATTRIBUTION_DEFAULTS VALUES
  ('meta_ads',         '7d click + 1d view',              7,    'purchases',    '7d_click', '7d_click', '28d_click', 'Toggle is click-only — 14 uses 7d click, 30 uses 28d click'),
  ('google_ads',       'Google default (7d purchase lookback)', 7, 'purchases', '7d',       '7d',       '7d',        'Purchase lookback is 7 days, so 14/30 read the 7d figure — default also counts begin checkout'),
  ('walmart_connect',  '14d',                             14,   'units',        '14d',      '14d',      '30d',       'Default counts units — 14/30 count orders, reported from 2026 only'),
  ('walmart_display',  '14d',                             14,   'transactions', '14d',      '14d',      '30d',       NULL),
  ('roundel_target',   '14d',                             14,   'orders',       NULL,       NULL,       NULL,        'Fixed 14-day window'),
  ('criteo_ads',       '30d click',                       30,   'orders',       NULL,       NULL,       NULL,        'Fixed 30-day click window'),
  ('pinterest_ads',    'Pinterest default',               NULL, 'conversions',  NULL,       NULL,       NULL,        'No per-window data'),
  ('amazon_ads',       'Amazon default',                  NULL, 'conversions',  NULL,       NULL,       NULL,        'No per-window data'),
  ('ctv_programmatic', 'Partner default',                 NULL, 'conversions',  NULL,       NULL,       NULL,        'No per-window data'),
  ('display_ads',      'Partner default',                 NULL, 'conversions',  NULL,       NULL,       NULL,        'No per-window data');
