import requests, json, os, time, tempfile, sys
from datetime import date
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")
sys.path.insert(0, "/home/runner/workspace")
from snowflake_connect import get_connection

CLIENT_ID = os.environ["CRITEO_CLIENT_ID"]
CLIENT_SECRET = os.environ["CRITEO_CLIENT_SECRET"]

def get_token():
    r = requests.post("https://api.criteo.com/oauth2/token",
        data={"grant_type":"client_credentials","client_id":CLIENT_ID,"client_secret":CLIENT_SECRET})
    return r.json()["access_token"]

def pull_chunk(start, end, campaigns, headers):
    r = requests.post("https://api.criteo.com/2025-01/retail-media/reports/campaigns",
        headers=headers,
        json={"data": {"type": "RetailMediaReportRequest", "attributes": {
            "reportType": "summary","startDate": start,"endDate": end,
            "timeGranularity": "daily","ids": campaigns}}})
    if r.status_code != 200:
        print(f"  Error {r.status_code}: {r.text[:100]}"); return None
    report_id = r.json()["data"]["id"]
    for _ in range(20):
        r2 = requests.get(f"https://api.criteo.com/2025-01/retail-media/reports/{report_id}/status", headers=headers)
        status = r2.json().get("data",{}).get("attributes",{}).get("status")
        if status == "success":
            return requests.get(f"https://api.criteo.com/2025-01/retail-media/reports/{report_id}/output", headers=headers).json()
        elif status == "failed": return None
        time.sleep(3)
    return None

token = get_token()
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
campaigns = ["664510443236810752"]
chunks = [("2025-01-07","2025-04-06"),("2025-04-07","2025-07-05"),("2025-07-06","2025-10-03"),("2025-10-04","2026-01-01"),("2026-01-02","2026-03-01"),("2026-03-02",date.today().isoformat())]

conn = get_connection(schema="ADS")
cur = conn.cursor()
cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
cur.execute("DELETE FROM MONARCH_RAW.ADS.CRITEO_ADS_RAW")
total = 0

for start, end in chunks:
    print(f"Pulling {start} to {end}...")
    result = pull_chunk(start, end, campaigns, headers)
    if not result or not result.get("data"):
        print(f"  No data"); continue
    columns = result["columns"]; rows = result["data"]
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, dir='/home/runner/workspace')
    for row in rows:
        rec = dict(zip(columns, row)); d = rec.get("date","")
        tmp.write(json.dumps({"ID":f"criteo_{rec.get('campaignId','')}_{d}","INGESTION_DATE":d,"SOURCE":"criteo_ads","RAW_DATA":json.dumps(rec)})+"\n")
    tmp.close()
    cur.execute(f"PUT file://{tmp.name} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
    cur.execute("COPY INTO MONARCH_RAW.ADS.CRITEO_ADS_RAW (id,ingestion_date,source,raw_data) FROM (SELECT $1:ID::STRING,$1:INGESTION_DATE::DATE,$1:SOURCE::STRING,PARSE_JSON($1:RAW_DATA::STRING) FROM @monarch_stage) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'")
    os.unlink(tmp.name); total += len(rows)
    print(f"  ✅ {len(rows)} rows (total: {total})")

cur.execute("SELECT COUNT(*), MIN(ingestion_date), MAX(ingestion_date), SUM(raw_data:spend::FLOAT) FROM MONARCH_RAW.ADS.CRITEO_ADS_RAW")
row = cur.fetchone()
print(f"\nFinal: {row[0]} rows, {row[1]} to {row[2]}, ${row[3]:,.2f} spend")
cur.close(); conn.close()
print("✅ Done!")
