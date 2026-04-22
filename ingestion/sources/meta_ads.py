import requests, json, os, warnings
import snowflake.connector
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()
warnings.filterwarnings("ignore")

def run_meta_ingestion(start_date=None, end_date=None):
    token = os.environ["META_ACCESS_TOKEN"]
    account_id = os.environ["META_AD_ACCOUNT_ID"]

    conn = snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        database=os.environ["SNOWFLAKE_DATABASE"],
        schema="ADS",
    )
    cur = conn.cursor()
    print("Connected to Snowflake")

    if not start_date:
        start_date = (date.today() - timedelta(days=1)).isoformat()
    if not end_date:
        end_date = start_date

    print(f"Pulling Meta Ads {start_date} to {end_date}\n")

    # Pull all insights at ad level
    url = f"https://graph.facebook.com/v19.0/act_{account_id}/insights"
    params = {
        "access_token": token,
        "level": "ad",
        "time_range": json.dumps({"since": start_date, "until": end_date}),
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
        "limit": 500,
        "time_increment": 1,
    }

    records = []
    next_url = url
    while next_url:
        r = requests.get(next_url, params=params if next_url == url else {}, timeout=30)
        r.raise_for_status()
        body = r.json()
        if "error" in body:
            print(f"Meta API error: {body['error']}")
            break
        records.extend(body.get("data", []))
        next_url = body.get("paging", {}).get("next")
        params = {}

    print(f"Fetched {len(records)} ad records — writing to file...")

    # Write all records to file first
    with open("/tmp/meta_ads.json", "w") as f:
        for record in records:
            record_id = f"{record.get('ad_id')}_{record.get('date_start')}"
            f.write(json.dumps({
                "ID": record_id,
                "INGESTION_DATE": record.get("date_start"),
                "SOURCE": "meta_ads",
                "RAW_DATA": json.dumps(record),
            }) + "\n")

    # Bulk load into Snowflake
    print("Uploading to Snowflake...")
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
    cur.execute("PUT file:///tmp/meta_ads.json @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")

    cur.execute(f"DELETE FROM META_ADS_RAW WHERE ingestion_date BETWEEN '{start_date}' AND '{end_date}'")
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

    print(f"✅ {len(records)} Meta ad records written to Snowflake")
    cur.close()
    conn.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) == 3:
        run_meta_ingestion(start_date=sys.argv[1], end_date=sys.argv[2])
    else:
        run_meta_ingestion()
