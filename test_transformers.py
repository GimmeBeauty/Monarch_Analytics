import warnings
import sys
import os
from dotenv import load_dotenv

load_dotenv()
warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.dirname(__file__))

from app.transformers.shopify import (
    get_overview_metrics,
    get_product_performance,
    get_revenue_by_day,
    get_geographic_breakdown,
)

print("=" * 60)
print("MONARCH TRANSFORMER TEST")
print("=" * 60)

print("\n--- Overview Metrics (30 days) ---")
metrics = get_overview_metrics(days=30)
print(f"  Total Revenue:      ${metrics['total_revenue']:,.2f}")
print(f"  Net Revenue:        ${metrics['net_revenue']:,.2f}")
print(f"  Units Sold:         {metrics['units_sold']:,}")
print(f"  AOV:                ${metrics['aov']:,.2f}")
print(f"  Order Count:        {metrics['order_count']:,}")
print(f"  New Customers:      {metrics['new_customers']:,}")
print(f"  Returning Customers:{metrics['returning_customers']:,}")

print("\n--- Product Performance (30 days) ---")
products = get_product_performance(days=30)
print(f"  Products found: {len(products)}")
print("  Top 5 products:")
for p in products[:5]:
    print(f"    [{p['product_id']}] {p['title'][:40]:<40}  rev=${p['revenue']:>10,.2f}  units={p['units']:>5}")

print("\n--- Revenue by Day (30 days) ---")
daily = get_revenue_by_day(days=30)
print(f"  Days with data: {len(daily)}")
if daily:
    first = daily[0]
    last = daily[-1]
    print(f"  First day: {first['date']}  revenue=${first['revenue']:,.2f}")
    print(f"  Last day:  {last['date']}  revenue=${last['revenue']:,.2f}")

print("\n--- Geographic Breakdown (30 days) ---")
geo = get_geographic_breakdown(days=30)
print("  Top 5 states by revenue:")
for entry in geo[:5]:
    print(f"    {entry['state']:<4}  revenue=${entry['revenue']:>10,.2f}  orders={entry['orders']:>5}")

print("\n" + "=" * 60)
print("ALL TRANSFORMERS COMPLETED SUCCESSFULLY")
print("=" * 60)
