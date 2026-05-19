import os, boto3, zipfile, io, csv, json, tempfile
from datetime import date
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

def run_roundel_ingestion():
    print("Pulling Roundel data from S3...")
    s3 = boto3.client('s3',
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        region_name='us-west-2')
    bucket = os.environ["ROUNDEL_S3_BUCKET"]
    response = s3.list_objects_v2(Bucket=bucket)
    files = response.get('Contents', [])
    if not files:
        print("  No files found"); return
    import sys
    sys.path.insert(0, "/home/runner/workspace")
    from snowflake_connect import get_connection
    conn = get_connection(schema="ROUNDEL")
    cur = conn.cursor()
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
    today = date.today().isoformat()
    total = 0
    for obj in files:
        key = obj['Key']
        print(f"  Processing: {key}")
        file_obj = s3.get_object(Bucket=bucket, Key=key)
        with zipfile.ZipFile(io.BytesIO(file_obj['Body'].read())) as z:
            for csv_name in z.namelist():
                if not csv_name.endswith('.csv'): continue
                report_type = csv_name.replace('.csv','').strip()
                content = z.read(csv_name).decode('utf-8',errors='replace')
                rows = list(csv.DictReader(io.StringIO(content)))
                if not rows: continue
                tmp = tempfile.NamedTemporaryFile(mode='w',suffix='.jsonl',delete=False,dir='/tmp')
                for i,row in enumerate(rows):
                    tmp.write(json.dumps({"ID":f"roundel_{report_type.replace(' ','_')}_{today}_{i}","INGESTION_DATE":today,"REPORT_TYPE":report_type,"SOURCE":"roundel_target","RAW_DATA":json.dumps(row)})+"\n")
                tmp.close()
                cur.execute(f"DELETE FROM MONARCH_RAW.ROUNDEL.ROUNDEL_ADS_RAW WHERE ingestion_date='{today}' AND report_type='{report_type}'")
                cur.execute(f"PUT file://{tmp.name} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
                cur.execute("COPY INTO MONARCH_RAW.ROUNDEL.ROUNDEL_ADS_RAW (id,ingestion_date,report_type,source,raw_data) FROM (SELECT $1:ID::STRING,$1:INGESTION_DATE::DATE,$1:REPORT_TYPE::STRING,$1:SOURCE::STRING,PARSE_JSON($1:RAW_DATA::STRING) FROM @monarch_stage) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'")
                os.unlink(tmp.name); total+=len(rows)
                print(f"    ✅ {report_type}: {len(rows)} rows")
    cur.close(); conn.close()
    print(f"✅ Roundel complete: {total} rows")

if __name__ == "__main__":
    run_roundel_ingestion()
