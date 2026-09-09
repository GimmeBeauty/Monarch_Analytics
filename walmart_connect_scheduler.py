"""Dedicated weekly scheduler for Walmart Connect - runs separately at 10am MST."""
def run_walmart_connect():
    print("Walmart Connect Ads...")
    try:
        from ingestion.sources.walmart_connect import run_walmart_connect_ingestion
        run_walmart_connect_ingestion()
        from snowflake_connect import get_connection
        conn = get_connection(schema="ADS")
        cur = conn.cursor()
        cur.execute("DELETE FROM MONARCH_RAW.ADS.DAILY_AD_SUMMARY WHERE channel='walmart_connect'")
        conn.commit()
        cur.execute("""INSERT INTO MONARCH_RAW.ADS.DAILY_AD_SUMMARY
(summary_date,channel,spend,impressions,clicks,conversions,conversion_value,ctr,cpc,cpm,roas)
SELECT ad_date,'walmart_connect',spend,impressions,clicks,units_sold_14d,sales_revenue_14d,
ctr,CASE WHEN clicks>0 THEN spend/clicks ELSE 0 END,
CASE WHEN impressions>0 THEN spend/impressions*1000 ELSE 0 END,
CASE WHEN spend>0 THEN sales_revenue_14d/spend ELSE 0 END
FROM MONARCH_RAW.ADS.WALMART_CONNECT_RAW""")
        conn.commit()
        cur.close(); conn.close()
        print("✅ Walmart Connect done")
    except Exception as e:
        print(f"❌ Walmart Connect error: {e}")

if __name__ == "__main__":
    run_walmart_connect()
