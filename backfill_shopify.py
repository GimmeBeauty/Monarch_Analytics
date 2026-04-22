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
print("✅ Connected to Snowflake")

# Date range — 1 year back from today
end_date = date.today() - timedelta(days=1)
start_date = end_date - timedelta(days=365)

print(f"Backfilling {start_date} to {end_date}\n")

total_orders = 0
total_products_done = False
current = start_date

while current <= end_date:
    day = current.isoformat()

    # Pull orders for this day
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

    # Write orders to Snowflake
    for order in orders:
        cur.execute("""
            MERGE INTO SHOPIFY_ORDERS_RAW AS target
            USING (
                SELECT %s AS id, %s::DATE AS ingestion_date,
                       %s AS source, PARSE_JSON(%s) AS raw_data
            ) AS src
            ON target.id = src.id
            AND target.ingestion_date = src.ingestion_date
            WHEN MATCHED THEN UPDATE SET
                target.raw_data = src.raw_data,
                target.ingested_at = CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT
                (id, ingestion_date, source, raw_data)
            VALUES (src.id, src.ingestion_date, src.source, src.raw_data)
        """, (str(order["id"]), day, "shopify_orders", json.dumps(order)))

    total_orders += len(orders)
    print(f"  {day} → {len(orders)} orders (total so far: {total_orders})")
    current += timedelta(days=1)

print(f"\n✅ Orders backfill complete — {total_orders} total orders written")

# Pull all products once (not date-based)
print("\nPulling products catalog...")
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

today = date.today().isoformat()
for product in products:
    cur.execute("""
        MERGE INTO SHOPIFY_PRODUCTS_RAW AS target
        USING (
            SELECT %s AS id, %s::DATE AS ingestion_date,
                   %s AS source, PARSE_JSON(%s) AS raw_data
        ) AS src
        ON target.id = src.id
        AND target.ingestion_date = src.ingestion_date
        WHEN MATCHED THEN UPDATE SET
            target.raw_data = src.raw_data,
            target.ingested_at = CURRENT_TIMESTAMP()
        WHEN NOT MATCHED THEN INSERT
            (id, ingestion_date, source, raw_data)
        VALUES (src.id, src.ingestion_date, src.source, src.raw_data)
    """, (str(product["id"]), today, "shopify_products", json.dumps(product)))

print(f"✅ Products complete — {len(products)} products written")

cur.close()
conn.close()
print("\n✅ Shopify backfill complete!")
