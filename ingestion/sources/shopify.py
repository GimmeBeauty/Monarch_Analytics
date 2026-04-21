import requests, os
from datetime import date, timedelta
from dotenv import load_dotenv
from ingestion.base_ingestor import BaseIngestor
load_dotenv()

class ShopifyOrdersIngestor(BaseIngestor):
    def __init__(self):
        super().__init__("shopify_orders", "COMMERCE", "SHOPIFY_ORDERS_RAW")
        self.shop = os.environ["SHOPIFY_SHOP_DOMAIN"]
        self.headers = {"X-Shopify-Access-Token": os.environ["SHOPIFY_ACCESS_TOKEN"]}
        self.base_url = f"https://{self.shop}/admin/api/2024-01"

    def fetch(self):
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        params = {"status":"any","created_at_min":f"{yesterday}T00:00:00Z","created_at_max":f"{yesterday}T23:59:59Z","limit":250}
        records, url = [], f"{self.base_url}/orders.json"
        while url:
            r = requests.get(url, headers=self.headers, params=params, timeout=30)
            r.raise_for_status()
            records.extend(r.json().get("orders", []))
            link = r.headers.get("Link", "")
            url, params = None, {}
            for part in link.split(","):
                if 'rel="next"' in part:
                    url = part.split(";")[0].strip().strip("<>")
        return records

    def run(self):
        records = self.fetch()
        print(f"[shopify_orders] Found {len(records)} orders")
        self.upsert_records(records, id_field="id")
        self.close()

class ShopifyProductsIngestor(BaseIngestor):
    def __init__(self):
        super().__init__("shopify_products", "COMMERCE", "SHOPIFY_PRODUCTS_RAW")
        self.shop = os.environ["SHOPIFY_SHOP_DOMAIN"]
        self.headers = {"X-Shopify-Access-Token": os.environ["SHOPIFY_ACCESS_TOKEN"]}
        self.base_url = f"https://{self.shop}/admin/api/2024-01"

    def fetch(self):
        records, url = [], f"{self.base_url}/products.json"
        params = {"limit": 250}
        while url:
            r = requests.get(url, headers=self.headers, params=params, timeout=30)
            r.raise_for_status()
            records.extend(r.json().get("products", []))
            link = r.headers.get("Link", "")
            url, params = None, {}
            for part in link.split(","):
                if 'rel="next"' in part:
                    url = part.split(";")[0].strip().strip("<>")
        return records

    def run(self):
        records = self.fetch()
        print(f"[shopify_products] Found {len(records)} products")
        self.upsert_records(records, id_field="id")
        self.close()

if __name__ == "__main__":
    print("=== Shopify Ingestion ===")
    ShopifyOrdersIngestor().run()
    ShopifyProductsIngestor().run()
    print("=== Complete ===")
