import warnings
from collections import defaultdict
from dotenv import load_dotenv

from app.data.snowflake_client import query_date_range
from app.data.cache import get_cached, set_cached

load_dotenv()
warnings.filterwarnings("ignore")

SCHEMA = "COMMERCE"
ORDERS_TABLE = "SHOPIFY_ORDERS_RAW"
PRODUCTS_TABLE = "SHOPIFY_PRODUCTS_RAW"


def _fetch_orders(days: int) -> list[dict]:
    cached = get_cached(f"shopify_orders_{days}")
    if cached is not None:
        return cached
    rows = query_date_range(SCHEMA, ORDERS_TABLE, days)
    set_cached(f"shopify_orders_{days}", rows)
    return rows


def get_overview_metrics(days: int = 30) -> dict:
    cache_key = f"overview_metrics_{days}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    orders = _fetch_orders(days)

    total_revenue = 0.0
    total_discounts = 0.0
    units_sold = 0
    order_count = 0
    customer_ids: set = set()
    first_order_customers: set = set()
    daily: defaultdict = defaultdict(lambda: {"revenue": 0.0, "units": 0, "orders": 0})

    for order in orders:
        financial_status = order.get("financial_status", "")
        if financial_status in ("voided", "refunded"):
            continue

        order_count += 1
        total_price = float(order.get("total_price") or 0)
        discount = float(order.get("total_discounts") or 0)
        total_revenue += total_price
        total_discounts += discount

        date_str = (order.get("created_at") or "")[:10]
        daily[date_str]["revenue"] += total_price
        daily[date_str]["orders"] += 1

        for item in order.get("line_items", []):
            qty = int(item.get("quantity") or 0)
            units_sold += qty
            daily[date_str]["units"] += qty

        cid = order.get("customer", {})
        if isinstance(cid, dict):
            cid = cid.get("id")
        if cid:
            if cid not in customer_ids:
                first_order_customers.add(cid)
            customer_ids.add(cid)

    net_revenue = round(total_revenue - total_discounts, 2)
    aov = round(total_revenue / order_count, 2) if order_count else 0.0
    new_customers = len(first_order_customers)
    returning_customers = len(customer_ids) - new_customers

    daily_revenue = sorted(
        [
            {
                "date": d,
                "revenue": round(v["revenue"], 2),
                "units": v["units"],
                "orders": v["orders"],
            }
            for d, v in daily.items()
            if d
        ],
        key=lambda x: x["date"],
    )

    result = {
        "total_revenue": round(total_revenue, 2),
        "net_revenue": net_revenue,
        "units_sold": units_sold,
        "aov": aov,
        "order_count": order_count,
        "new_customers": new_customers,
        "returning_customers": returning_customers,
        "daily_revenue": daily_revenue,
    }
    set_cached(cache_key, result)
    return result


def get_product_performance(days: int = 30) -> list[dict]:
    cache_key = f"product_performance_{days}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    orders = _fetch_orders(days)
    products: defaultdict = defaultdict(
        lambda: {
            "revenue": 0.0,
            "units": 0,
            "orders": 0,
            "prices": [],
            "title": "",
            "variant_title": "",
            "sku": "",
        }
    )

    for order in orders:
        financial_status = order.get("financial_status", "")
        if financial_status in ("voided", "refunded"):
            continue

        seen_in_order: set = set()
        for item in order.get("line_items", []):
            pid = str(item.get("product_id") or item.get("variant_id") or "unknown")
            qty = int(item.get("quantity") or 0)
            price = float(item.get("price") or 0)

            products[pid]["title"] = item.get("title") or products[pid]["title"]
            products[pid]["variant_title"] = item.get("variant_title") or products[pid]["variant_title"]
            products[pid]["sku"] = item.get("sku") or products[pid]["sku"]
            products[pid]["revenue"] += price * qty
            products[pid]["units"] += qty
            products[pid]["prices"].append(price)
            if pid not in seen_in_order:
                products[pid]["orders"] += 1
                seen_in_order.add(pid)

    result = sorted(
        [
            {
                "product_id": pid,
                "title": v["title"],
                "variant_title": v["variant_title"],
                "sku": v["sku"],
                "store": "Shopify",
                "revenue": round(v["revenue"], 2),
                "units": v["units"],
                "orders": v["orders"],
                "avg_price": round(sum(v["prices"]) / len(v["prices"]), 2) if v["prices"] else 0.0,
                "sessions": None,
                "page_views": None,
                "conversion_rate": None,
            }
            for pid, v in products.items()
        ],
        key=lambda x: x["revenue"],
        reverse=True,
    )
    set_cached(cache_key, result)
    return result


def get_revenue_by_day(days: int = 30) -> list[dict]:
    cache_key = f"revenue_by_day_{days}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    orders = _fetch_orders(days)
    daily: defaultdict = defaultdict(lambda: {"revenue": 0.0, "units": 0, "orders": 0})

    for order in orders:
        financial_status = order.get("financial_status", "")
        if financial_status in ("voided", "refunded"):
            continue

        date_str = (order.get("created_at") or "")[:10]
        if not date_str:
            continue
        total_price = float(order.get("total_price") or 0)
        daily[date_str]["revenue"] += total_price
        daily[date_str]["orders"] += 1
        for item in order.get("line_items", []):
            daily[date_str]["units"] += int(item.get("quantity") or 0)

    result = sorted(
        [
            {
                "date": d,
                "revenue": round(v["revenue"], 2),
                "units": v["units"],
                "orders": v["orders"],
                "store": "Shopify",
            }
            for d, v in daily.items()
        ],
        key=lambda x: x["date"],
    )
    set_cached(cache_key, result)
    return result


def get_geographic_breakdown(days: int = 30) -> list[dict]:
    cache_key = f"geographic_breakdown_{days}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    orders = _fetch_orders(days)
    states: defaultdict = defaultdict(lambda: {"revenue": 0.0, "orders": 0, "units": 0})

    for order in orders:
        financial_status = order.get("financial_status", "")
        if financial_status in ("voided", "refunded"):
            continue

        shipping = order.get("shipping_address") or {}
        billing = order.get("billing_address") or {}
        address = shipping if shipping else billing
        country = (address.get("country_code") or "").upper()
        if country and country != "US":
            continue

        state = (address.get("province_code") or address.get("province") or "Unknown").upper()
        if "-" in state:
            state = state.split("-")[-1]

        total_price = float(order.get("total_price") or 0)
        states[state]["revenue"] += total_price
        states[state]["orders"] += 1
        for item in order.get("line_items", []):
            states[state]["units"] += int(item.get("quantity") or 0)

    result = sorted(
        [
            {
                "state": s,
                "revenue": round(v["revenue"], 2),
                "orders": v["orders"],
                "units": v["units"],
            }
            for s, v in states.items()
            if s and s != "UNKNOWN"
        ],
        key=lambda x: x["revenue"],
        reverse=True,
    )
    set_cached(cache_key, result)
    return result
