import requests, snowflake.connector, os, warnings
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
load_dotenv()
warnings.filterwarnings("ignore")

def _get_snowflake_connection(schema=None):
    params = dict(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "MONARCH_WH"),
        database=os.environ.get("SNOWFLAKE_DATABASE", "MONARCH_RAW"),
        login_timeout=15,
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
    conn = _get_snowflake_connection()
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
