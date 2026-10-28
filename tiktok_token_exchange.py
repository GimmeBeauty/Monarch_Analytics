import os, json, time, requests
from getpass import getpass
from datetime import date, timedelta
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

raw = getpass("Enter the auth_code or redirect URL (hidden): ").strip()
code = raw
if "auth_code=" in raw:
    code = parse_qs(urlparse(raw).query).get("auth_code", [""])[0]
app_id = os.environ["TIKTOK_ADS_APP_ID"].strip()
secret = os.environ["TIKTOK_ADS_SECRET"].strip()
print("auth_code length:", len(code))

body = None
for attempt in range(1, 4):
    try:
        r = requests.post("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
                          json={"app_id": app_id, "secret": secret, "auth_code": code}, timeout=30)
        body = r.json()
        print("EXCHANGE HTTP:", r.status_code, "| successful:", body.get("code") == 0)
        break
    except requests.exceptions.RequestException as e:
        print(f"attempt {attempt} failed: {type(e).__name__}")
        time.sleep(3)
if body is None:
    raise SystemExit("No response from TikTok after 3 attempts.")

data = body.get("data") or {}
token = data.get("access_token")
print("scope:", data.get("scope"), "| advertiser_ids:", data.get("advertiser_ids"))
if not token:
    raise SystemExit("No token returned.")

end = date.today() - timedelta(days=1)
start = end - timedelta(days=13)
r = requests.get("https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/",
    headers={"Access-Token": token},
    params={"advertiser_id": data["advertiser_ids"][0], "report_type": "BASIC",
            "data_level": "AUCTION_CAMPAIGN",
            "dimensions": json.dumps(["campaign_id", "stat_time_day"]),
            "metrics": json.dumps(["campaign_name", "impressions", "clicks", "spend", "cpc", "ctr", "conversion"]),
            "start_date": start.isoformat(), "end_date": end.isoformat(), "page": 1, "page_size": 200},
    timeout=60)
b = r.json()
rows = (b.get("data") or {}).get("list", [])
print("REPORT HTTP:", r.status_code, "| successful:", b.get("code") == 0)
print("rows:", len(rows), "| spend total:", round(sum(float(x["metrics"].get("spend", 0)) for x in rows), 2))

print("\nCredentials were used only in memory for this diagnostic and were not saved.")
print("For a persistent connection, use the app's TikTok Ads integration flow.")
