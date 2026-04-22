import requests, json, os, warnings
import snowflake.connector
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()
warnings.filterwarnings("ignore")

shop = os.environ["SHOPIFY_SHOP_DOMAIN"]
token = os.environ["SHOPIFY_ACCESS_TOKEN"]
headers = {"X-Shopify-Access-Token": token}
base_url = f"https://{shop}/admin/api/2024-01"

conn = snowflake.connector.connect(
    account=os.environ["SNOWFLAKE_ACCOUNT"],
    user=os.environ["SNOWFLAKE_USER"],
    password=os.environ["SNOWFLAKE_PASSWORD"],
    warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
    database=os.environ["SNOWFLAKE_DATABASE"],
    schema="COMMERCE",
)
cur = conn.cursor()
print("Connected to Snowflake")

end_date = date.today() - timedelta(days=1)
start_date = date(2025, 1, 1)
print(f"Backfilling {start_date} to {end_date}\n")

total_orders = 0
current = start_date

while current <= end_date:
    day = current.isoformat()

    params = {
        "status": "any",
        "created_at_min": f"{day}T00:00:00Z",
        "created_at_max": f"{day}T23:59:59Z",
        "limit": 250,
    }
    orders = []
    url = f"{base_url}/orders.json"
    while url:
        r = requests.get(url, headers=headers, params=params, timeout=30)
        r.raise_for_status()
        orders.extend(r.json().get("orders", []))
        link = r.headers.get("Link", "")
        url, params = None, {}
        for part in link.split(","):
            if 'rel="next"' in part:
                url = part.split(";")[0].strip().strip("<>")

    if orders:
        cur.execute(f"DELETE FROM SHOPIFY_ORDERS_RAW WHERE ingestion_date = '{day}'")
        for order in orders:
            cur.execute(
                "INSERT INTO SHOPIFY_ORDERS_RAW (id, ingestion_date, source, raw_data) "
                "SELECT %s, %s::DATE, %s, PARSE_JSON(%s)",
                (str(order["id"]), day, "shopify_orders", json.dumps(order))
            )

    total_orders += len(orders)
    print(f"  {day} -> {len(orders):>4} orders (total: {total_orders:>6})")
    current += timedelta(days=1)

print(f"\nOrders complete -- {total_orders} total orders")

print("\nPulling products...")
products = []
url = f"{base_url}/products.json"
params = {"limit": 250}
while url:
    r = requests.get(url, headers=headers, params=params, timeout=30)
    r.raise_for_status()
    products.extend(r.json().get("products", []))
    link = r.headers.get("Link", "")
    url, params = None, {}
    for part in link.split(","):
        if 'rel="next"' in part:
            url = part.split(";")[0].strip().strip("<>")

if products:
    today = date.today().isoformat()
    cur.execute(f"DELETE FROM SHOPIFY_PRODUCTS_RAW WHERE ingestion_date = '{today}'")
    for p in products:
        cur.execute(
            "INSERT INTO SHOPIFY_PRODUCTS_RAW (id, ingestion_date, source, raw_data) "
            "SELECT %s, %s::DATE, %s, PARSE_JSON(%s)",
            (str(p["id"]), today, "shopify_products", json.dumps(p))
        )

print(f"Products complete -- {len(products)} products")

cur.close()
conn.close()
print("\nShopify backfill complete!")
