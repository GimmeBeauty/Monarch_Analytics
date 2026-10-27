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
# Full history from 2025-01-01 through today, or `python3 backfill_meta.py START END`.
# Half-month chunks: whole months at ad level can exceed what Meta will return ("reduce the amount of data").
import sys
_start, _end = (date.fromisoformat(sys.argv[1]), date.fromisoformat(sys.argv[2])) if len(sys.argv) == 3 else (date(2025, 1, 1), date.today())
months = []
while _start <= _end:
    _next = _start.replace(day=16) if _start.day < 16 else (_start.replace(day=1) + timedelta(days=32)).replace(day=1)
    months.append((str(_start), str(min(_next - timedelta(days=1), _end))))
    _start = _next
cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
total = 0
failed_chunks = []
for month_start, month_end in months:
    print(f"\nPulling {month_start} to {month_end}...")
    params = {"access_token": token,"level": "ad","time_range": json.dumps({"since": month_start, "until": month_end}),"fields": "date_start,date_stop,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions,action_values,cost_per_action_type","action_attribution_windows": json.dumps(["1d_click","7d_click","28d_click","1d_view"]),"limit": 500,"time_increment": 1}
    records = []
    next_url = f"https://graph.facebook.com/v25.0/act_{account_id}/insights"
    first = True
    failed = False
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
                    # Not the exception text: it includes the request URL, token and all.
                    print(f"  Failed: HTTP {getattr(getattr(e, 'response', None), 'status_code', '?')} {type(e).__name__}")
                    failed = True
                time.sleep(10)
        if failed or not r.ok:
            failed = True
            break
        body = r.json()
        if "error" in body:
            print(f"  API error: {body['error'].get('message')}")
            failed = True
            break
        records.extend(body.get("data", []))
        next_url = body.get("paging", {}).get("next")
        first = False
    # A failed pull leaves partial records; skip the chunk rather than replace it with them.
    if failed:
        failed_chunks.append((month_start, month_end))
        print(f"  ❌ Skipped — existing rows kept")
    elif records:
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
if failed_chunks:
    print(f"❌ Failed chunks (re-run with START END): {failed_chunks}")
    sys.exit(1)
