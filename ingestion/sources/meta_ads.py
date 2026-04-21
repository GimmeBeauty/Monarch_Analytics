import requests, os, json
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()

def _get_credentials():
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set — cannot load Meta credentials from app database")
    import psycopg2, psycopg2.extras
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT access_token, metadata FROM integrations WHERE provider = 'meta' LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        raise RuntimeError("Meta integration not found in integrations table")
    meta = json.loads(row["metadata"] or "{}")
    access_token = meta.get("accessToken") or (row["access_token"] if row["access_token"] != "manual" else None)
    ad_account_id = meta.get("adAccountId", "")
    if not access_token:
        raise RuntimeError("Meta access token not found in integrations table")
    if not ad_account_id:
        raise RuntimeError("Meta ad account ID not found in integrations table")
    normalized = ad_account_id if ad_account_id.startswith("act_") else f"act_{ad_account_id}"
    return access_token, normalized


def _fetch_insights(access_token, ad_account_id, since, until):
    fields = "date_start,spend,impressions,clicks,actions,action_values,frequency"
    time_range = json.dumps({"since": since, "until": until})
    url = (
        f"https://graph.facebook.com/v18.0/{ad_account_id}/insights"
        f"?fields={fields}&time_range={requests.utils.quote(time_range)}"
        f"&time_increment=1&level=account&limit=90"
    )
    rows = []
    while url:
        r = requests.get(url, headers={"Authorization": f"Bearer {access_token}"}, timeout=30)
        r.raise_for_status()
        data = r.json()
        rows.extend(data.get("data", []))
        paging = data.get("paging", {})
        url = paging.get("next")
    return rows


def _normalize(row):
    purchases = next(
        (a for a in row.get("actions", []) if a.get("action_type") == "purchase"), {}
    )
    purchase_value = next(
        (a for a in row.get("action_values", []) if a.get("action_type") == "purchase"), {}
    )
    return {
        "date": row.get("date_start", ""),
        "spend": float(row.get("spend", 0) or 0),
        "impressions": int(row.get("impressions", 0) or 0),
        "clicks": int(row.get("clicks", 0) or 0),
        "conversions": float(purchases.get("value", 0) or 0),
        "revenue": float(purchase_value.get("value", 0) or 0),
        "frequency": float(row.get("frequency", 0) or 0),
    }


class MetaAdsIngestor:
    def __init__(self):
        from ingestion.base_ingestor import BaseIngestor
        self._base = BaseIngestor.__new__(BaseIngestor)
        BaseIngestor.__init__(self._base, "meta_ads", "ADS", "META_ADS_RAW")

    def run(self, since=None, until=None):
        if since is None:
            since = (date.today() - timedelta(days=1)).isoformat()
        if until is None:
            until = since
        print(f"[meta_ads] Fetching insights {since} → {until}")
        access_token, ad_account_id = _get_credentials()
        raw_rows = _fetch_insights(access_token, ad_account_id, since, until)
        print(f"[meta_ads] Received {len(raw_rows)} insight rows")
        normalized = [_normalize(r) for r in raw_rows if r.get("date_start")]
        self._base.upsert_records(normalized, id_field="date")
        self._base.close()


if __name__ == "__main__":
    MetaAdsIngestor().run()
