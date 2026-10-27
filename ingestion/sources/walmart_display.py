import os, boto3, io, csv, sys
from datetime import datetime
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

WALMART_BUCKET = "walmart-monarch-retail-466089068963-us-west-2-an"
DISPLAY_KEY = "walmart-connect-display-2026.csv"
DISPLAY_30_KEY = "walmart-connect-display-30-2026.csv"  # 30-day attribution, joined to DISPLAY_KEY on (campaign name, date)

def parse_money(s):
    if not s or s.strip() in ("", "N/A", "null"):
        return 0.0
    s = s.replace("$", "").replace(",", "").strip()
    try:
        return float(s)
    except:
        return 0.0

def parse_num(s):
    if not s or s.strip() in ("", "N/A", "null"):
        return 0
    s = s.replace(",", "").strip()
    try:
        return int(float(s))
    except:
        return 0

def parse_pct(s):
    if not s or s.strip() in ("", "N/A", "null"):
        return 0.0
    s = s.replace("%", "").strip()
    try:
        return float(s) / 100
    except:
        return 0.0

def parse_date(s):
    if not s or s.strip() == "":
        return None
    try:
        return datetime.strptime(s.strip(), "%Y-%m-%d").date().isoformat()
    except:
        try:
            return datetime.strptime(s.strip(), "%m-%d-%Y").date().isoformat()
        except:
            return None
def read_display_file(s3, key):
    obj = s3.get_object(Bucket=WALMART_BUCKET, Key=key)
    content = obj['Body'].read().decode('utf-8-sig', errors='replace')
    rows = {}
    for r in csv.DictReader(io.StringIO(content)):
        ad_date = parse_date(r.get('Date', ''))
        if not ad_date:
            continue
        k = (r.get('Campaign name', ''), ad_date)
        if k in rows:
            raise ValueError(f"{key}: duplicate row for campaign/date {k}")
        rows[k] = r
    return rows

def run_walmart_display_ingestion():
    print("Pulling Walmart Display data from S3...")
    s3 = boto3.client('s3',aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],region_name='us-west-2')
    sys.path.insert(0, "/home/runner/workspace")
    from snowflake_connect import get_connection
    conn = get_connection(schema="ADS")
    cur = conn.cursor()

    rows_14 = read_display_file(s3, DISPLAY_KEY)
    rows_30 = read_display_file(s3, DISPLAY_30_KEY)
    # Fail before touching the table if the two exports don't cover the same campaign/days.
    if set(rows_14) != set(rows_30):
        only_14, only_30 = sorted(set(rows_14) - set(rows_30)), sorted(set(rows_30) - set(rows_14))
        raise ValueError(f"Display 14-day and 30-day files differ: {len(only_14)} keys only in {DISPLAY_KEY} "
                         f"(e.g. {only_14[:3]}), {len(only_30)} only in {DISPLAY_30_KEY} (e.g. {only_30[:3]})")
    records = []
    for (campaign_name, ad_date), r in rows_14.items():
        r30 = rows_30[(campaign_name, ad_date)]
        records.append({
            "campaign_name": campaign_name,
            "ad_date": ad_date,
            "campaign_start": parse_date(r.get('Campaign start', '')),
            "campaign_end": parse_date(r.get('Campaign end', '')),
            "status": r.get('Status', ''),
            "campaign_type": r.get('Type', ''),
            "attribution_model": r.get('Attribution model', ''),
            "impressions": parse_num(r.get('Impressions', '')),
            "ecpm": parse_money(r.get('eCPM', '')),
            "spend": parse_money(r.get('Spend', '')),
            "household_reach": parse_num(r.get('Household Reach', '')),
            "household_frequency": parse_money(r.get('Household Frequency', '')),
            "product_page_view_rate": parse_pct(r.get('Product detail page view rate', '')),
            "add_to_cart_rate": parse_pct(r.get('Add to cart rate', '')),
            "roas": parse_money(r.get('Total ROAS', '')),
            "attributed_units": parse_num(r.get('Total attributed units', '')),
            "attributed_sales": parse_money(r.get('Total attributed sales', '')),
            "attributed_transactions": parse_num(r.get('Total attributed transactions', '')),
            "avg_transaction_value": parse_money(r.get('Total average transaction value', '')),
            "conversion_rate": parse_pct(r.get('Total conversion rate', '')),
            "clicks": parse_num(r.get('Clicks', '')),
            "ctr": parse_pct(r.get('CTR', '')),
            "attributed_sales_30d": parse_money(r30.get('Total attributed sales', '')),
            "attributed_transactions_30d": parse_num(r30.get('Total attributed transactions', '')),
            "attributed_units_30d": parse_num(r30.get('Total attributed units', '')),
            "roas_30d": parse_money(r30.get('Total ROAS', '')),
        })
    print(f"  Found {len(records)} rows")
    if not records:
        print("  No valid records found"); return
    min_date = min(r["ad_date"] for r in records)
    max_date = max(r["ad_date"] for r in records)
    cur.execute(f"DELETE FROM MONARCH_RAW.ADS.WALMART_DISPLAY_RAW WHERE ad_date BETWEEN '{min_date}' AND '{max_date}'")
    conn.commit()

    insert_sql = """INSERT INTO MONARCH_RAW.ADS.WALMART_DISPLAY_RAW
(campaign_name,ad_date,campaign_start,campaign_end,status,campaign_type,attribution_model,
impressions,ecpm,spend,household_reach,household_frequency,product_page_view_rate,add_to_cart_rate,
roas,attributed_units,attributed_sales,attributed_transactions,avg_transaction_value,
conversion_rate,clicks,ctr,attributed_sales_30d,attributed_transactions_30d,attributed_units_30d,roas_30d)
VALUES (%(campaign_name)s,%(ad_date)s,%(campaign_start)s,%(campaign_end)s,%(status)s,%(campaign_type)s,%(attribution_model)s,
%(impressions)s,%(ecpm)s,%(spend)s,%(household_reach)s,%(household_frequency)s,%(product_page_view_rate)s,%(add_to_cart_rate)s,
%(roas)s,%(attributed_units)s,%(attributed_sales)s,%(attributed_transactions)s,%(avg_transaction_value)s,
%(conversion_rate)s,%(clicks)s,%(ctr)s,%(attributed_sales_30d)s,%(attributed_transactions_30d)s,%(attributed_units_30d)s,%(roas_30d)s)"""
    cur.executemany(insert_sql, records)
    conn.commit()

    cur.execute(f"SELECT COUNT(*), SUM(spend), SUM(attributed_sales), SUM(attributed_sales_30d) FROM MONARCH_RAW.ADS.WALMART_DISPLAY_RAW WHERE ad_date BETWEEN '{min_date}' AND '{max_date}'")
    row = cur.fetchone()
    print(f"  ✅ {row[0]:,} rows loaded, ${row[1]:,.2f} spend, ${row[2]:,.2f} attributed sales (14d), ${row[3]:,.2f} (30d)")
    cur.close(); conn.close()
    print("✅ Walmart Display ingestion complete!")

if __name__ == "__main__":
    run_walmart_display_ingestion()
