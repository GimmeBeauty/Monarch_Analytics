-- One-off cleanup of MONARCH_RAW.RETAIL.WALMART_ALLOY_SALES_DAILY after the
-- 2026-09-25 historical backfill. Run top to bottom in Snowsight.
--
-- Expected state before running (verified 2026-09-25):
--   total rows                         95,627,290
--   stale rows (Part 1)                   246,659   all SALES_NET_USD NULL
--   duplicate keys among fresh rows           600   all LOCATION_ID 113707,
--                                                   SALE_DATE 2026-09-07..09-20,
--                                                   every column identical
--   double-counted sales in those dups  $9,602.28
--
-- The target table has no VERSION column, and the 600 duplicate pairs match in
-- every column, so there is no "latest version" to choose between. Part 2 keeps
-- one copy of each key.

USE DATABASE MONARCH_RAW;
USE SCHEMA RETAIL;

-- ─── Pre-checks ─────────────────────────────────────────────────────────────
SELECT COUNT(*) AS stale_rows, COUNT_IF(SALES_NET_USD IS NOT NULL) AS stale_rows_with_sales
FROM WALMART_ALLOY_SALES_DAILY
WHERE SALE_DATE BETWEEN '2026-09-07' AND '2026-09-21'
  AND UPDATED_AT < '2026-09-25';
-- expect 246,659 / 0

-- ─── Stage one row per duplicated key (before BEGIN: DDL auto-commits) ────
-- Snowflake can't DELETE one of two identical rows, so: copy one row per
-- duplicated key aside, delete every row for those keys, re-insert the copies.
-- Scoped to the fresh rows so the stale duplicates removed in Part 1 aren't
-- re-inserted.
CREATE OR REPLACE TEMPORARY TABLE _walmart_alloy_dedup AS
SELECT *
FROM WALMART_ALLOY_SALES_DAILY
WHERE UPDATED_AT >= '2026-09-25'
  AND (SALE_DATE, PRODUCT_ID, LOCATION_ID) IN (
    SELECT SALE_DATE, PRODUCT_ID, LOCATION_ID
    FROM WALMART_ALLOY_SALES_DAILY
    WHERE UPDATED_AT >= '2026-09-25'
    GROUP BY 1, 2, 3
    HAVING COUNT(*) > 1
  )
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY SALE_DATE, PRODUCT_ID, LOCATION_ID
  ORDER BY UPDATED_AT DESC
) = 1;

SELECT COUNT(*) FROM _walmart_alloy_dedup;
-- expect 600 (stop here if not)

BEGIN TRANSACTION;

-- ─── Part 1: stale rows left over from the pre-fix 2026-09-21 load ─────────
DELETE FROM WALMART_ALLOY_SALES_DAILY
WHERE SALE_DATE BETWEEN '2026-09-07' AND '2026-09-21'
  AND UPDATED_AT < '2026-09-25';
-- expect 246,659 rows deleted

-- ─── Part 2: collapse the 600 exact duplicate keys to a single row ─────────

DELETE FROM WALMART_ALLOY_SALES_DAILY
WHERE (SALE_DATE, PRODUCT_ID, LOCATION_ID) IN (
  SELECT SALE_DATE, PRODUCT_ID, LOCATION_ID FROM _walmart_alloy_dedup
);
-- expect 1,200 rows deleted

INSERT INTO WALMART_ALLOY_SALES_DAILY
SELECT * FROM _walmart_alloy_dedup;
-- expect 600 rows inserted

-- ─── Post-checks (run before COMMIT) ───────────────────────────────────────
SELECT COUNT(*) AS total_rows, ROUND(SUM(SALES_NET_USD), 2) AS total_sales
FROM WALMART_ALLOY_SALES_DAILY;
-- expect 95,380,031 rows / $67,661,849.76  (67,671,452.04 - 9,602.28)

SELECT COUNT(*) AS dup_keys FROM (
  SELECT 1 FROM WALMART_ALLOY_SALES_DAILY
  GROUP BY SALE_DATE, PRODUCT_ID, LOCATION_ID
  HAVING COUNT(*) > 1
);
-- expect 0

SELECT COUNT(*) AS null_sales_rows FROM WALMART_ALLOY_SALES_DAILY WHERE SALES_NET_USD IS NULL;
-- expect 0

COMMIT;
-- If any check above is off: ROLLBACK;
