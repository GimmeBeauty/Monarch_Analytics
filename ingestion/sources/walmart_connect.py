import os, boto3, io, csv, sys
from datetime import datetime
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

WALMART_BUCKET = "walmart-monarch-retail-466089068963-us-west-2-an"

def parse_date(d):
    try:
        return datetime.strptime(d, "%d-%b-%y").date().isoformat()
    except:
        return None

def parse_money(s):
    if not s or s.strip() in ("null", "—", "", "N/A"):
        return 0.0
    s = s.replace("$", "").replace(",", "").strip()
    try:
        return float(s)
    except:
        return 0.0
def parse_num(s):
    if not s or s.strip() in ("null", "—", "", "N/A"):
        return 0
    s = s.replace(",", "").strip()
    try:
        return int(float(s))
    except:
        return 0

def parse_pct(s):
    if not s or s.strip() in ("null", "—", "", "N/A"):
        return 0.0
    s = s.replace("%", "").strip()
    try:
        return float(s) / 100
    except:
        return 0.0
def run_walmart_connect_ingestion():
    print("Pulling Walmart Connect data from S3...")
    s3 = boto3.client('s3',aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],region_name='us-west-2')
    sys.path.insert(0, "/home/runner/workspace")
    from snowflake_connect import get_connection
    conn = get_connection(schema="ADS")
    cur = conn.cursor()
    all_records = []
    for key in ["walmart-connect-daily-2025.csv", "walmart-connect-daily-2026.csv"]:
        obj = s3.get_object(Bucket=WALMART_BUCKET, Key=key)
        content = obj['Body'].read().decode('utf-8', errors='replace')
        lines = content.split('\n')[1:]
        reader = csv.DictReader(lines)
        for r in reader:
            ad_date = parse_date(r.get('Date', ''))
            if not ad_date: continue
            all_records.append({
                "ad_date": ad_date,
                "impressions": parse_num(r.get('Impressions', '')),
                "clicks": parse_num(r.get('Clicks', '')),
                "spend": parse_money(r.get('Ad Spend', '')),
                "ctr": parse_pct(r.get('CTR', '')),
                "units_sold_14d": parse_num(r.get('Total Units Sold - 14 Day', '')),
                "sales_revenue_14d": parse_money(r.get('Total Sales Rev. - 14 Day', '')),
                "ntb_sales_14d": parse_money(r.get('New-to-Brand Sales - 14 Days', '')),
                "roas_14d": parse_money(r.get('ROAS - 14 Day', '')),
                "instore_sales_14d": parse_money(r.get('In-store Advertised Sales  - 14 Days', '')),
                "conversion_rate_14d": parse_pct(r.get('Conversion Rate - 14 Day', '')),
                "detail_page_views": parse_num(r.get('Advertised Product Detail Page Views - 14 Day', '')),
            })
    print(f"  Found {len(all_records)} total rows")
    if not all_records:
        print("  No valid records found"); return
    min_date = min(r["ad_date"] for r in all_records)
    max_date = max(r["ad_date"] for r in all_records)
    cur.execute(f"DELETE FROM MONARCH_RAW.ADS.WALMART_CONNECT_RAW WHERE ad_date BETWEEN '{min_date}' AND '{max_date}'")
    conn.commit()
    insert_sql = """INSERT INTO MONARCH_RAW.ADS.WALMART_CONNECT_RAW
(ad_date,impressions,clicks,spend,ctr,units_sold_14d,sales_revenue_14d,ntb_sales_14d,roas_14d,instore_sales_14d,conversion_rate_14d,detail_page_views)
VALUES (%(ad_date)s,%(impressions)s,%(clicks)s,%(spend)s,%(ctr)s,%(units_sold_14d)s,%(sales_revenue_14d)s,%(ntb_sales_14d)s,%(roas_14d)s,%(instore_sales_14d)s,%(conversion_rate_14d)s,%(detail_page_views)s)"""
    cur.executemany(insert_sql, all_records)
    conn.commit()
    cur.execute(f"SELECT COUNT(*), SUM(spend), SUM(sales_revenue_14d) FROM MONARCH_RAW.ADS.WALMART_CONNECT_RAW WHERE ad_date BETWEEN '{min_date}' AND '{max_date}'")
    row = cur.fetchone()
    print(f"  ✅ {row[0]:,} rows loaded, ${row[1]:,.2f} spend, ${row[2]:,.2f} revenue")
    cur.close(); conn.close()
    print("✅ Walmart Connect ingestion complete!")

if __name__ == "__main__":
    run_walmart_connect_ingestion()
