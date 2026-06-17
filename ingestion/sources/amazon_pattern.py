import sys, os
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")
sys.path.insert(0, "/home/runner/workspace")
from snowflake_connect import get_connection

SHARE_DB = "GIMME_BEAUTY__OUTBOUND__SHARE"
SHARE_SCHEMA = "STANDARD_SHARE"

def run_amazon_ingestion(full_refresh=False):
    print("Syncing Amazon Pattern data...")
    conn = get_connection(schema="COMMERCE")
    cur = conn.cursor()

    if full_refresh:
        start_date = "2025-01-01"
    else:
        start_date = (date.today() - timedelta(days=3)).isoformat()

    end_date = date.today().isoformat()
    print(f"  Date range: {start_date} to {end_date}")

    # Sync sales
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

    cur.close()
    conn.close()
    print("✅ Amazon Pattern sync complete!")

if __name__ == "__main__":
    import sys
    full = "--full" in sys.argv
    run_amazon_ingestion(full_refresh=full)
