import requests, os, json
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()


def _get_credentials():
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set — cannot load Google Ads credentials from app database")
    import psycopg2, psycopg2.extras
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT access_token, metadata FROM integrations WHERE provider = 'google_ads' LIMIT 1")
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        raise RuntimeError("Google Ads integration not found in integrations table")
    meta = json.loads(row["metadata"] or "{}")
    developer_token = meta.get("developerToken", "")
    customer_id = meta.get("customerId", "").replace("-", "")
    client_id = meta.get("clientId", "")
    client_secret = meta.get("clientSecret", "")
    refresh_token = meta.get("refreshToken", "")
    access_token = row["access_token"] if row["access_token"] != "manual" else ""
    if not all([developer_token, customer_id, client_id, client_secret, refresh_token]):
        raise RuntimeError("Google Ads credentials incomplete in integrations table")
    return developer_token, customer_id, client_id, client_secret, refresh_token, access_token


def _refresh_token(client_id, client_secret, refresh_token):
    r = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def _fetch_campaign_stats(developer_token, customer_id, access_token, since, until):
    query = f"""
        SELECT
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value
        FROM campaign
        WHERE segments.date BETWEEN '{since}' AND '{until}'
          AND campaign.status != 'REMOVED'
    """
    r = requests.post(
        f"https://googleads.googleapis.com/v15/customers/{customer_id}/googleAds:search",
        headers={
            "Authorization": f"Bearer {access_token}",
            "developer-token": developer_token,
            "Content-Type": "application/json",
        },
        json={"query": query},
        timeout=60,
    )
    if r.status_code == 401:
        return None, True
    r.raise_for_status()
    return r.json().get("results", []), False


def _aggregate_by_date(results):
    daily = {}
    for row in results:
        d = row.get("segments", {}).get("date", "")
        if not d:
            continue
        m = row.get("metrics", {})
        if d not in daily:
            daily[d] = {"date": d, "spend": 0.0, "impressions": 0, "clicks": 0, "conversions": 0.0, "revenue": 0.0}
        daily[d]["spend"] += (m.get("costMicros", 0) or 0) / 1_000_000
        daily[d]["impressions"] += m.get("impressions", 0) or 0
        daily[d]["clicks"] += m.get("clicks", 0) or 0
        daily[d]["conversions"] += m.get("conversions", 0) or 0
        daily[d]["revenue"] += m.get("conversionsValue", 0) or 0
    return list(daily.values())


class GoogleAdsIngestor:
    def __init__(self):
        from ingestion.base_ingestor import BaseIngestor
        self._base = BaseIngestor.__new__(BaseIngestor)
        BaseIngestor.__init__(self._base, "google_ads", "ADS", "GOOGLE_ADS_RAW")

    def run(self, since=None, until=None):
        if since is None:
            since = (date.today() - timedelta(days=1)).isoformat()
        if until is None:
            until = since
        print(f"[google_ads] Fetching campaign stats {since} → {until}")
        developer_token, customer_id, client_id, client_secret, refresh_token, access_token = _get_credentials()
        if not access_token:
            access_token = _refresh_token(client_id, client_secret, refresh_token)
        results, need_refresh = _fetch_campaign_stats(developer_token, customer_id, access_token, since, until)
        if need_refresh:
            access_token = _refresh_token(client_id, client_secret, refresh_token)
            results, _ = _fetch_campaign_stats(developer_token, customer_id, access_token, since, until)
        print(f"[google_ads] Received {len(results)} campaign rows")
        normalized = _aggregate_by_date(results)
        self._base.upsert_records(normalized, id_field="date")
        self._base.close()


if __name__ == "__main__":
    GoogleAdsIngestor().run()
