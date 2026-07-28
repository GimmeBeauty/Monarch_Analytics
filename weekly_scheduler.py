import sys, os
sys.path.insert(0, "/home/runner/workspace")
from datetime import date
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

print(f"=== Monarch Weekly Scheduler — {date.today()} ===")

def run_netsuite():
    print("\n[1/2] NetSuite weekly sync...")
    try:
        import subprocess
        result = subprocess.run(
            ["python3", "netsuite_fast_sync.py"],
            capture_output=True, text=True, timeout=3600
        )
        print(result.stdout[-1000:] if result.stdout else "No output")
        if result.returncode == 0:
            print("  ✅ NetSuite done")
        else:
            print(f"  ❌ NetSuite error: {result.stderr[-200:]}")
    except Exception as e:
        print(f"  ❌ NetSuite error: {e}")

def run_circana():
    print("\n[3/3] Circana POS data...")
    try:
        from ingestion.sources.circana_pos import run_circana_ingestion
        run_circana_ingestion()
        print("  ✅ Circana done")
    except Exception as e:
        print(f"  ❌ Circana error: {e}")

def run_walmart_s3():
    print("\n[4/4] Walmart S3 data...")
    try:
        from ingestion.sources.walmart_s3 import run_walmart_s3_ingestion
        from datetime import date, timedelta
        after_date = (date.today() - timedelta(days=35)).isoformat()
        run_walmart_s3_ingestion(after_date=after_date)
        print("  ✅ Walmart S3 done")
    except Exception as e:
        print(f"  ❌ Walmart S3 error: {e}")

def run_agility():
    print("\n[4/6] Agility (CTV/Programmatic/Display)...")
    try:
        from ingestion.sources.agility_ads import run_agility_ingestion
        run_agility_ingestion()
        print("  ✅ Agility done")
    except Exception as e:
        print(f"  ❌ Agility error: {e}")

def run_amazon_dsp():
    print("\n[5/6] Amazon DSP (CTV/Programmatic/Display)...")
    try:
        from ingestion.sources.amazon_dsp import run_amazon_dsp_ingestion
        run_amazon_dsp_ingestion()
        print("  ✅ Amazon DSP done")
    except Exception as e:
        print(f"  ❌ Amazon DSP error: {e}")

def rebuild_ctv_display_summary():
    print("\n[6/6] Rebuilding CTV/Programmatic + Display ad summary...")
    try:
        from snowflake_connect import get_connection
        conn = get_connection(schema="ADS")
        cur = conn.cursor()
        cur.execute("DELETE FROM MONARCH_RAW.ADS.DAILY_AD_SUMMARY WHERE channel IN ('ctv_programmatic', 'display_ads')")
        for db_channel, source_channel in [("ctv_programmatic", "Video"), ("display_ads", "Display")]:
            cur.execute(f"""INSERT INTO MONARCH_RAW.ADS.DAILY_AD_SUMMARY (summary_date,channel,spend,impressions,clicks,conversions,conversion_value,ctr,cpc,cpm,roas)
SELECT ad_date,'{db_channel}',SUM(spend),SUM(impressions),SUM(clicks),SUM(conversions),SUM(revenue),
CASE WHEN SUM(impressions)>0 THEN SUM(clicks)/SUM(impressions) ELSE 0 END,
CASE WHEN SUM(clicks)>0 THEN SUM(spend)/SUM(clicks) ELSE 0 END,
CASE WHEN SUM(impressions)>0 THEN SUM(spend)/SUM(impressions)*1000 ELSE 0 END,
CASE WHEN SUM(spend)>0 THEN SUM(revenue)/SUM(spend) ELSE 0 END
FROM (
    SELECT ad_date, spend, impressions, clicks, traffic_conversions AS conversions, realized_revenue AS revenue
    FROM MONARCH_RAW.ADS.AGILITY_ADS_RAW WHERE channel = '{source_channel}'
    UNION ALL
    SELECT ad_date, total_cost AS spend, impressions, clicks, purchases AS conversions, sales AS revenue
    FROM MONARCH_RAW.ADS.AMAZON_DSP_RAW WHERE channel = '{source_channel}'
) combined
GROUP BY ad_date""")
        cur.close()
        conn.close()
        print("  ✅ CTV/Display summary done")
    except Exception as e:
        print(f"  ❌ CTV/Display summary error: {e}")

def run_walmart_connect():
    print("\n[5/5] Walmart Connect Ads...")
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
        print("  ✅ Walmart Connect done")
    except Exception as e:
        print(f"  ❌ Walmart Connect error: {e}")

if __name__ == "__main__":
    run_netsuite()
    run_circana()
    run_walmart_s3()
    run_agility()
    run_walmart_connect()
    run_amazon_dsp()
    rebuild_ctv_display_summary()
    print("\n✅ Weekly scheduler complete!")
