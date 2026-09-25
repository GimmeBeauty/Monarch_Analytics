-- Adds a DELETE step to WALMART_ALLOY_SYNC / ULTA_ALLOY_SYNC so rows Alloy drops
-- upstream are removed from the target instead of accumulating.
--
-- Why: a MERGE only updates/inserts keys present in the source. Snowflake's MERGE
-- has no WHEN NOT MATCHED BY SOURCE, so a key Alloy stops sending is never
-- touched again. That is how 246,659 stale NULL-sales rows (and 150 phantom
-- store locations) survived the 2026-09-25 backfill for 2026-09-07..09-21.
--
-- Shape of the new task body:
--   1. Stage the deduped source ONCE into a temp table, so MERGE and DELETE see
--      the same snapshot. The ROW_NUMBER() goes on the FINAL select (after any
--      product/location joins): the 600 exact duplicate rows left by the
--      backfill were all LOCATION_ID 113707 (no name/city/state), which looks
--      like a join fan-out after the VERSION dedup, not two versions.
--   2. MERGE as today.
--   3. DELETE target rows inside the staged date window whose key isn't in the
--      staged source. Scoped to [min, max] SALE_DATE of what was staged, so an
--      incremental sync (e.g. last N days) can never delete older history.
--      Skipped entirely if the stage is empty, so an empty/failed pull from
--      Alloy can't wipe the window.
--
-- <<EXISTING SOURCE SELECT>> is a placeholder for the SELECT the task runs
-- today (the one you just added the VERSION dedup to). It must output the
-- target's column names. I couldn't read the current task definition from the
-- MONARCH_APP account, so paste it in from Snowsight.

USE DATABASE MONARCH_RAW;
USE SCHEMA RETAIL;

-- ════════════════════════════════════════════════════════════════════════════
-- WALMART
-- ════════════════════════════════════════════════════════════════════════════
ALTER TASK WALMART_ALLOY_SYNC SUSPEND;

ALTER TASK WALMART_ALLOY_SYNC MODIFY AS
EXECUTE IMMEDIATE $$
DECLARE
  staged_rows INTEGER;
  min_d DATE;
  max_d DATE;
BEGIN
  -- 1. Stage deduped source
  CREATE OR REPLACE TEMPORARY TABLE _walmart_alloy_stage AS
  SELECT *
  FROM (
    <<EXISTING SOURCE SELECT>>
  )
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY SALE_DATE, PRODUCT_ID, LOCATION_ID
    ORDER BY VERSION DESC
  ) = 1;

  SELECT COUNT(*), MIN(SALE_DATE), MAX(SALE_DATE)
    INTO :staged_rows, :min_d, :max_d
  FROM _walmart_alloy_stage;

  IF (staged_rows = 0) THEN
    RETURN 'No source rows staged; skipped MERGE and DELETE';
  END IF;

  -- 2. Upsert
  MERGE INTO WALMART_ALLOY_SALES_DAILY t
  USING _walmart_alloy_stage s
    ON  t.SALE_DATE   = s.SALE_DATE
    AND t.PRODUCT_ID  = s.PRODUCT_ID
    AND t.LOCATION_ID = s.LOCATION_ID
  WHEN MATCHED THEN UPDATE SET
    WALMART_ITEM_NUMBER = s.WALMART_ITEM_NUMBER,
    WALMART_ITEM_DESC   = s.WALMART_ITEM_DESC,
    WALMART_UPC         = s.WALMART_UPC,
    LOCATION_NAME       = s.LOCATION_NAME,
    CITY                = s.CITY,
    STATE               = s.STATE,
    POSTAL_CODE         = s.POSTAL_CODE,
    LATITUDE            = s.LATITUDE,
    LONGITUDE           = s.LONGITUDE,
    SALES_NET_USD       = s.SALES_NET_USD,
    SALES_UNITS_NET     = s.SALES_UNITS_NET,
    ON_HAND_UNITS       = s.ON_HAND_UNITS,
    INSTOCK_PERCENTAGE  = s.INSTOCK_PERCENTAGE,
    GROSS_MARGIN_USD    = s.GROSS_MARGIN_USD,
    RETURNS_USD         = s.RETURNS_USD,
    RETURNS_UNITS       = s.RETURNS_UNITS,
    UPDATED_AT          = CURRENT_TIMESTAMP()
  WHEN NOT MATCHED THEN INSERT (
    SALE_DATE, PRODUCT_ID, LOCATION_ID, WALMART_ITEM_NUMBER, WALMART_ITEM_DESC,
    WALMART_UPC, LOCATION_NAME, CITY, STATE, POSTAL_CODE, LATITUDE, LONGITUDE,
    SALES_NET_USD, SALES_UNITS_NET, ON_HAND_UNITS, INSTOCK_PERCENTAGE,
    GROSS_MARGIN_USD, RETURNS_USD, RETURNS_UNITS, UPDATED_AT
  ) VALUES (
    s.SALE_DATE, s.PRODUCT_ID, s.LOCATION_ID, s.WALMART_ITEM_NUMBER, s.WALMART_ITEM_DESC,
    s.WALMART_UPC, s.LOCATION_NAME, s.CITY, s.STATE, s.POSTAL_CODE, s.LATITUDE, s.LONGITUDE,
    s.SALES_NET_USD, s.SALES_UNITS_NET, s.ON_HAND_UNITS, s.INSTOCK_PERCENTAGE,
    s.GROSS_MARGIN_USD, s.RETURNS_USD, s.RETURNS_UNITS, CURRENT_TIMESTAMP()
  );

  -- 3. Remove keys Alloy no longer sends, within the synced window only
  DELETE FROM WALMART_ALLOY_SALES_DAILY t
  WHERE t.SALE_DATE BETWEEN :min_d AND :max_d
    AND NOT EXISTS (
      SELECT 1 FROM _walmart_alloy_stage s
      WHERE s.SALE_DATE   = t.SALE_DATE
        AND s.PRODUCT_ID  = t.PRODUCT_ID
        AND s.LOCATION_ID = t.LOCATION_ID
    );

  RETURN 'Staged ' || staged_rows || ' rows for ' || min_d || '..' || max_d
      || '; deleted ' || SQLROWCOUNT || ' dropped rows';
