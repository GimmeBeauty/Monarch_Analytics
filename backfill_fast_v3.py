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
start_date = date(2025, 2, 4)
print(f"Backfilling {start_date} to {end_date}\n")

# Pull ALL orders into memory first then bulk load
all_rows = []
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

    for order in orders:
        all_rows.append({
            "id": str(order["id"]),
            "ingestion_date": day,
            "source": "shopify_orders",
            "raw_data": order,
        })

    total_orders += len(orders)
    print(f"  {day} -> {len(orders):>4} orders (total: {total_orders:>6})")
    current += timedelta(days=1)

print(f"\nFetched {total_orders} orders — writing to file...")

# Write all rows as newline-delimited JSON
with open("/tmp/shopify_orders.json", "w") as f:
    for row in all_rows:
        f.write(json.dumps({
            "ID": row["id"],
            "INGESTION_DATE": row["ingestion_date"],
            "SOURCE": row["source"],
            "RAW_DATA": json.dumps(row["raw_data"]),
        }) + "\n")

print("Uploading to Snowflake...")

# Create temp stage and bulk load
cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
cur.execute("PUT file:///tmp/shopify_orders.json @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")

print("Loading into table...")
cur.execute("""
    COPY INTO SHOPIFY_ORDERS_RAW (id, ingestion_date, source, raw_data)
    FROM (
        SELECT
            $1:ID::STRING,
            $1:INGESTION_DATE::DATE,
            $1:SOURCE::STRING,
            PARSE_JSON($1:RAW_DATA::STRING)
        FROM @monarch_stage/shopify_orders.json.gz
    )
    FILE_FORMAT = (TYPE = 'JSON')
    ON_ERROR = 'CONTINUE'
""")

print(f"Bulk load complete!")

# Products
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
    with open("/tmp/shopify_products.json", "w") as f:
        for p in products:
            f.write(json.dumps({
                "ID": str(p["id"]),
                "INGESTION_DATE": today,
                "SOURCE": "shopify_products",
                "RAW_DATA": json.dumps(p),
            }) + "\n")

    cur.execute("PUT file:///tmp/shopify_products.json @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
    cur.execute("""
        COPY INTO SHOPIFY_PRODUCTS_RAW (id, ingestion_date, source, raw_data)
        FROM (
            SELECT
                $1:ID::STRING,
                $1:INGESTION_DATE::DATE,
                $1:SOURCE::STRING,
                PARSE_JSON($1:RAW_DATA::STRING)
            FROM @monarch_stage/shopify_products.json.gz
        )
        FILE_FORMAT = (TYPE = 'JSON')
        ON_ERROR = 'CONTINUE'
    """)

print(f"Products complete -- {len(products)} products")

cur.close()
conn.close()
print("\nShopify backfill complete!")
