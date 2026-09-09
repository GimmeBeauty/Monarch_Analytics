import os, boto3, io, csv, sys
from datetime import datetime
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

WALMART_BUCKET = "walmart-monarch-retail-466089068963-us-west-2-an"
DISPLAY_KEY = "walmart-connect-display-2026.csv"

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
def run_walmart_display_ingestion():
    print("Pulling Walmart Display data from S3...")
    s3 = boto3.client('s3',aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],region_name='us-west-2')
    sys.path.insert(0, "/home/runner/workspace")
    from snowflake_connect import get_connection
    conn = get_connection(schema="ADS")
    cur = conn.cursor()

    obj = s3.get_object(Bucket=WALMART_BUCKET, Key=DISPLAY_KEY)
    content = obj['Body'].read().decode('utf-8-sig', errors='replace')
    reader = csv.DictReader(io.StringIO(content))
    records = []
    for r in reader:
        ad_date = parse_date(r.get('Date', ''))
        if not ad_date:
            continue
        records.append({
            "campaign_name": r.get('Campaign name', ''),
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
conversion_rate,clicks,ctr)
VALUES (%(campaign_name)s,%(ad_date)s,%(campaign_start)s,%(campaign_end)s,%(status)s,%(campaign_type)s,%(attribution_model)s,
%(impressions)s,%(ecpm)s,%(spend)s,%(household_reach)s,%(household_frequency)s,%(product_page_view_rate)s,%(add_to_cart_rate)s,
%(roas)s,%(attributed_units)s,%(attributed_sales)s,%(attributed_transactions)s,%(avg_transaction_value)s,
%(conversion_rate)s,%(clicks)s,%(ctr)s)"""
    cur.executemany(insert_sql, records)
    conn.commit()

    cur.execute(f"SELECT COUNT(*), SUM(spend), SUM(attributed_sales) FROM MONARCH_RAW.ADS.WALMART_DISPLAY_RAW WHERE ad_date BETWEEN '{min_date}' AND '{max_date}'")
    row = cur.fetchone()
    print(f"  ✅ {row[0]:,} rows loaded, ${row[1]:,.2f} spend, ${row[2]:,.2f} attributed sales")
    cur.close(); conn.close()
    print("✅ Walmart Display ingestion complete!")

if __name__ == "__main__":
    run_walmart_display_ingestion()
