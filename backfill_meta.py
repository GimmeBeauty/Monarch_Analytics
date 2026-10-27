import requests, json, os, warnings, time
from datetime import date, timedelta
import snowflake.connector
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
load_dotenv(dotenv_path=".env")
warnings.filterwarnings("ignore")

def _get_snowflake_connection(schema=None):
    params = dict(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "MONARCH_WH"),
        database=os.environ.get("SNOWFLAKE_DATABASE", "MONARCH_RAW"),
    )
    if schema:
        params["schema"] = schema
    key_path = os.environ.get("SNOWFLAKE_PRIVATE_KEY_PATH", "/home/runner/workspace/monarch_private_key.pem")
    if os.path.exists(key_path):
        with open(key_path, "rb") as f:
            pk = serialization.load_pem_private_key(f.read(), password=None, backend=default_backend())
        params["private_key"] = pk.private_bytes(encoding=serialization.Encoding.DER, format=serialization.PrivateFormat.PKCS8, encryption_algorithm=serialization.NoEncryption())
    else:
        params["password"] = os.environ["SNOWFLAKE_PASSWORD"]
    return snowflake.connector.connect(**params)

token = os.environ["META_ACCESS_TOKEN"]
account_id = os.environ["META_AD_ACCOUNT_ID"]
conn = _get_snowflake_connection(schema="ADS")
cur = conn.cursor()
print("Connected to Snowflake")
# Full history: month by month from 2025-01-01 through today.
_start, _end = date(2025, 1, 1), date.today()
months = []
while _start <= _end:
    _next = (_start.replace(day=1) + timedelta(days=32)).replace(day=1)
    months.append((str(_start), str(min(_next - timedelta(days=1), _end))))
    _start = _next
cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
total = 0
for month_start, month_end in months:
    print(f"\nPulling {month_start} to {month_end}...")
    params = {"access_token": token,"level": "ad","time_range": json.dumps({"since": month_start, "until": month_end}),"fields": "date_start,date_stop,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions,action_values,cost_per_action_type","action_attribution_windows": json.dumps(["1d_click","7d_click","28d_click","1d_view"]),"limit": 500,"time_increment": 1}
    records = []
    next_url = f"https://graph.facebook.com/v25.0/act_{account_id}/insights"
    first = True
    while next_url:
        for attempt in range(3):
            try:
                r = requests.get(next_url, params=params if first else {}, timeout=120)
                if r.status_code == 500:
                    print(f"  500 error retrying...")
                    time.sleep(10)
                    continue
                r.raise_for_status()
                break
            except Exception as e:
                if attempt == 2:
                    print(f"  Failed: {e}")
                    next_url = None
                time.sleep(10)
        if not next_url:
            break
        body = r.json()
        if "error" in body:
            print(f"  API error: {body['error']}")
            break
        records.extend(body.get("data", []))
        next_url = body.get("paging", {}).get("next")
        first = False
    if records:
        with open("/tmp/meta_month.json", "w") as f:
            for record in records:
                f.write(json.dumps({"ID": f"{record.get('ad_id')}_{record.get('date_start')}","INGESTION_DATE": record.get("date_start"),"SOURCE": "meta_ads","RAW_DATA": json.dumps(record)}) + "\n")
        cur.execute("PUT file:///tmp/meta_month.json @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
        cur.execute(f"DELETE FROM META_ADS_RAW WHERE ingestion_date BETWEEN '{month_start}' AND '{month_end}'")
        cur.execute("COPY INTO META_ADS_RAW (id, ingestion_date, source, raw_data) FROM (SELECT $1:ID::STRING, $1:INGESTION_DATE::DATE, $1:SOURCE::STRING, PARSE_JSON($1:RAW_DATA::STRING) FROM @monarch_stage/meta_month.json.gz) FILE_FORMAT = (TYPE = 'JSON') ON_ERROR = 'CONTINUE'")
        total += len(records)
        print(f"  ✅ {len(records)} records (total: {total})")
    else:
        print(f"  No data")
cur.close()
conn.close()
print(f"\n✅ Meta backfill complete — {total} total records")
