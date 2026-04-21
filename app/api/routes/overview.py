import warnings
from fastapi import APIRouter, Query
from dotenv import load_dotenv

from app.transformers.shopify import (
    get_overview_metrics,
    get_revenue_by_day,
)

load_dotenv()
warnings.filterwarnings("ignore")

router = APIRouter(prefix="/api/overview", tags=["overview"])


@router.get("/summary")
def overview_summary(days: int = Query(30, ge=1, le=365)):
    metrics = get_overview_metrics(days)
    return {
        "total_revenue": metrics["total_revenue"],
        "net_revenue": metrics["net_revenue"],
        "units_sold": metrics["units_sold"],
        "aov": metrics["aov"],
        "order_count": metrics["order_count"],
        "new_customers": metrics["new_customers"],
        "returning_customers": metrics["returning_customers"],
        "ad_spend": None,
        "mer": None,
        "blended_roas": None,
        "sessions": None,
        "conversion_rate": None,
    }


@router.get("/revenue-trend")
def revenue_trend(days: int = Query(30, ge=1, le=365)):
    return {"data": get_revenue_by_day(days)}


@router.get("/top-stores")
def top_stores(days: int = Query(30, ge=1, le=365)):
    metrics = get_overview_metrics(days)
    return {
        "stores": [
            {
                "store": "Shopify DTC",
                "revenue": metrics["total_revenue"],
                "units_sold": metrics["units_sold"],
                "order_count": metrics["order_count"],
                "aov": metrics["aov"],
            }
        ]
    }
