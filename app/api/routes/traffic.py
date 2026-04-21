import warnings
from fastapi import APIRouter, Query
from typing import Optional
from dotenv import load_dotenv

from app.transformers.shopify import (
    get_overview_metrics,
    get_product_performance,
    get_revenue_by_day,
    get_geographic_breakdown,
)

load_dotenv()
warnings.filterwarnings("ignore")

router = APIRouter(prefix="/api/traffic", tags=["traffic"])


@router.get("/summary")
def traffic_summary(days: int = Query(30, ge=1, le=365)):
    metrics = get_overview_metrics(days)
    return {
        "revenue": metrics["total_revenue"],
        "units_sold": metrics["units_sold"],
        "aov": metrics["aov"],
        "order_count": metrics["order_count"],
        "ad_sales": None,
        "ad_revenue": None,
        "pspw": None,
        "mer": None,
    }


@router.get("/products")
def traffic_products(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(50, ge=1, le=500),
    store: Optional[str] = Query(None),
):
    products = get_product_performance(days)
    if store:
        products = [p for p in products if p["store"].lower() == store.lower()]
    return {"total": len(products), "products": products[:limit]}


@router.get("/daily")
def traffic_daily(days: int = Query(30, ge=1, le=365)):
    return {"data": get_revenue_by_day(days)}


@router.get("/geographic")
def traffic_geographic(days: int = Query(30, ge=1, le=365)):
    return {"data": get_geographic_breakdown(days)}


@router.get("/stores")
def traffic_stores(days: int = Query(30, ge=1, le=365)):
    metrics = get_overview_metrics(days)
    return {
        "stores": [
            {
                "store": "Shopify",
                "channel": "dtc",
                "type": "DTC",
                "revenue": metrics["total_revenue"],
                "units_sold": metrics["units_sold"],
                "order_count": metrics["order_count"],
                "aov": metrics["aov"],
            }
        ]
    }