END;
$$;

ALTER TASK WALMART_ALLOY_SYNC RESUME;

-- ════════════════════════════════════════════════════════════════════════════
-- ULTA — same shape, Ulta column names
-- ════════════════════════════════════════════════════════════════════════════
ALTER TASK ULTA_ALLOY_SYNC SUSPEND;

ALTER TASK ULTA_ALLOY_SYNC MODIFY AS
EXECUTE IMMEDIATE $$
DECLARE
  staged_rows INTEGER;
  min_d DATE;
  max_d DATE;
BEGIN
  CREATE OR REPLACE TEMPORARY TABLE _ulta_alloy_stage AS
  SELECT *
  FROM (
    <<EXISTING SOURCE SELECT>>
  )
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY SALE_DATE, PRODUCT_ID, LOCATION_ID
    ORDER BY VERSION DESC
  ) = 1;

  SELECT COUNT(*), MIN(SALE_DATE), MAX(SALE_DATE)
    INTO :staged_rows, :min_d, :max_d
  FROM _ulta_alloy_stage;

  IF (staged_rows = 0) THEN
    RETURN 'No source rows staged; skipped MERGE and DELETE';
  END IF;

  MERGE INTO ULTA_ALLOY_SALES_DAILY t
  USING _ulta_alloy_stage s
    ON  t.SALE_DATE   = s.SALE_DATE
    AND t.PRODUCT_ID  = s.PRODUCT_ID
    AND t.LOCATION_ID = s.LOCATION_ID
  WHEN MATCHED THEN UPDATE SET
    ULTA_ITEM_NUMBER   = s.ULTA_ITEM_NUMBER,
    ULTA_ITEM_DESC     = s.ULTA_ITEM_DESC,
    UPC                = s.UPC,
    LOCATION_NAME      = s.LOCATION_NAME,
    CITY               = s.CITY,
    STATE              = s.STATE,
    POSTAL_CODE        = s.POSTAL_CODE,
    LATITUDE           = s.LATITUDE,
    LONGITUDE          = s.LONGITUDE,
    SALES_NET_USD      = s.SALES_NET_USD,
    SALES_UNITS_NET    = s.SALES_UNITS_NET,
    ON_HAND_UNITS      = s.ON_HAND_UNITS,
    INSTOCK_PERCENTAGE = s.INSTOCK_PERCENTAGE,
    GROSS_MARGIN_USD   = s.GROSS_MARGIN_USD,
    RETURNS_USD        = s.RETURNS_USD,
    RETURNS_UNITS      = s.RETURNS_UNITS,
    UPDATED_AT         = CURRENT_TIMESTAMP()
  WHEN NOT MATCHED THEN INSERT (
    SALE_DATE, PRODUCT_ID, LOCATION_ID, ULTA_ITEM_NUMBER, ULTA_ITEM_DESC,
    UPC, LOCATION_NAME, CITY, STATE, POSTAL_CODE, LATITUDE, LONGITUDE,
    SALES_NET_USD, SALES_UNITS_NET, ON_HAND_UNITS, INSTOCK_PERCENTAGE,
    GROSS_MARGIN_USD, RETURNS_USD, RETURNS_UNITS, UPDATED_AT
  ) VALUES (
    s.SALE_DATE, s.PRODUCT_ID, s.LOCATION_ID, s.ULTA_ITEM_NUMBER, s.ULTA_ITEM_DESC,
    s.UPC, s.LOCATION_NAME, s.CITY, s.STATE, s.POSTAL_CODE, s.LATITUDE, s.LONGITUDE,
    s.SALES_NET_USD, s.SALES_UNITS_NET, s.ON_HAND_UNITS, s.INSTOCK_PERCENTAGE,
    s.GROSS_MARGIN_USD, s.RETURNS_USD, s.RETURNS_UNITS, CURRENT_TIMESTAMP()
  );

  DELETE FROM ULTA_ALLOY_SALES_DAILY t
  WHERE t.SALE_DATE BETWEEN :min_d AND :max_d
    AND NOT EXISTS (
      SELECT 1 FROM _ulta_alloy_stage s
      WHERE s.SALE_DATE   = t.SALE_DATE
        AND s.PRODUCT_ID  = t.PRODUCT_ID
        AND s.LOCATION_ID = t.LOCATION_ID
    );

  RETURN 'Staged ' || staged_rows || ' rows for ' || min_d || '..' || max_d
      || '; deleted ' || SQLROWCOUNT || ' dropped rows';
END;
$$;

ALTER TASK ULTA_ALLOY_SYNC RESUME;

-- ─── After the next scheduled run ──────────────────────────────────────────
-- SELECT name, state, error_message, return_value, completed_time
-- FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY(TASK_NAME => 'WALMART_ALLOY_SYNC'))
-- ORDER BY scheduled_time DESC LIMIT 5;
--
-- SELECT COUNT(*) AS dup_keys FROM (
--   SELECT 1 FROM WALMART_ALLOY_SALES_DAILY
--   GROUP BY SALE_DATE, PRODUCT_ID, LOCATION_ID HAVING COUNT(*) > 1);  -- expect 0
