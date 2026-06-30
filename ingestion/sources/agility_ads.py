import os, boto3, io, csv, json, tempfile, sys
from datetime import datetime
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

AGILITY_BUCKET = "monarch-agility-sheet-466089068963-us-west-2-an"
AGILITY_KEY = "google-sheets/monarch-agility/Monarch Agility CTV_Programmatic _ Display - Monarch-Agility-Data-PBA (1).csv"

def parse_date(d):
    try:
        return datetime.strptime(d, "%m/%d/%y").date().isoformat()
    except:
        return None

def run_agility_ingestion():
    print("Pulling Agility data from S3...")
    s3 = boto3.client('s3',aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],region_name='us-west-2')
    obj = s3.get_object(Bucket=AGILITY_BUCKET, Key=AGILITY_KEY)
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
        records.append({"AD_DATE":ad_date,"AGREEMENT_NAME":r.get('Agility Agreement Name',''),"CAMPAIGN":r.get('Campaign',''),"AD_GROUP":r.get('Ad Group',''),"CHANNEL":r.get('Channel',''),"PERSONA":r.get('Persona',''),"SPEND":float(r.get('Spend',0) or 0),"IMPRESSIONS":int(float(r.get('Impression',0) or 0)),"BIDS":int(float(r.get('Bids',0) or 0)) if r.get('Bids') else 0,"CLICKS":int(float(r.get('Clicks',0) or 0)),"TRAFFIC_CONVERSIONS":int(float(r.get('Traffic Conversions (Last Touch)',0) or 0)),"HIGH_INTENT_TRAFFIC":int(float(r.get('High-Intent Traffic (Last Touch)',0) or 0)),"SALES_ACTIVATION":int(float(r.get('Sales Activation (Last-Touch)',0) or 0)),"REALIZED_SALES":int(float(r.get('Realized Sales (Last-Touch)',0) or 0)),"REALIZED_REVENUE":float(r.get('Realized Sales Revenue (Last-Touch)',0) or 0)})
    if not records:
        print("  No valid records found"); return
    min_date = min(r["AD_DATE"] for r in records)
    max_date = max(r["AD_DATE"] for r in records)
    cur.execute(f"DELETE FROM MONARCH_RAW.ADS.AGILITY_ADS_RAW WHERE ad_date BETWEEN '{min_date}' AND '{max_date}'")
    tmp = tempfile.NamedTemporaryFile(mode='w',suffix='.jsonl',delete=False,dir='/tmp')
    for rec in records: tmp.write(json.dumps(rec)+"\n")
    tmp.close()
    cur.execute(f"PUT file://{tmp.name} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
    cur.execute("COPY INTO MONARCH_RAW.ADS.AGILITY_ADS_RAW (ad_date,agreement_name,campaign,ad_group,channel,persona,spend,impressions,bids,clicks,traffic_conversions,high_intent_traffic,sales_activation,realized_sales,realized_revenue) FROM (SELECT $1:AD_DATE::DATE,$1:AGREEMENT_NAME::STRING,$1:CAMPAIGN::STRING,$1:AD_GROUP::STRING,$1:CHANNEL::STRING,$1:PERSONA::STRING,$1:SPEND::FLOAT,$1:IMPRESSIONS::INTEGER,$1:BIDS::INTEGER,$1:CLICKS::INTEGER,$1:TRAFFIC_CONVERSIONS::INTEGER,$1:HIGH_INTENT_TRAFFIC::INTEGER,$1:SALES_ACTIVATION::INTEGER,$1:REALIZED_SALES::INTEGER,$1:REALIZED_REVENUE::FLOAT FROM @monarch_stage) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'")
    os.unlink(tmp.name)
    cur.execute(f"SELECT COUNT(*), SUM(spend), SUM(realized_revenue) FROM MONARCH_RAW.ADS.AGILITY_ADS_RAW WHERE ad_date BETWEEN '{min_date}' AND '{max_date}'")
    row = cur.fetchone()
    print(f"  ✅ {row[0]:,} rows loaded, ${row[1]:,.2f} spend, ${row[2]:,.2f} revenue")
    cur.close(); conn.close()
    print("✅ Agility ingestion complete!")

if __name__ == "__main__":
    run_agility_ingestion()
