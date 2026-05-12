import sys, os, json, requests, zipfile, io, csv
sys.path.insert(0, "/home/runner/workspace")
from snowflake_connect import get_connection
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

TODAY = date.today()
YESTERDAY = TODAY - timedelta(days=1)
print(f"=== Monarch Daily Scheduler — {TODAY} ===")

def run_shopify():
    print("\n[1/5] Shopify...")
    shop = os.environ["SHOPIFY_SHOP_DOMAIN"]
    token = os.environ["SHOPIFY_ACCESS_TOKEN"]
    headers = {"X-Shopify-Access-Token": token}
    conn = get_connection(schema="COMMERCE")
    cur = conn.cursor()
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
    for d in [YESTERDAY, TODAY]:
        params = {"created_at_min": f"{d}T00:00:00-06:00", "created_at_max": f"{d}T23:59:59-06:00", "limit": 250, "status": "any"}
        orders = []
        url = f"https://{shop}/admin/api/2024-01/orders.json"
        while url:
            r = requests.get(url, headers=headers, params=params if url.endswith("orders.json") else None, timeout=30)
            orders.extend(r.json().get("orders", []))
            link = r.headers.get("Link", "")
            url = next((l.split(">")[0][1:] for l in link.split(",") if 'rel="next"' in l), None)
            params = None
        if orders:
            with open("/tmp/shopify_day.json", "w") as f:
                for o in orders:
                    f.write(json.dumps({"ID": str(o["id"]), "INGESTION_DATE": d.isoformat(), "SOURCE": "shopify", "RAW_DATA": json.dumps(o)}) + "\n")
            cur.execute("PUT file:///tmp/shopify_day.json @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
            cur.execute(f"DELETE FROM SHOPIFY_ORDERS_RAW WHERE ingestion_date='{d}'")
            cur.execute("COPY INTO SHOPIFY_ORDERS_RAW (id,ingestion_date,source,raw_data) FROM (SELECT $1:ID::STRING,$1:INGESTION_DATE::DATE,$1:SOURCE::STRING,PARSE_JSON($1:RAW_DATA::STRING) FROM @monarch_stage/shopify_day.json.gz) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'")
            print(f"  ✅ {d}: {len(orders)} orders")
    cur.close()
    conn.close()

def run_meta():
    print("\n[2/5] Meta Ads...")
    try:
        from ingestion.sources.meta_ads import run_meta_ingestion
        run_meta_ingestion(start_date=YESTERDAY.isoformat(), end_date=TODAY.isoformat())
        print("  ✅ Meta done")
    except Exception as e:
        print(f"  ❌ Meta error: {e}")

def run_google():
    print("\n[3/5] Google Ads...")
    try:
        import subprocess
        result = subprocess.run(
            ["python3", "backfill_google_ads.py"],
            capture_output=True, text=True, timeout=120
        )
        print(result.stdout[-500:] if result.stdout else "No output")
        if result.returncode == 0:
            print("  ✅ Google done")
        else:
            print(f"  ❌ Google error: {result.stderr[-200:]}")
    except Exception as e:
        print(f"  ❌ Google error: {e}")

def rebuild_summaries():
    print("\n[6/6] Rebuilding summaries...")
    os.system("python3 rebuild_with_sessions.py")
    print("  ✅ Summaries done")

def run_ga4():
    print("\n[4/5] GA4...")
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Metric, Dimension
        from google.oauth2.credentials import Credentials
        creds = Credentials(token=None,refresh_token=os.environ["GA4_REFRESH_TOKEN"],token_uri="https://oauth2.googleapis.com/token",client_id=os.environ["GOOGLE_ADS_CLIENT_ID"],client_secret=os.environ["GOOGLE_ADS_CLIENT_SECRET"])
        client = BetaAnalyticsDataClient(credentials=creds)
        request = RunReportRequest(property=f"properties/{os.environ['GA4_PROPERTY_ID']}",date_ranges=[DateRange(start_date=YESTERDAY.isoformat(),end_date=TODAY.isoformat())],metrics=[Metric(name="sessions"),Metric(name="totalUsers"),Metric(name="newUsers"),Metric(name="conversions"),Metric(name="sessionConversionRate"),Metric(name="bounceRate"),Metric(name="averageSessionDuration")],dimensions=[Dimension(name="date")])
        response = client.run_report(request)
        conn = get_connection(schema="COMMERCE")
        cur = conn.cursor()
        for row in response.rows:
            ds=row.dimension_values[0].value
            date_fmt=f"{ds[:4]}-{ds[4:6]}-{ds[6:]}"
            cur.execute("DELETE FROM GA4_DAILY_SUMMARY WHERE summary_date=%s",(date_fmt,))
            cur.execute("INSERT INTO GA4_DAILY_SUMMARY (summary_date,sessions,users,new_users,conversions,conversion_rate,bounce_rate,avg_session_duration) SELECT %s::DATE,%s,%s,%s,%s,%s,%s,%s",(date_fmt,int(row.metric_values[0].value),int(row.metric_values[1].value),int(row.metric_values[2].value),float(row.metric_values[3].value),float(row.metric_values[4].value),float(row.metric_values[5].value),float(row.metric_values[6].value)))
        cur.close()
        conn.close()
        print(f"  ✅ GA4 done: {len(response.rows)} days")
    except Exception as e:
        print(f"  ❌ GA4 error: {e}")

def run_pinterest():
    print("\n[5b/6] Pinterest Ads...")
    try:
        from ingestion.sources.pinterest_ads import run_pinterest_ingestion
        run_pinterest_ingestion(start_date=YESTERDAY.isoformat(), end_date=TODAY.isoformat())
    except Exception as e:
        print(f"  ❌ Pinterest error: {e}")

def run_target():
    print("\n[5/5] Target...")
    try:
        KW_URL="https://securesharek.target.com"
        KW_CLIENT_ID="1c9f2b24-847e-5ee6-acc4-f03c8da0cfba"
        KW_CLIENT_SECRET="2bLyg*oqja"
        KW_USERNAME="nick@gimmebeauty.com"
        KW_PASSWORD=os.environ.get("TARGET_KW_PASSWORD","TjNc030715!!")
        r=requests.post(f"{KW_URL}/oauth/token",data={"grant_type":"password","client_id":KW_CLIENT_ID,"client_secret":KW_CLIENT_SECRET,"username":KW_USERNAME,"password":KW_PASSWORD},timeout=30)
        token=r.json()["access_token"]
        r=requests.get(f"{KW_URL}/rest/folders/58077025/children",headers={"Authorization":f"Bearer {token}"},timeout=30)
        files=r.json().get("data",[])
        # Target provides weekly files - find any not yet ingested
        from datetime import timedelta
        recent_dates=[( TODAY - timedelta(days=i)).strftime("%m%d%Y") for i in range(14)]
        target_files=[f for f in files if "WEEKLY_SALES" in f.get("name","") and any(d in f.get("name","") for d in recent_dates)]
        conn=get_connection(schema="RETAIL")
        cur=conn.cursor()
        cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
        for file_info in target_files:
            r=requests.get(f"{KW_URL}/rest/files/{file_info['id']}/content",headers={"Authorization":f"Bearer {token}"},timeout=60)
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                txt_files=[n for n in z.namelist() if n.endswith(".txt")]
                if not txt_files: continue
                text=z.read(txt_files[0]).decode("utf-8",errors="replace")
            records=list(csv.DictReader(io.StringIO(text),delimiter="\t"))
            # Extract date from filename e.g. BV_7635_WEEKLY_SALES_TCIN_LOC_05092026_KW.zip
            import re
            date_match = re.search(r'(\d{8})_KW', file_info['name'])
            if date_match:
                d = date_match.group(1)
                ingestion_date = f"{d[4:8]}-{d[0:2]}-{d[2:4]}"
            else:
                ingestion_date = TODAY.isoformat()
            with open("/tmp/target_day.json","w") as f:
                for rec in records:
                    f.write(json.dumps({"ID":f"{rec.get('BARCODE_TCIN',rec.get('BARCODE',''))}_{ingestion_date}_{rec.get('LOCATION_ID','')}","INGESTION_DATE":ingestion_date,"SOURCE":"target_weekly_sales","RAW_DATA":json.dumps(rec)})+"\n")
            cur.execute("PUT file:///tmp/target_day.json @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
            cur.execute(f"DELETE FROM TARGET_POS_RAW WHERE ingestion_date='{ingestion_date}' AND source='target_weekly_sales'")
            cur.execute("COPY INTO TARGET_POS_RAW (id,ingestion_date,source,raw_data) FROM (SELECT $1:ID::STRING,$1:INGESTION_DATE::DATE,$1:SOURCE::STRING,PARSE_JSON($1:RAW_DATA::STRING) FROM @monarch_stage/target_day.json.gz) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'")
            print(f"  ✅ {file_info['name']}: {len(records)} records")
        if not target_files:
            print("  No new Target files found")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"  ❌ Target error: {e}")

def rebuild_ad_summaries():
    print("\n[6b/6] Rebuilding ad summaries...")
    from snowflake_connect import get_connection
    conn = get_connection(schema="ADS")
    cur = conn.cursor()
    cur.execute("DELETE FROM MONARCH_RAW.ADS.DAILY_AD_SUMMARY WHERE summary_date >= DATEADD(day,-3,CURRENT_DATE())")
    cur.execute("""INSERT INTO MONARCH_RAW.ADS.DAILY_AD_SUMMARY (summary_date,channel,spend,impressions,clicks,conversions,conversion_value,ctr,cpc,cpm,roas) WITH base AS (SELECT ingestion_date,SUM(raw_data:spend::FLOAT) AS spend,SUM(raw_data:impressions::INTEGER) AS impressions,SUM(raw_data:clicks::INTEGER) AS clicks FROM MONARCH_RAW.ADS.META_ADS_RAW WHERE ingestion_date>=DATEADD(day,-3,CURRENT_DATE()) GROUP BY ingestion_date),cv AS (SELECT m.ingestion_date,SUM(av.value:value::FLOAT) AS cv FROM MONARCH_RAW.ADS.META_ADS_RAW m,LATERAL FLATTEN(input=>m.raw_data:action_values,OUTER=>TRUE) av WHERE av.value:action_type::STRING='purchase' AND m.ingestion_date>=DATEADD(day,-3,CURRENT_DATE()) GROUP BY m.ingestion_date),cc AS (SELECT m.ingestion_date,SUM(a.value:value::FLOAT) AS cc FROM MONARCH_RAW.ADS.META_ADS_RAW m,LATERAL FLATTEN(input=>m.raw_data:actions,OUTER=>TRUE) a WHERE a.value:action_type::STRING='purchase' AND m.ingestion_date>=DATEADD(day,-3,CURRENT_DATE()) GROUP BY m.ingestion_date) SELECT b.ingestion_date,'meta_ads',b.spend,b.impressions,b.clicks,COALESCE(c.cc,0),COALESCE(v.cv,0),CASE WHEN b.impressions>0 THEN b.clicks/b.impressions ELSE 0 END,CASE WHEN b.clicks>0 THEN b.spend/b.clicks ELSE 0 END,CASE WHEN b.impressions>0 THEN b.spend/b.impressions*1000 ELSE 0 END,CASE WHEN b.spend>0 THEN COALESCE(v.cv,0)/b.spend ELSE 0 END FROM base b LEFT JOIN cc c ON b.ingestion_date=c.ingestion_date LEFT JOIN cv v ON b.ingestion_date=v.ingestion_date""")
    cur.execute("""INSERT INTO MONARCH_RAW.ADS.DAILY_AD_SUMMARY (summary_date,channel,spend,impressions,clicks,conversions,conversion_value,ctr,cpc,cpm,roas) SELECT ingestion_date,'google_ads',SUM(raw_data:spend::FLOAT),SUM(raw_data:impressions::INTEGER),SUM(raw_data:clicks::INTEGER),SUM(raw_data:conversions::FLOAT),SUM(raw_data:conversions_value::FLOAT),AVG(raw_data:ctr::FLOAT),AVG(raw_data:average_cpc::FLOAT),AVG(raw_data:average_cpm::FLOAT),CASE WHEN SUM(raw_data:spend::FLOAT)>0 THEN SUM(raw_data:conversions_value::FLOAT)/SUM(raw_data:spend::FLOAT) ELSE 0 END FROM MONARCH_RAW.ADS.GOOGLE_ADS_RAW WHERE ingestion_date>=DATEADD(day,-3,CURRENT_DATE()) AND raw_data:spend::FLOAT IS NOT NULL GROUP BY ingestion_date""")
    cur.execute("""INSERT INTO MONARCH_RAW.ADS.DAILY_AD_SUMMARY (summary_date,channel,spend,impressions,clicks,conversions,conversion_value,ctr,cpc,cpm,roas)
SELECT ingestion_date,'pinterest_ads',
SUM(raw_data:SPEND_IN_DOLLAR::FLOAT),
SUM(raw_data:IMPRESSION_1::INTEGER),
SUM(raw_data:CLICKTHROUGH_1::INTEGER),
SUM(raw_data:TOTAL_CONVERSIONS::FLOAT),
SUM(raw_data:TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR::FLOAT)/1000000,
CASE WHEN SUM(raw_data:IMPRESSION_1::INTEGER)>0 THEN SUM(raw_data:CLICKTHROUGH_1::INTEGER)/SUM(raw_data:IMPRESSION_1::INTEGER) ELSE 0 END,
CASE WHEN SUM(raw_data:CLICKTHROUGH_1::INTEGER)>0 THEN SUM(raw_data:SPEND_IN_DOLLAR::FLOAT)/SUM(raw_data:CLICKTHROUGH_1::INTEGER) ELSE 0 END,
CASE WHEN SUM(raw_data:IMPRESSION_1::INTEGER)>0 THEN SUM(raw_data:SPEND_IN_DOLLAR::FLOAT)/SUM(raw_data:IMPRESSION_1::INTEGER)*1000 ELSE 0 END,
CASE WHEN SUM(raw_data:SPEND_IN_DOLLAR::FLOAT)>0 THEN SUM(raw_data:TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR::FLOAT)/1000000/SUM(raw_data:SPEND_IN_DOLLAR::FLOAT) ELSE 0 END
FROM MONARCH_RAW.ADS.PINTEREST_ADS_RAW
WHERE ingestion_date>=DATEADD(day,-3,CURRENT_DATE())
GROUP BY ingestion_date""")
    cur.close()
    conn.close()
    print("  ✅ Ad summaries done")

def rebuild_shopify_products():
    print("\n[6d/6] Rebuilding Shopify product daily...")
    from snowflake_connect import get_connection
    conn = get_connection(schema="COMMERCE")
    cur = conn.cursor()
    cur.execute("DELETE FROM SHOPIFY_PRODUCT_DAILY WHERE summary_date >= DATEADD(day,-3,CURRENT_DATE())")
    cur.execute("""INSERT INTO MONARCH_RAW.COMMERCE.SHOPIFY_PRODUCT_DAILY (summary_date,product_id,title,sku,revenue,units_sold,order_count,avg_price)
SELECT DATE(CONVERT_TIMEZONE('America/Denver',o.raw_data:created_at::TIMESTAMP_TZ)) as order_date,li.value:product_id::STRING,li.value:title::STRING,li.value:sku::STRING,SUM(li.value:price::FLOAT*li.value:quantity::INTEGER),SUM(li.value:quantity::INTEGER),COUNT(DISTINCT o.id),AVG(li.value:price::FLOAT)
FROM MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_RAW o,LATERAL FLATTEN(input=>o.raw_data:line_items) li
WHERE o.raw_data:financial_status::STRING IN ('paid','partially_paid','partially_refunded')
AND DATE(CONVERT_TIMEZONE('America/Denver',o.raw_data:created_at::TIMESTAMP_TZ))>=DATEADD(day,-3,CURRENT_DATE())
GROUP BY order_date,li.value:product_id::STRING,li.value:title::STRING,li.value:sku::STRING""")
    cur.close()
    conn.close()
    print("  ✅ Shopify product daily done")

def rebuild_target_summaries():
    print("\n[6c/6] Rebuilding Target summaries...")
    from snowflake_connect import get_connection
    conn = get_connection(schema="RETAIL")
    cur = conn.cursor()
    cur.execute("DELETE FROM TARGET_DAILY_SUMMARY WHERE summary_date >= DATEADD(day,-3,CURRENT_DATE())")
    cur.execute("""INSERT INTO MONARCH_RAW.RETAIL.TARGET_DAILY_SUMMARY (summary_date,sale_amount,sale_quantity,location_count,sku_count)
SELECT ingestion_date,SUM(raw_data:SALE_AMOUNT::FLOAT),SUM(raw_data:SALE_QUANTITY::FLOAT),COUNT(DISTINCT raw_data:LOCATION_ID::STRING),COUNT(DISTINCT raw_data:BARCODE::STRING)
FROM MONARCH_RAW.RETAIL.TARGET_POS_RAW WHERE source='target_weekly_sales' AND ingestion_date>=DATEADD(day,-3,CURRENT_DATE()) GROUP BY ingestion_date""")
    cur.execute("DELETE FROM TARGET_STATE_DAILY WHERE summary_date >= DATEADD(day,-3,CURRENT_DATE())")
    cur.execute("""INSERT INTO MONARCH_RAW.RETAIL.TARGET_STATE_DAILY (summary_date,state,revenue,units_sold,store_count)
SELECT s.ingestion_date,l.state,SUM(s.raw_data:SALE_AMOUNT::FLOAT),SUM(s.raw_data:SALE_QUANTITY::FLOAT),COUNT(DISTINCT s.raw_data:LOCATION_ID::STRING)
FROM MONARCH_RAW.RETAIL.TARGET_POS_RAW s JOIN MONARCH_RAW.RETAIL.TARGET_LOCATION_MASTER l ON s.raw_data:LOCATION_ID::STRING=l.location_id
WHERE s.source='target_weekly_sales' AND s.ingestion_date>=DATEADD(day,-3,CURRENT_DATE()) GROUP BY s.ingestion_date,l.state""")
    cur.close()
    conn.close()
    print("  ✅ Target summaries done")

if __name__ == "__main__":
    run_shopify()
    run_meta()
    run_google()
    run_ga4()
    run_target()
    run_pinterest()
    rebuild_summaries()
    rebuild_ad_summaries()
    rebuild_shopify_products()
    rebuild_target_summaries()
    print("\n✅ Daily scheduler complete!")
