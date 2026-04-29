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
            ["python3", "/home/runner/workspace/backfill_google_ads.py"],
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
    os.system("python3 /home/runner/workspace/rebuild_with_sessions.py")
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
        today_str=TODAY.strftime("%m%d%Y")
        yesterday_str=YESTERDAY.strftime("%m%d%Y")
        target_files=[f for f in files if "DAILY_SALES" in f.get("name","") and (today_str in f.get("name","") or yesterday_str in f.get("name",""))]
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
            ingestion_date=TODAY.isoformat()
            with open("/tmp/target_day.json","w") as f:
                for rec in records:
                    f.write(json.dumps({"ID":f"{rec.get('BARCODE_TCIN',rec.get('BARCODE',''))}_{ingestion_date}_{rec.get('LOCATION_ID','')}","INGESTION_DATE":ingestion_date,"SOURCE":"target_daily_sales","RAW_DATA":json.dumps(rec)})+"\n")
            cur.execute("PUT file:///tmp/target_day.json @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
            cur.execute(f"DELETE FROM TARGET_POS_RAW WHERE ingestion_date='{ingestion_date}' AND source='target_daily_sales'")
            cur.execute("COPY INTO TARGET_POS_RAW (id,ingestion_date,source,raw_data) FROM (SELECT $1:ID::STRING,$1:INGESTION_DATE::DATE,$1:SOURCE::STRING,PARSE_JSON($1:RAW_DATA::STRING) FROM @monarch_stage/target_day.json.gz) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'")
            print(f"  ✅ {file_info['name']}: {len(records)} records")
        if not target_files:
            print("  No new Target files found")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"  ❌ Target error: {e}")

if __name__ == "__main__":
    run_shopify()
    run_meta()
    run_google()
    run_ga4()
    run_target()
    rebuild_summaries()
    print("\n✅ Daily scheduler complete!")
