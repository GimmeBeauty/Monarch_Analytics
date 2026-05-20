import os, boto3, io, csv, json, tempfile, sys
from datetime import date
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

CIRCANA_BUCKET = "circana-monarch-retail-466089068963-us-west-2-an"
CIRCANA_KEY = "monarch-circana-retail.csv"

def parse_circana_file(content):
    lines = content.split('\n')
    sections = []
    current_retailer = None
    current_time = None
    current_rows = []
    headers = None
    in_data = False
    for line in lines:
        line = line.strip()
        if line.startswith('Geography:'):
            if current_retailer and current_rows:
                sections.append((current_retailer, current_time, headers, current_rows))
            current_retailer = line.replace('Geography:','').strip()
            current_time = None; current_rows = []; headers = None; in_data = False
        elif line.startswith('Time:'):
            current_time = line.replace('Time:','').strip()
        elif line.startswith('Product,'):
            headers = [h.strip() for h in line.split(',')]; in_data = True
        elif in_data and line and not line.startswith('Geography:'):
            row = list(csv.reader([line]))[0]
            if len(row) >= 2 and row[0]: current_rows.append(row)
    if current_retailer and current_rows:
        sections.append((current_retailer, current_time, headers, current_rows))
    return sections

def run_circana_ingestion():
    print("Pulling Circana data from S3...")
    s3 = boto3.client('s3',aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],region_name='us-west-2')
    obj = s3.get_object(Bucket=CIRCANA_BUCKET, Key=CIRCANA_KEY)
    content = obj['Body'].read().decode('utf-8',errors='replace')
    sections = parse_circana_file(content)
    print(f"  Found {len(sections)} sections")
    sys.path.insert(0,"/home/runner/workspace")
    from snowflake_connect import get_connection
    conn = get_connection(schema="RETAIL"); cur = conn.cursor()
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
    today = date.today().isoformat(); total = 0
    for retailer, time_period, headers, rows in sections:
        print(f"  Loading {retailer} — {time_period}: {len(rows)} products")
        cur.execute(f"DELETE FROM MONARCH_RAW.RETAIL.CIRCANA_POS_RAW WHERE retailer='{retailer}' AND time_period='{time_period}'")
        records = []
        for i, row in enumerate(rows):
            if not headers or len(row) < 2: continue
            rec = dict(zip(headers, row))
            product = rec.get('Product',''); upc = ''
            if ' - 0' in product:
                parts = product.rsplit(' - 0',1); product = parts[0].strip()
                upc = '0'+parts[1].strip() if len(parts)>1 else ''
            records.append({"ID":f"circana_{retailer.replace(' ','_')}_{i}","RETAILER":retailer,"TIME_PERIOD":time_period,"PRODUCT":product,"UPC":upc,"CATEGORY":rec.get('Category Name',''),"SUBCATEGORY":rec.get('Sub-Category Name',''),"BRAND":rec.get('Brand Franchise Name',''),"DOLLAR_SALES":float(rec.get('Dollar Sales',0) or 0),"UNIT_SALES":float(rec.get('Unit Sales',0) or 0),"PRICE_PER_UNIT":float(rec.get('Price per Unit',0) or 0),"STORES_SELLING":float(rec.get('Number of Stores Selling',0) or 0),"AVG_ITEMS_PER_STORE":float(rec.get('Avg Items per Store Selling',0) or 0),"DOLLARS_PER_STORE":float(rec.get('Dollars per Store Selling',0) or 0),"INGESTION_DATE":today})
        tmp = tempfile.NamedTemporaryFile(mode='w',suffix='.jsonl',delete=False,dir='/tmp')
        for r in records: tmp.write(json.dumps(r)+"\n")
        tmp.close()
        cur.execute(f"PUT file://{tmp.name} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
        cur.execute("COPY INTO MONARCH_RAW.RETAIL.CIRCANA_POS_RAW (id,retailer,time_period,product,upc,category,subcategory,brand,dollar_sales,unit_sales,price_per_unit,stores_selling,avg_items_per_store,dollars_per_store,ingestion_date) FROM (SELECT $1:ID::STRING,$1:RETAILER::STRING,$1:TIME_PERIOD::STRING,$1:PRODUCT::STRING,$1:UPC::STRING,$1:CATEGORY::STRING,$1:SUBCATEGORY::STRING,$1:BRAND::STRING,$1:DOLLAR_SALES::FLOAT,$1:UNIT_SALES::FLOAT,$1:PRICE_PER_UNIT::FLOAT,$1:STORES_SELLING::FLOAT,$1:AVG_ITEMS_PER_STORE::FLOAT,$1:DOLLARS_PER_STORE::FLOAT,$1:INGESTION_DATE::DATE FROM @monarch_stage) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'")
        os.unlink(tmp.name); total+=len(records); print(f"    ✅ {len(records)} rows")
    cur.close(); conn.close()
    print(f"✅ Circana complete: {total} total rows")

if __name__ == "__main__":
    run_circana_ingestion()
