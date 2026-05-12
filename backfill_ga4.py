import json, os, warnings
import snowflake.connector
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
load_dotenv(dotenv_path=".env")
warnings.filterwarnings("ignore")
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import RunReportRequest, DateRange, Metric, Dimension
from google.oauth2.credentials import Credentials

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

creds = Credentials(
    token=None,
    refresh_token=os.environ["GA4_REFRESH_TOKEN"],
    token_uri="https://oauth2.googleapis.com/token",
    client_id=os.environ["GOOGLE_ADS_CLIENT_ID"],
    client_secret=os.environ["GOOGLE_ADS_CLIENT_SECRET"],
)
client = BetaAnalyticsDataClient(credentials=creds)
property_id = os.environ["GA4_PROPERTY_ID"]

conn = _get_snowflake_connection(schema="COMMERCE")
cur = conn.cursor()
print("Connected to Snowflake")
print("Pulling GA4 data Jan 2025 to today...")
request = RunReportRequest(
    property=f"properties/{property_id}",
    date_ranges=[DateRange(start_date="2025-01-01", end_date="2026-04-29")],
    metrics=[
        Metric(name="sessions"),
        Metric(name="totalUsers"),
        Metric(name="newUsers"),
        Metric(name="conversions"),
        Metric(name="sessionConversionRate"),
        Metric(name="bounceRate"),
        Metric(name="averageSessionDuration"),
    ],
    dimensions=[Dimension(name="date")],
)
response = client.run_report(request)
print(f"Got {len(response.rows)} days of data")

cur.execute("DELETE FROM MONARCH_RAW.COMMERCE.GA4_DAILY_SUMMARY")
for row in response.rows:
    date_str = row.dimension_values[0].value
    date_fmt = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
    cur.execute(
        "INSERT INTO MONARCH_RAW.COMMERCE.GA4_DAILY_SUMMARY (summary_date,sessions,users,new_users,conversions,conversion_rate,bounce_rate,avg_session_duration) SELECT %s::DATE,%s,%s,%s,%s,%s,%s,%s",
        (date_fmt, int(row.metric_values[0].value), int(row.metric_values[1].value),
         int(row.metric_values[2].value), float(row.metric_values[3].value),
         float(row.metric_values[4].value), float(row.metric_values[5].value),
         float(row.metric_values[6].value))
    )

cur.execute("SELECT COUNT(*), SUM(sessions), MIN(summary_date), MAX(summary_date) FROM MONARCH_RAW.COMMERCE.GA4_DAILY_SUMMARY")
row = cur.fetchone()
print(f"Days: {row[0]}, Total sessions: {row[1]:,}, Range: {row[2]} to {row[3]}")
cur.close()
conn.close()
print("GA4 backfill complete!")
