import json, os, warnings
import snowflake.connector
from google.ads.googleads.client import GoogleAdsClient
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
    key_path = "/home/runner/workspace/monarch_private_key.pem"
    if os.path.exists(key_path):
        with open(key_path, "rb") as f:
            pk = serialization.load_pem_private_key(f.read(), password=None, backend=default_backend())
        params["private_key"] = pk.private_bytes(encoding=serialization.Encoding.DER, format=serialization.PrivateFormat.PKCS8, encryption_algorithm=serialization.NoEncryption())
    else:
        params["password"] = os.environ["SNOWFLAKE_PASSWORD"]
    return snowflake.connector.connect(**params)

client = GoogleAdsClient.load_from_dict({"developer_token": os.environ["GOOGLE_ADS_DEVELOPER_TOKEN"],"client_id": os.environ["GOOGLE_ADS_CLIENT_ID"],"client_secret": os.environ["GOOGLE_ADS_CLIENT_SECRET"],"refresh_token": os.environ["GOOGLE_ADS_REFRESH_TOKEN"],"login_customer_id": os.environ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"],"use_proto_plus": True})
customer_id = os.environ["GOOGLE_ADS_CUSTOMER_ID"]
ga_service = client.get_service("GoogleAdsService")
conn = _get_snowflake_connection(schema="ADS")
cur = conn.cursor()
print("Connected to Snowflake")
months = [("2026-04-30","2026-05-06")]
cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
total = 0
for month_start, month_end in months:
    print(f"\nPulling {month_start} to {month_end}...")
    query = f"SELECT campaign.id,campaign.name,campaign.status,ad_group.id,ad_group.name,metrics.impressions,metrics.clicks,metrics.cost_micros,metrics.conversions,metrics.conversions_value,metrics.ctr,metrics.average_cpc,metrics.average_cpm,segments.date FROM ad_group WHERE segments.date BETWEEN '{month_start}' AND '{month_end}' AND metrics.impressions > 0"
    try:
        response = ga_service.search(customer_id=customer_id, query=query)
        records = []
        for row in response:
            records.append({"id": f"{row.ad_group.id}_{row.segments.date}","date": row.segments.date,"campaign_id": str(row.campaign.id),"campaign_name": row.campaign.name,"campaign_status": row.campaign.status.name,"ad_group_id": str(row.ad_group.id),"ad_group_name": row.ad_group.name,"impressions": row.metrics.impressions,"clicks": row.metrics.clicks,"spend": row.metrics.cost_micros / 1_000_000,"conversions": row.metrics.conversions,"conversions_value": row.metrics.conversions_value,"ctr": row.metrics.ctr,"average_cpc": row.metrics.average_cpc / 1_000_000,"average_cpm": row.metrics.average_cpm / 1_000_000})
        if records:
            with open("/tmp/google_ads_month.json", "w") as f:
                for r in records:
                    f.write(json.dumps({"ID": r["id"],"INGESTION_DATE": r["date"],"SOURCE": "google_ads","RAW_DATA": json.dumps(r)}) + "\n")
            cur.execute("PUT file:///tmp/google_ads_month.json @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
            cur.execute(f"DELETE FROM GOOGLE_ADS_RAW WHERE ingestion_date BETWEEN '{month_start}' AND '{month_end}'")
            cur.execute("COPY INTO GOOGLE_ADS_RAW (id, ingestion_date, source, raw_data) FROM (SELECT $1:ID::STRING, $1:INGESTION_DATE::DATE, $1:SOURCE::STRING, PARSE_JSON($1:RAW_DATA::STRING) FROM @monarch_stage/google_ads_month.json.gz) FILE_FORMAT = (TYPE = 'JSON') ON_ERROR = 'CONTINUE'")
            total += len(records)
            print(f"  ✅ {len(records)} records (total: {total})")
        else:
            print(f"  No data")
    except Exception as e:
        print(f"  Error: {e}")
        continue
cur.close()
conn.close()
print(f"\n✅ Google Ads backfill complete — {total} total records")
