import json, os, sys, time, warnings
import requests
from datetime import date, timedelta
from dotenv import load_dotenv

sys.path.insert(0, "/home/runner/workspace")
from snowflake_connect import get_connection

load_dotenv()
warnings.filterwarnings("ignore")

API = "https://business-api.tiktok.com/open_api/v1.3"
PAGE_SIZE = 1000
CHUNK_DAYS = 30  # stat_time_day reports accept at most 30 days per request
# Missing scope / invalid token: every later chunk would fail the same way, so stop the run.
AUTH_ERROR_CODES = {40001, 40102, 40104, 40105}

# Standard (auction) campaigns -> TIKTOK_ADS_RAW. GMV Max campaigns -> TIKTOK_GMV_MAX_RAW.
# raw_data keeps each API row as returned: {"dimensions": {...}, "metrics": {...}}.
STANDARD_PARAMS = {
    "report_type": "BASIC",
    "data_level": "AUCTION_CAMPAIGN",
    "dimensions": json.dumps(["campaign_id", "stat_time_day"]),
    "metrics": json.dumps(["campaign_name", "impressions", "clicks", "spend", "cpc", "ctr", "conversion"]),
}
GMV_MAX_PARAMS = {
    # GMV Max needs 1-3 main dimensions besides the day; campaign_id is the one.
    "dimensions": json.dumps(["campaign_id", "stat_time_day"]),
    "metrics": json.dumps(["cost", "net_cost", "orders", "gross_revenue", "roi"]),
}

def _get_page(path, params, token):
    """Fetch one report page, retrying network errors, 5xx and TikTok rate-limit/server codes.
    Returns (data, None) on success or (None, "status: code N message") on failure;
    raises PermissionError on a scope/token error.
    Never formats the request, headers or exception text: the headers carry the access token."""
    error = None
    for attempt in range(5):
        if attempt:
            time.sleep(10 * 2 ** (attempt - 1))  # 10, 20, 40, 80s
        try:
            r = requests.get(f"{API}{path}", params=params, headers={"Access-Token": token}, timeout=120)
        except requests.RequestException as e:
            error = f"no response ({type(e).__name__})"
            continue
        try:
            body = r.json()
        except ValueError:
            body = {}
        code = body.get("code")
        if r.ok and code == 0:
            return body.get("data") or {}, None
        error = f"{r.status_code}: code {code} {body.get('message', 'no error message')}"
        if code in AUTH_ERROR_CODES:
            raise PermissionError(f"TikTok {path} — {error}")
        retryable = r.status_code >= 500 or code == 40100 or (isinstance(code, int) and code >= 50000)
        if not retryable:
            break  # bad params / auth won't succeed on retry
    return None, error

def _get_all(path, params, token):
    """Every row across all pages, or (None, error) if any page failed."""
    rows, page = [], 1
    while True:
        data, error = _get_page(path, {**params, "page": page, "page_size": PAGE_SIZE}, token)
        if error:
            return None, f"page {page}: {error}"
        rows.extend(data.get("list") or [])
        if page >= (data.get("page_info") or {}).get("total_page", 1):
            return rows, None
        page += 1

def _day(row):
    return (row.get("dimensions") or {}).get("stat_time_day", "")[:10]

def _stage(cur, rows, source, filename):
    with open(f"/tmp/{filename}", "w") as f:
        for row in rows:
            f.write(json.dumps({
                "ID": f"{(row.get('dimensions') or {}).get('campaign_id')}_{_day(row)}",
                "INGESTION_DATE": _day(row),
                "SOURCE": source,
                "RAW_DATA": json.dumps(row),
            }) + "\n")
    if rows:
        cur.execute(f"PUT file:///tmp/{filename} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")

def _copy(cur, table, filename):
    cur.execute(f"""
        COPY INTO {table} (id, ingestion_date, source, raw_data)
        FROM (
            SELECT $1:ID::STRING, $1:INGESTION_DATE::DATE, $1:SOURCE::STRING, PARSE_JSON($1:RAW_DATA::STRING)
            FROM @monarch_stage/{filename}.gz
        )
        FILE_FORMAT = (TYPE = 'JSON')
        ON_ERROR = 'CONTINUE'
    """)

def run_tiktok_ingestion(start_date=None, end_date=None):
    token = os.environ["TIKTOK_ADS_ACCESS_TOKEN"]
    advertiser_id = os.environ["TIKTOK_ADS_ADVERTISER_ID"]
    store_id = os.environ["TIKTOK_ADS_STORE_ID"]

    if not start_date:
        start_date = (date.today() - timedelta(days=1)).isoformat()
    if not end_date:
        end_date = start_date
    print(f"Pulling TikTok Ads (standard + GMV Max) {start_date} to {end_date}\n")

    conn = get_connection(schema="ADS")
    cur = conn.cursor()
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")

    totals, failed = {"standard": 0, "gmv_max": 0}, []
    chunk_start, last = date.fromisoformat(start_date), date.fromisoformat(end_date)
    while chunk_start <= last:
        chunk_end = min(chunk_start + timedelta(days=CHUNK_DAYS - 1), last)
        span = {"advertiser_id": advertiser_id, "start_date": str(chunk_start), "end_date": str(chunk_end)}
        standard, error = _get_all("/report/integrated/get/", {**span, **STANDARD_PARAMS}, token)
        gmv_max = None
        if not error:
            gmv_max, error = _get_all("/gmv_max/report/get/", {**span, **GMV_MAX_PARAMS, "store_ids": json.dumps([store_id])}, token)

        # A chunk is only replaced in Snowflake once every page of both reports arrived.
        if error:
            failed.append(f"{chunk_start}..{chunk_end}")
            print(f"  ⚠️  WARNING: TikTok {chunk_start}..{chunk_end} skipped, existing rows kept — {error}")
        else:
            _stage(cur, standard, "tiktok_ads", "tiktok_ads.json")
            _stage(cur, gmv_max, "tiktok_gmv_max", "tiktok_gmv_max.json")
            cur.execute("BEGIN")
            cur.execute(f"DELETE FROM TIKTOK_ADS_RAW WHERE ingestion_date BETWEEN '{chunk_start}' AND '{chunk_end}'")
            cur.execute(f"DELETE FROM TIKTOK_GMV_MAX_RAW WHERE ingestion_date BETWEEN '{chunk_start}' AND '{chunk_end}'")
            if standard:
                _copy(cur, "TIKTOK_ADS_RAW", "tiktok_ads.json")
            if gmv_max:
                _copy(cur, "TIKTOK_GMV_MAX_RAW", "tiktok_gmv_max.json")
            cur.execute("COMMIT")
            totals["standard"] += len(standard)
            totals["gmv_max"] += len(gmv_max)
            print(f"  ✅ {chunk_start}..{chunk_end}: {len(standard)} standard, {len(gmv_max)} GMV Max rows")
        chunk_start = chunk_end + timedelta(days=1)

    print(f"✅ TikTok rows written: {totals['standard']} standard, {totals['gmv_max']} GMV Max")
    if failed:
        print(f"⚠️  WARNING: {len(failed)} TikTok chunk(s) skipped, existing rows kept: {', '.join(failed)}")
    cur.close()
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) == 3:
        run_tiktok_ingestion(start_date=sys.argv[1], end_date=sys.argv[2])
    else:
        run_tiktok_ingestion()
