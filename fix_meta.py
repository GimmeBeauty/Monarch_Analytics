import snowflake.connector, os, warnings
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

conn = _get_snowflake_connection(schema="ADS")
cur = conn.cursor()
cur.execute("DELETE FROM MONARCH_RAW.ADS.DAILY_AD_SUMMARY WHERE channel='meta_ads'")
cur.execute("CREATE OR REPLACE TEMP TABLE meta_base AS SELECT ingestion_date,SUM(raw_data:spend::FLOAT) AS spend,SUM(raw_data:impressions::INTEGER) AS impressions,SUM(raw_data:clicks::INTEGER) AS clicks FROM MONARCH_RAW.ADS.META_ADS_RAW GROUP BY ingestion_date")
cur.execute("CREATE OR REPLACE TEMP TABLE meta_cv AS SELECT m.ingestion_date,SUM(av.value:value::FLOAT) AS cv FROM MONARCH_RAW.ADS.META_ADS_RAW m,LATERAL FLATTEN(input=>m.raw_data:action_values,OUTER=>TRUE) av WHERE av.value:action_type::STRING='purchase' GROUP BY m.ingestion_date")
cur.execute("CREATE OR REPLACE TEMP TABLE meta_cc AS SELECT m.ingestion_date,SUM(a.value:value::FLOAT) AS cc FROM MONARCH_RAW.ADS.META_ADS_RAW m,LATERAL FLATTEN(input=>m.raw_data:actions,OUTER=>TRUE) a WHERE a.value:action_type::STRING='purchase' GROUP BY m.ingestion_date")
cur.execute("INSERT INTO MONARCH_RAW.ADS.DAILY_AD_SUMMARY (summary_date,channel,spend,impressions,clicks,conversions,conversion_value,ctr,cpc,cpm,roas) SELECT b.ingestion_date,'meta_ads',b.spend,b.impressions,b.clicks,COALESCE(c.cc,0),COALESCE(v.cv,0),CASE WHEN b.impressions>0 THEN b.clicks/b.impressions ELSE 0 END,CASE WHEN b.clicks>0 THEN b.spend/b.clicks ELSE 0 END,CASE WHEN b.impressions>0 THEN b.spend/b.impressions*1000 ELSE 0 END,CASE WHEN b.spend>0 THEN COALESCE(v.cv,0)/b.spend ELSE 0 END FROM meta_base b LEFT JOIN meta_cc c ON b.ingestion_date=c.ingestion_date LEFT JOIN meta_cv v ON b.ingestion_date=v.ingestion_date")
cur.execute("SELECT SUM(spend),SUM(conversion_value),CASE WHEN SUM(spend)>0 THEN SUM(conversion_value)/SUM(spend) ELSE 0 END FROM MONARCH_RAW.ADS.DAILY_AD_SUMMARY WHERE channel='meta_ads' AND summary_date>=DATEADD(day,-30,CURRENT_DATE())")
row = cur.fetchone()
print(f"Spend: ${row[0]:,.2f}, Conv value: ${row[1]:,.2f}, ROAS: {row[2]:.2f}x")
conn.close()
