import os, requests, json, tempfile
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

def run_pinterest_ingestion(start_date=None, end_date=None):
    token = os.environ["PINTEREST_ACCESS_TOKEN"]
    account_id = os.environ["PINTEREST_AD_ACCOUNT_ID"]
    headers = {"Authorization": f"Bearer {token}"}

    if not start_date:
        start_date = (date.today() - timedelta(days=2)).isoformat()
    if not end_date:
        end_date = date.today().isoformat()

    print(f"Pulling Pinterest Ads {start_date} to {end_date}")

    r = requests.get(
        f"https://api.pinterest.com/v5/ad_accounts/{account_id}/analytics",
        headers=headers,
        params={
            "start_date": start_date,
            "end_date": end_date,
            "columns": "SPEND_IN_DOLLAR,IMPRESSION_1,CLICKTHROUGH_1,TOTAL_CONVERSIONS,TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR,TOTAL_ENGAGEMENT",
            "granularity": "DAY"
        }
    )

    if r.status_code != 200:
        print(f"  Error: {r.status_code} {r.text[:200]}")
        return

    records = r.json()
    if not records:
        print("  No data returned")
        return

    import sys
    sys.path.insert(0, "/home/runner/workspace")
    from snowflake_connect import get_connection
    conn = get_connection(schema="ADS")
    cur = conn.cursor()
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")

    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, dir='/tmp')
    for rec in records:
        d = rec.get("DATE", "")
        tmp.write(json.dumps({
            "ID": f"pinterest_{d}",
            "INGESTION_DATE": d,
            "SOURCE": "pinterest_ads",
            "RAW_DATA": json.dumps(rec)
        }) + "\n")
    tmp.close()

    cur.execute(f"DELETE FROM PINTEREST_ADS_RAW WHERE ingestion_date BETWEEN '{start_date}' AND '{end_date}'")
    cur.execute(f"PUT file://{tmp.name} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
    cur.execute("""COPY INTO PINTEREST_ADS_RAW (id,ingestion_date,source,raw_data)
FROM (SELECT $1:ID::STRING,$1:INGESTION_DATE::DATE,$1:SOURCE::STRING,PARSE_JSON($1:RAW_DATA::STRING)
FROM @monarch_stage) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'""")

    os.unlink(tmp.name)
    cur.close()
    conn.close()
    print(f"  ✅ {len(records)} Pinterest records written to Snowflake")

if __name__ == "__main__":
    run_pinterest_ingestion(start_date="2025-01-01", end_date=date.today().isoformat())
