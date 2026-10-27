import requests, json, os, time, warnings
import snowflake.connector
from datetime import date, timedelta
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

load_dotenv()
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

def _get_page(url, params):
    """Fetch one insights page, retrying 5xx/network errors with backoff.
    Returns (body, None) on success or (None, "status: Meta error.message") on failure.
    Never formats the request or exception text: both carry the URL and access token."""
    error = None
    for attempt in range(5):
        if attempt:
            time.sleep(10 * 2 ** (attempt - 1))  # 10, 20, 40, 80s
        try:
            r = requests.get(url, params=params, timeout=120)
        except requests.RequestException as e:
            error = f"no response ({type(e).__name__})"
            continue
        try:
            body = r.json()
        except ValueError:
            body = {}
        if r.ok and "error" not in body:
            return body, None
        error = f"{r.status_code}: {body.get('error', {}).get('message', 'no error message')}"
        if r.status_code < 500:
            break  # 4xx won't succeed on retry
    return None, error

def run_meta_ingestion(start_date=None, end_date=None):
    token = os.environ["META_ACCESS_TOKEN"]
    account_id = os.environ["META_AD_ACCOUNT_ID"]

    conn = _get_snowflake_connection(schema="ADS")
    cur = conn.cursor()
    print("Connected to Snowflake")

    if not start_date:
        start_date = (date.today() - timedelta(days=1)).isoformat()
    if not end_date:
        end_date = start_date

    print(f"Pulling Meta Ads {start_date} to {end_date}\n")

    # Ad level with four attribution windows is too heavy for one 31-day request (Meta 500s),
    # so pull 7-day chunks. A chunk is only replaced in Snowflake once all its pages arrived.
    url = f"https://graph.facebook.com/v25.0/act_{account_id}/insights"
    params = {
        "access_token": token,
        "level": "ad",
        "fields": (
            "date_start,date_stop,"
            "ad_id,ad_name,"
            "adset_id,adset_name,"
            "campaign_id,campaign_name,"
            "spend,impressions,clicks,reach,frequency,"
            "cpc,cpm,ctr,cpp,"
            "actions,action_values,"
            "cost_per_action_type,"
            "video_avg_time_watched_actions,"
            "video_p25_watched_actions,"
            "video_p50_watched_actions,"
            "video_p75_watched_actions,"
            "video_p100_watched_actions"
        ),
        # Per-window breakdowns land alongside the default "value" (7d click + 1d view)
        "action_attribution_windows": json.dumps(["1d_click", "7d_click", "28d_click", "1d_view"]),
        "limit": 500,
        "time_increment": 1,
    }

    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
    total, failed = 0, []
    chunk_start, last = date.fromisoformat(start_date), date.fromisoformat(end_date)
    while chunk_start <= last:
        chunk_end = min(chunk_start + timedelta(days=6), last)
        page_params = {**params, "time_range": json.dumps({"since": str(chunk_start), "until": str(chunk_end)})}
        records, next_url, error = [], url, None
        while next_url:
            body, error = _get_page(next_url, page_params)
            if error:
                break
            records.extend(body.get("data", []))
            next_url = body.get("paging", {}).get("next")
            page_params = None  # paging.next already carries every parameter

        if error:
            failed.append(f"{chunk_start}..{chunk_end}")
            print(f"  ⚠️  WARNING: Meta {chunk_start}..{chunk_end} skipped, existing rows kept — {error}")
        else:
            with open("/tmp/meta_ads.json", "w") as f:
                for record in records:
                    f.write(json.dumps({
                        "ID": f"{record.get('ad_id')}_{record.get('date_start')}",
                        "INGESTION_DATE": record.get("date_start"),
                        "SOURCE": "meta_ads",
                        "RAW_DATA": json.dumps(record),
                    }) + "\n")
            if records:
                cur.execute("PUT file:///tmp/meta_ads.json @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
            cur.execute("BEGIN")
            cur.execute(f"DELETE FROM META_ADS_RAW WHERE ingestion_date BETWEEN '{chunk_start}' AND '{chunk_end}'")
            if records:
                cur.execute("""
                    COPY INTO META_ADS_RAW (id, ingestion_date, source, raw_data)
                    FROM (
                        SELECT
                            $1:ID::STRING,
                            $1:INGESTION_DATE::DATE,
                            $1:SOURCE::STRING,
                            PARSE_JSON($1:RAW_DATA::STRING)
                        FROM @monarch_stage/meta_ads.json.gz
                    )
                    FILE_FORMAT = (TYPE = 'JSON')
                    ON_ERROR = 'CONTINUE'
                """)
            cur.execute("COMMIT")
            total += len(records)
            print(f"  ✅ {chunk_start}..{chunk_end}: {len(records)} ad records")
        chunk_start = chunk_end + timedelta(days=1)

    print(f"✅ {total} Meta ad records written to Snowflake")
    if failed:
        print(f"⚠️  WARNING: {len(failed)} Meta chunk(s) skipped, existing rows kept: {', '.join(failed)}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) == 3:
        run_meta_ingestion(start_date=sys.argv[1], end_date=sys.argv[2])
    else:
        run_meta_ingestion()
