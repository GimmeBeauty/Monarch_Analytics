import os, boto3, io, csv, json, tempfile, sys
from datetime import date
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

WALMART_BUCKET = "walmart-monarch-retail-466089068963-us-west-2-an"
WALMART_KEY = "Monarch_Weekly_Report.csv"

def flush_batch(batch, cur):
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, dir='/tmp')
    dates_in_batch = set(r["BUSINESS_DATE"] for r in batch)
    for r in batch:
        tmp.write(json.dumps(r) + "\n")
    tmp.close()
    for d in dates_in_batch:
        cur.execute(f"DELETE FROM MONARCH_RAW.RETAIL.WALMART_STORE_DAILY_RAW WHERE BUSINESS_DATE='{d}'")
    cur.execute(f"PUT file://{tmp.name} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
    cur.execute("""COPY INTO MONARCH_RAW.RETAIL.WALMART_STORE_DAILY_RAW
(BUSINESS_DATE,BRAND_NAME,ITEM_NAME,PRODUCT_DESCRIPTION,WALMART_ITEM_NUMBER,
WALMART_UPC_NUMBER,CITY_NAME,STATE_OR_PROVINCE_CODE,STORE_NAME,STORE_NUMBER,
STREET_ADDRESS_LINE_1,ZIP_CODE_OR_POSTAL_CODE,POS_QUANTITY_THIS_YEAR,POS_SALES_THIS_YEAR)
FROM (SELECT $1:BUSINESS_DATE::DATE,$1:BRAND_NAME::STRING,$1:ITEM_NAME::STRING,
$1:PRODUCT_DESCRIPTION::STRING,$1:WALMART_ITEM_NUMBER::STRING,$1:WALMART_UPC_NUMBER::STRING,
$1:CITY_NAME::STRING,$1:STATE_OR_PROVINCE_CODE::STRING,$1:STORE_NAME::STRING,
$1:STORE_NUMBER::STRING,$1:STREET_ADDRESS_LINE_1::STRING,$1:ZIP_CODE::STRING,
$1:POS_QUANTITY::STRING,$1:POS_SALES::STRING
FROM @monarch_stage) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'""")
    os.unlink(tmp.name)

def run_walmart_s3_ingestion(after_date="2026-05-01"):
    print(f"Pulling Walmart S3 data after {after_date}...")
    s3 = boto3.client('s3',
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        region_name='us-west-2')
    sys.path.insert(0, "/home/runner/workspace")
    from snowflake_connect import get_connection
    conn = get_connection(schema="RETAIL"); cur = conn.cursor()
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
    response = s3.get_object(Bucket=WALMART_BUCKET, Key=WALMART_KEY)
    reader = csv.DictReader(io.TextIOWrapper(response['Body'], encoding='utf-8', errors='replace'))
    batch = []; total = 0; skipped = 0
    for row in reader:
        d = row.get('business_date','')
        if d <= after_date: skipped += 1; continue
        batch.append({"BUSINESS_DATE":d,"BRAND_NAME":row.get('brand_name',''),"ITEM_NAME":row.get('item_name',''),"PRODUCT_DESCRIPTION":row.get('product_description',''),"WALMART_ITEM_NUMBER":row.get('walmart_item_number',''),"WALMART_UPC_NUMBER":row.get('walmart_upc_number',''),"CITY_NAME":row.get('city_name',''),"STATE_OR_PROVINCE_CODE":row.get('state_or_province_code',''),"STORE_NAME":row.get('store_name',''),"STORE_NUMBER":row.get('store_number',''),"STREET_ADDRESS_LINE_1":row.get('street_address_line_1',''),"ZIP_CODE":row.get('zip_code_or_postal_code',''),"POS_QUANTITY":row.get('pos_quantity_this_year','0'),"POS_SALES":row.get('pos_sales_this_year','0')})
        total += 1
        if len(batch) >= 50000:
            flush_batch(batch, cur); print(f"  {total:,} rows loaded..."); batch = []
    if batch: flush_batch(batch, cur)
    cur.close(); conn.close()
    print(f"✅ Done: {total:,} new rows, {skipped:,} skipped")

if __name__ == "__main__":
    run_walmart_s3_ingestion(after_date="2026-04-24")
