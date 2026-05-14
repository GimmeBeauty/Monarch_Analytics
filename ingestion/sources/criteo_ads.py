import os, requests, json, tempfile, time
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

def get_criteo_token():
    r = requests.post("https://api.criteo.com/oauth2/token",
        data={"grant_type":"client_credentials",
              "client_id": os.environ["CRITEO_CLIENT_ID"],
              "client_secret": os.environ["CRITEO_CLIENT_SECRET"]})
    return r.json()["access_token"]

def run_criteo_ingestion(start_date=None, end_date=None):
    if not start_date:
        start_date = (date.today() - timedelta(days=2)).isoformat()
    if not end_date:
        end_date = date.today().isoformat()
    print(f"Pulling Criteo Ads {start_date} to {end_date}")
    token = get_criteo_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    account_id = os.environ["CRITEO_ADVERTISER_ID"]
    r = requests.get(f"https://api.criteo.com/2025-01/retail-media/accounts/{account_id}/campaigns", headers=headers)
    campaigns = [c["id"] for c in r.json().get("data", [])]
    if not campaigns:
        print("  No campaigns found"); return
    r = requests.post("https://api.criteo.com/2025-01/retail-media/reports/campaigns",
        headers=headers,
        json={"data": {"type": "RetailMediaReportRequest", "attributes": {
            "reportType": "summary", "startDate": start_date, "endDate": end_date,
            "timeGranularity": "daily", "ids": campaigns}}})
    report_id = r.json()["data"]["id"]
    for _ in range(20):
        r = requests.get(f"https://api.criteo.com/2025-01/retail-media/reports/{report_id}/status", headers=headers)
        status = r.json().get("data", {}).get("attributes", {}).get("status")
        if status == "success": break
        elif status == "failed": print("  Report failed"); return
        time.sleep(3)
    r = requests.get(f"https://api.criteo.com/2025-01/retail-media/reports/{report_id}/output", headers=headers)
    report = r.json()
    columns = report["columns"]; rows = report["data"]
    if not rows: print("  No data"); return
    import sys; sys.path.insert(0, "/home/runner/workspace")
    from snowflake_connect import get_connection
    conn = get_connection(schema="ADS"); cur = conn.cursor()
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, dir='/tmp')
    for row in rows:
        rec = dict(zip(columns, row)); d = rec.get("date", "")
        tmp.write(json.dumps({"ID": f"criteo_{rec.get('campaignId','')}_{d}", "INGESTION_DATE": d, "SOURCE": "criteo_ads", "RAW_DATA": json.dumps(rec)}) + "\n")
    tmp.close()
    cur.execute(f"DELETE FROM CRITEO_ADS_RAW WHERE ingestion_date BETWEEN '{start_date}' AND '{end_date}'")
    cur.execute(f"PUT file://{tmp.name} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
    cur.execute("COPY INTO CRITEO_ADS_RAW (id,ingestion_date,source,raw_data) FROM (SELECT $1:ID::STRING,$1:INGESTION_DATE::DATE,$1:SOURCE::STRING,PARSE_JSON($1:RAW_DATA::STRING) FROM @monarch_stage) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'")
    os.unlink(tmp.name); cur.close(); conn.close()
    print(f"  ✅ {len(rows)} Criteo records written to Snowflake")

if __name__ == "__main__":
    run_criteo_ingestion(start_date="2025-01-07", end_date=date.today().isoformat())
