import requests, snowflake.connector, os, warnings
from dotenv import load_dotenv
load_dotenv()
warnings.filterwarnings("ignore")

print("=== Monarch Connection Test ===\n")

print("1. Testing Shopify...")
try:
    shop = os.environ["SHOPIFY_SHOP_DOMAIN"]
    token = os.environ["SHOPIFY_ACCESS_TOKEN"]
    r = requests.get(
        f"https://{shop}/admin/api/2024-01/shop.json",
        headers={"X-Shopify-Access-Token": token},
        timeout=10
    )
    if r.status_code == 200:
        data = r.json().get("shop", {})
        print(f"   ✅ Shopify connected: {data.get('name')}")
    else:
        print(f"   ❌ Shopify failed: HTTP {r.status_code} - {r.text[:100]}")
except Exception as e:
    print(f"   ❌ Shopify error: {e}")

print("\n2. Testing Snowflake...")
try:
    conn = snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        database=os.environ["SNOWFLAKE_DATABASE"],
        login_timeout=15,
    )
    cur = conn.cursor()
    cur.execute("SELECT CURRENT_USER(), CURRENT_DATABASE()")
    row = cur.fetchone()
    print(f"   ✅ Snowflake connected")
    print(f"      User:     {row[0]}")
    print(f"      Database: {row[1]}")
    conn.close()
except Exception as e:
    print(f"   ❌ Snowflake error: {e}")

print("\n=== Done ===")
