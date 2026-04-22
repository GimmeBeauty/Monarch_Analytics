import requests, json, os, warnings, time
import snowflake.connector
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")
warnings.filterwarnings("ignore")
token = "EAAST61QHyfQBRZAqRdoxcrXD0K2x7qZC2ZB4MD7arMJK9xB4wmhwPO0XtFMxqb47zWIYzdEuNlmg3IcWNgnEZApZBIdOeVZBGlx4JrDyqXl9y9NCPE25xKZCxvhX74n2u3bPHaHXotHM98i9MIXaLrTYRXwI3XOm2JkBHMoLisWQsXrHZBT7Xvh6Ub7MCnS58ZAdOkAZDZD"
account_id = "10152407382101579"
conn = snowflake.connector.connect(account=os.environ["SNOWFLAKE_ACCOUNT"],user=os.environ["SNOWFLAKE_USER"],password=os.environ["SNOWFLAKE_PASSWORD"],warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],database=os.environ["SNOWFLAKE_DATABASE"],schema="ADS")
cur = conn.cursor()
print("Connected to Snowflake")
months = [("2025-02-01","2025-02-28"),("2025-03-01","2025-03-31"),("2025-04-01","2025-04-30"),("2025-05-01","2025-05-31"),("2025-06-01","2025-06-30"),("2025-07-01","2025-07-31"),("2025-08-01","2025-08-31"),("2025-09-01","2025-09-30"),("2025-10-01","2025-10-31"),("2025-11-01","2025-11-30"),("2025-12-01","2025-12-31"),("2026-01-01","2026-01-31"),("2026-02-01","2026-02-28"),("2026-03-01","2026-03-31"),("2026-04-01","2026-04-20")]
cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
total = 0
for month_start, month_end in months:
    print(f"\nPulling {month_start} to {month_end}...")
    params = {"access_token": token,"level": "ad","time_range": json.dumps({"since": month_start, "until": month_end}),"fields": "date_start,date_stop,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,reach,frequency,cpc,cpm,ctr,actions,action_values,cost_per_action_type","limit": 500,"time_increment": 1}
    records = []
    next_url = f"https://graph.facebook.com/v19.0/act_{account_id}/insights"
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
