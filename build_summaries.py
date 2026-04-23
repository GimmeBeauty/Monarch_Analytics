import json, os, warnings
import snowflake.connector
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

conn = _get_snowflake_connection()
cur = conn.cursor()
print("Connected to Snowflake")
print("\nClearing summaries...")
cur.execute("DELETE FROM MONARCH_RAW.ADS.DAILY_AD_SUMMARY")
cur.execute("DELETE FROM MONARCH_RAW.COMMERCE.SHOPIFY_DAILY_SUMMARY")
cur.execute("DELETE FROM MONARCH_RAW.COMMERCE.SHOPIFY_PRODUCT_DAILY")
cur.execute("DELETE FROM MONARCH_RAW.COMMERCE.SHOPIFY_GEO_DAILY")
cur.execute("DELETE FROM MONARCH_RAW.COMMERCE.MONARCH_DAILY_SUMMARY")
print("Done")
print("\nBuilding Meta summary...")
cur.execute("INSERT INTO MONARCH_RAW.ADS.DAILY_AD_SUMMARY (summary_date,channel,spend,impressions,clicks,conversions,conversion_value,ctr,cpc,cpm,roas) SELECT ingestion_date,'meta_ads',SUM(raw_data:spend::FLOAT),SUM(raw_data:impressions::INTEGER),SUM(raw_data:clicks::INTEGER),SUM(CASE WHEN a.value:action_type::STRING='purchase' THEN a.value:value::FLOAT ELSE 0 END),SUM(CASE WHEN av.value:action_type::STRING='purchase' THEN av.value:value::FLOAT ELSE 0 END),CASE WHEN SUM(raw_data:impressions::INTEGER)>0 THEN SUM(raw_data:clicks::INTEGER)/SUM(raw_data:impressions::INTEGER) ELSE 0 END,CASE WHEN SUM(raw_data:clicks::INTEGER)>0 THEN SUM(raw_data:spend::FLOAT)/SUM(raw_data:clicks::INTEGER) ELSE 0 END,CASE WHEN SUM(raw_data:impressions::INTEGER)>0 THEN SUM(raw_data:spend::FLOAT)/SUM(raw_data:impressions::INTEGER)*1000 ELSE 0 END,CASE WHEN SUM(raw_data:spend::FLOAT)>0 THEN SUM(CASE WHEN av.value:action_type::STRING='purchase' THEN av.value:value::FLOAT ELSE 0 END)/SUM(raw_data:spend::FLOAT) ELSE 0 END FROM MONARCH_RAW.ADS.META_ADS_RAW,LATERAL FLATTEN(input=>raw_data:actions,OUTER=>TRUE) a,LATERAL FLATTEN(input=>raw_data:action_values,OUTER=>TRUE) av GROUP BY ingestion_date")
print("Done")
print("\nBuilding Google summary...")
cur.execute("INSERT INTO MONARCH_RAW.ADS.DAILY_AD_SUMMARY (summary_date,channel,spend,impressions,clicks,conversions,conversion_value,ctr,cpc,cpm,roas) SELECT ingestion_date,'google_ads',SUM(raw_data:spend::FLOAT),SUM(raw_data:impressions::INTEGER),SUM(raw_data:clicks::INTEGER),SUM(raw_data:conversions::FLOAT),SUM(raw_data:conversions_value::FLOAT),CASE WHEN SUM(raw_data:impressions::INTEGER)>0 THEN SUM(raw_data:clicks::INTEGER)/SUM(raw_data:impressions::INTEGER) ELSE 0 END,CASE WHEN SUM(raw_data:clicks::INTEGER)>0 THEN SUM(raw_data:spend::FLOAT)/SUM(raw_data:clicks::INTEGER) ELSE 0 END,CASE WHEN SUM(raw_data:impressions::INTEGER)>0 THEN SUM(raw_data:spend::FLOAT)/SUM(raw_data:impressions::INTEGER)*1000 ELSE 0 END,CASE WHEN SUM(raw_data:spend::FLOAT)>0 THEN SUM(raw_data:conversions_value::FLOAT)/SUM(raw_data:spend::FLOAT) ELSE 0 END FROM MONARCH_RAW.ADS.GOOGLE_ADS_RAW GROUP BY ingestion_date")
print("Done")
print("\nBuilding Shopify daily summary...")
cur.execute("INSERT INTO MONARCH_RAW.COMMERCE.SHOPIFY_DAILY_SUMMARY (summary_date,revenue,net_revenue,units_sold,order_count,aov,new_customers,returning_customers,refunds,discounts) SELECT ingestion_date,SUM(raw_data:total_price::FLOAT),SUM(raw_data:current_total_price::FLOAT),SUM(li.value:quantity::INTEGER),COUNT(DISTINCT raw_data:id::STRING),CASE WHEN COUNT(DISTINCT raw_data:id::STRING)>0 THEN SUM(raw_data:total_price::FLOAT)/COUNT(DISTINCT raw_data:id::STRING) ELSE 0 END,SUM(CASE WHEN raw_data:customer:orders_count::INTEGER=1 THEN 1 ELSE 0 END),SUM(CASE WHEN raw_data:customer:orders_count::INTEGER>1 THEN 1 ELSE 0 END),SUM(raw_data:total_price::FLOAT-raw_data:current_total_price::FLOAT),SUM(raw_data:total_discounts::FLOAT) FROM MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_RAW,LATERAL FLATTEN(input=>raw_data:line_items,OUTER=>TRUE) li WHERE raw_data:financial_status::STRING IN ('paid','partially_paid','partially_refunded') GROUP BY ingestion_date")
print("Done")
print("\nBuilding product summary...")
cur.execute("INSERT INTO MONARCH_RAW.COMMERCE.SHOPIFY_PRODUCT_DAILY (summary_date,product_id,title,sku,revenue,units_sold,order_count,avg_price) SELECT ingestion_date,li.value:product_id::STRING,li.value:title::STRING,li.value:sku::STRING,SUM(li.value:quantity::INTEGER*li.value:price::FLOAT),SUM(li.value:quantity::INTEGER),COUNT(DISTINCT raw_data:id::STRING),AVG(li.value:price::FLOAT) FROM MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_RAW,LATERAL FLATTEN(input=>raw_data:line_items) li WHERE raw_data:financial_status::STRING IN ('paid','partially_paid','partially_refunded') GROUP BY ingestion_date,li.value:product_id::STRING,li.value:title::STRING,li.value:sku::STRING")
print("Done")
print("\nBuilding geo summary...")
cur.execute("INSERT INTO MONARCH_RAW.COMMERCE.SHOPIFY_GEO_DAILY (summary_date,state,country,revenue,order_count,units_sold) SELECT ingestion_date,raw_data:shipping_address:province_code::STRING,raw_data:shipping_address:country_code::STRING,SUM(raw_data:total_price::FLOAT),COUNT(DISTINCT raw_data:id::STRING),SUM(li.value:quantity::INTEGER) FROM MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_RAW,LATERAL FLATTEN(input=>raw_data:line_items,OUTER=>TRUE) li WHERE raw_data:financial_status::STRING IN ('paid','partially_paid','partially_refunded') GROUP BY ingestion_date,raw_data:shipping_address:province_code::STRING,raw_data:shipping_address:country_code::STRING")
print("Done")
print("\nBuilding Monarch daily summary...")
cur.execute("INSERT INTO MONARCH_RAW.COMMERCE.MONARCH_DAILY_SUMMARY (summary_date,total_revenue,shopify_revenue,ad_spend,mer,blended_roas,units_sold,order_count,aov,new_customers,meta_spend,meta_roas,google_spend,google_roas) SELECT s.summary_date,s.revenue,s.revenue,COALESCE(SUM(a.spend),0),CASE WHEN COALESCE(SUM(a.spend),0)>0 THEN s.revenue/COALESCE(SUM(a.spend),0) ELSE 0 END,CASE WHEN COALESCE(SUM(a.spend),0)>0 THEN COALESCE(SUM(a.conversion_value),0)/COALESCE(SUM(a.spend),0) ELSE 0 END,s.units_sold,s.order_count,s.aov,s.new_customers,MAX(CASE WHEN a.channel='meta_ads' THEN a.spend ELSE 0 END),MAX(CASE WHEN a.channel='meta_ads' THEN a.roas ELSE 0 END),MAX(CASE WHEN a.channel='google_ads' THEN a.spend ELSE 0 END),MAX(CASE WHEN a.channel='google_ads' THEN a.roas ELSE 0 END) FROM MONARCH_RAW.COMMERCE.SHOPIFY_DAILY_SUMMARY s LEFT JOIN MONARCH_RAW.ADS.DAILY_AD_SUMMARY a ON s.summary_date=a.summary_date GROUP BY s.summary_date,s.revenue,s.units_sold,s.order_count,s.aov,s.new_customers")
print("Done")
for t,n in [("MONARCH_RAW.ADS.DAILY_AD_SUMMARY","Ad summary"),("MONARCH_RAW.COMMERCE.SHOPIFY_DAILY_SUMMARY","Shopify daily"),("MONARCH_RAW.COMMERCE.SHOPIFY_PRODUCT_DAILY","Product daily"),("MONARCH_RAW.COMMERCE.SHOPIFY_GEO_DAILY","Geographic"),("MONARCH_RAW.COMMERCE.MONARCH_DAILY_SUMMARY","Monarch daily")]:
    cur.execute(f"SELECT COUNT(*),MIN(summary_date),MAX(summary_date) FROM {t}")
    r=cur.fetchone()
    print(f"  {n}: {r[0]} rows ({r[1]} to {r[2]})")
cur.close()
conn.close()
print("\n✅ All summary tables built!")
