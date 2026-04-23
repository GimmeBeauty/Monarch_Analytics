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

conn = _get_snowflake_connection(schema="COMMERCE")
cur = conn.cursor()
print("Rebuilding Monarch daily summary with sessions...")
cur.execute("DELETE FROM MONARCH_RAW.COMMERCE.MONARCH_DAILY_SUMMARY")
cur.execute("""
INSERT INTO MONARCH_RAW.COMMERCE.MONARCH_DAILY_SUMMARY
(summary_date,total_revenue,shopify_revenue,ad_spend,mer,blended_roas,units_sold,order_count,aov,new_customers,meta_spend,meta_roas,google_spend,google_roas,sessions,conversion_rate)
SELECT s.summary_date,s.revenue,s.revenue,COALESCE(SUM(a.spend),0),
CASE WHEN COALESCE(SUM(a.spend),0)>0 THEN s.revenue/COALESCE(SUM(a.spend),0) ELSE 0 END,
CASE WHEN COALESCE(SUM(a.spend),0)>0 THEN COALESCE(SUM(a.conversion_value),0)/COALESCE(SUM(a.spend),0) ELSE 0 END,
s.units_sold,s.order_count,s.aov,s.new_customers,
MAX(CASE WHEN a.channel='meta_ads' THEN a.spend ELSE 0 END),
MAX(CASE WHEN a.channel='meta_ads' THEN a.roas ELSE 0 END),
MAX(CASE WHEN a.channel='google_ads' THEN a.spend ELSE 0 END),
MAX(CASE WHEN a.channel='google_ads' THEN a.roas ELSE 0 END),
COALESCE(g.sessions,0),
CASE WHEN COALESCE(g.sessions,0)>0 THEN s.order_count/g.sessions ELSE 0 END
FROM MONARCH_RAW.COMMERCE.SHOPIFY_DAILY_SUMMARY s
LEFT JOIN MONARCH_RAW.ADS.DAILY_AD_SUMMARY a ON s.summary_date=a.summary_date
LEFT JOIN MONARCH_RAW.COMMERCE.GA4_DAILY_SUMMARY g ON s.summary_date=g.summary_date
GROUP BY s.summary_date,s.revenue,s.units_sold,s.order_count,s.aov,s.new_customers,g.sessions
""")
cur.execute("SELECT SUM(total_revenue),SUM(ad_spend),SUM(sessions),AVG(conversion_rate),MIN(summary_date),MAX(summary_date) FROM MONARCH_RAW.COMMERCE.MONARCH_DAILY_SUMMARY")
row = cur.fetchone()
print(f"Revenue:         ${row[0]:,.2f}")
print(f"Spend:           ${row[1]:,.2f}")
print(f"Total sessions:  {row[2]:,}")
print(f"Avg CVR:         {row[3]:.2%}")
print(f"Range:           {row[4]} to {row[5]}")
conn.close()
print("Done!")
