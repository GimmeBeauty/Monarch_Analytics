import os, boto3, io, csv, json, tempfile, sys, re
from datetime import datetime
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

AGILITY_BUCKET = "monarch-agility-sheet-466089068963-us-west-2-an"
DSP_KEY = "google-sheets/monarch-agility/Monarch Agility CTV_Programmatic _ Display - Monarch-Agility-Amazon-DSP.csv"

def parse_date(d):
    try:
        return datetime.strptime(d, "%m/%d/%y").date().isoformat()
    except:
        return None

def parse_money(s):
    if not s or s in ("US$NaN", "NaN", "—", ""):
        return 0.0
    s = s.replace("US$", "").replace(",", "").strip()
    try:
        return float(s)
    except:
        return 0.0

def parse_num(s):
    if not s or s in ("NaN", "—", ""):
        return 0
    try:
        return int(float(s))
    except:
        return 0

def run_amazon_dsp_ingestion():
    print("Pulling Amazon DSP data from S3...")
    s3 = boto3.client('s3',aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],region_name='us-west-2')
    obj = s3.get_object(Bucket=AGILITY_BUCKET, Key=DSP_KEY)
    content = obj['Body'].read().decode('utf-8', errors='replace')
    rows = list(csv.DictReader(io.StringIO(content)))
    print(f"  Found {len(rows)} rows")
    sys.path.insert(0, "/home/runner/workspace")
    from snowflake_connect import get_connection
    conn = get_connection(schema="ADS")
    cur = conn.cursor()
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
    records = []
    for r in rows:
        ad_date = parse_date(r.get('Date', ''))
        if not ad_date: continue
        records.append({
            "AD_DATE": ad_date,
            "CHANNEL": r.get('Channel', ''),
            "CAMPAIGN_NAME": r.get('Campaign name', ''),
            "ADVERTISER_ACCOUNT": r.get('Advertiser account name', ''),
            "COUNTRY": r.get('Country', ''),
            "STATUS": r.get('Status', ''),
            "TYPE": r.get('Type', ''),
            "CAMPAIGN_BUDGET": parse_money(r.get('Campaign budget amount', '')),
            "IMPRESSIONS": parse_num(r.get('Impressions', '')),
            "CPM": parse_money(r.get('CPM', '')),
            "CLICKS": parse_num(r.get('Clicks', '')),
            "CTR": float(r.get('CTR','0') or 0),
            "CPC": parse_money(r.get('CPC', '')),
            "VIEWABLE_IMPRESSIONS": parse_num(r.get('Viewable impressions', '')),
            "TOTAL_COST": parse_money(r.get('Total cost', '')),
            "PURCHASES": parse_num(r.get('Purchases', '')),
            "SALES": parse_money(r.get('Sales', '')),
            "ROAS": float(r.get('ROAS','0') or 0),
            "PURCHASES_NTB": parse_num(r.get('Purchases (new to brand)', '')),
            "SALES_NTB": parse_money(r.get('Sales (new to brand)', '')),
            "DETAIL_PAGE_VIEWS": parse_num(r.get('Detail page views', '')),
            "BRANDED_SEARCHES": parse_num(r.get('Branded searches', '')),
        })
    if not records:
        print("  No valid records found"); return
    min_date = min(r["AD_DATE"] for r in records)
    max_date = max(r["AD_DATE"] for r in records)
    cur.execute(f"DELETE FROM MONARCH_RAW.ADS.AMAZON_DSP_RAW WHERE ad_date BETWEEN '{min_date}' AND '{max_date}'")
    tmp = tempfile.NamedTemporaryFile(mode='w',suffix='.jsonl',delete=False,dir='/tmp')
    for rec in records: tmp.write(json.dumps(rec)+"\n")
    tmp.close()
    cur.execute(f"PUT file://{tmp.name} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
    cur.execute("COPY INTO MONARCH_RAW.ADS.AMAZON_DSP_RAW (ad_date,channel,campaign_name,advertiser_account,country,status,type,campaign_budget,impressions,cpm,clicks,ctr,cpc,viewable_impressions,total_cost,purchases,sales,roas,purchases_ntb,sales_ntb,detail_page_views,branded_searches) FROM (SELECT $1:AD_DATE::DATE,$1:CHANNEL::STRING,$1:CAMPAIGN_NAME::STRING,$1:ADVERTISER_ACCOUNT::STRING,$1:COUNTRY::STRING,$1:STATUS::STRING,$1:TYPE::STRING,$1:CAMPAIGN_BUDGET::FLOAT,$1:IMPRESSIONS::INTEGER,$1:CPM::FLOAT,$1:CLICKS::INTEGER,$1:CTR::FLOAT,$1:CPC::FLOAT,$1:VIEWABLE_IMPRESSIONS::INTEGER,$1:TOTAL_COST::FLOAT,$1:PURCHASES::INTEGER,$1:SALES::FLOAT,$1:ROAS::FLOAT,$1:PURCHASES_NTB::INTEGER,$1:SALES_NTB::FLOAT,$1:DETAIL_PAGE_VIEWS::INTEGER,$1:BRANDED_SEARCHES::INTEGER FROM @monarch_stage) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'")
    os.unlink(tmp.name)
    cur.execute(f"SELECT COUNT(*), SUM(total_cost), SUM(sales) FROM MONARCH_RAW.ADS.AMAZON_DSP_RAW WHERE ad_date BETWEEN '{min_date}' AND '{max_date}'")
    row = cur.fetchone()
    print(f"  ✅ {row[0]:,} rows loaded, ${row[1]:,.2f} spend, ${row[2]:,.2f} sales")
    cur.close(); conn.close()
    print("✅ Amazon DSP ingestion complete!")

if __name__ == "__main__":
    run_amazon_dsp_ingestion()
