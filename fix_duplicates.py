from snowflake_connect import get_connection
import warnings
warnings.filterwarnings("ignore")
conn = get_connection(schema="COMMERCE")
cur = conn.cursor()

print("Creating deduplicated orders table...")
cur.execute("""
    CREATE OR REPLACE TABLE MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_CLEAN AS
    SELECT *
    FROM (
        SELECT *,
            ROW_NUMBER() OVER (
                PARTITION BY id 
                ORDER BY ingested_at DESC
            ) as rn
        FROM MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_RAW
    )
    WHERE rn = 1
""")

cur.execute("SELECT COUNT(*), COUNT(DISTINCT id) FROM MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_CLEAN")
row = cur.fetchone()
print(f"Clean table: {row[0]:,} rows, {row[1]:,} unique orders")

print("Swapping tables...")
cur.execute("ALTER TABLE MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_RAW RENAME TO MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_BACKUP")
cur.execute("ALTER TABLE MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_CLEAN RENAME TO MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_RAW")

cur.execute("SELECT COUNT(*) FROM MONARCH_RAW.COMMERCE.SHOPIFY_ORDERS_RAW")
row = cur.fetchone()
print(f"Final row count: {row[0]:,}")

cur.close()
conn.close()
print("Done!")
