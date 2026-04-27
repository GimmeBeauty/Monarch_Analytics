import requests, os, zipfile, io, json, csv
import snowflake.connector
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")
KW_URL="https://securesharek.target.com"
KW_CLIENT_ID="1c9f2b24-847e-5ee6-acc4-f03c8da0cfba"
KW_CLIENT_SECRET="2bLyg*oqja"
KW_USERNAME="nick@gimmebeauty.com"
KW_PASSWORD=os.environ.get("TARGET_KW_PASSWORD","TjNc030715!!")
KW_FOLDER_ID="58077025"
def get_kw_token():
    r=requests.post(f"{KW_URL}/oauth/token",data={"grant_type":"password","client_id":KW_CLIENT_ID,"client_secret":KW_CLIENT_SECRET,"username":KW_USERNAME,"password":KW_PASSWORD},timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]
def list_kw_files(token):
    r=requests.get(f"{KW_URL}/rest/folders/{KW_FOLDER_ID}/children",headers={"Authorization":f"Bearer {token}"},timeout=30)
    r.raise_for_status()
    return r.json().get("data",[])
def download_kw_file(token,file_id):
    r=requests.get(f"{KW_URL}/rest/files/{file_id}/content",headers={"Authorization":f"Bearer {token}"},timeout=60)
    r.raise_for_status()
    return r.content
def parse_target_sales(content):
    text=content.decode("utf-8",errors="replace")
    reader=csv.DictReader(io.StringIO(text),delimiter="\t")
    return [dict(row) for row in reader]
def run():
    print("Authenticating...")
    token=get_kw_token()
    print("✅ Authenticated")
    files=list_kw_files(token)
    print(f"Found {len(files)} files")
    yesterday=(date.today()-timedelta(days=1)).strftime("%m%d%Y")
    today=date.today().strftime("%m%d%Y")
    target_files=[f for f in files if "DAILY_SALES" in f.get("name","") and (yesterday in f.get("name","") or today in f.get("name",""))]
    print(f"Sales files found: {len(target_files)}")
    if not target_files:
        print("No files found")
        return
    from snowflake_connect import get_connection
    conn=get_connection(schema="RETAIL")
    cur=conn.cursor()
    for file_info in target_files:
        print(f"Downloading {file_info['name']}...")
        content=download_kw_file(token,file_info["id"])
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            txt_files=[n for n in z.namelist() if n.endswith(".txt")]
            if not txt_files:
                continue
            txt_content=z.read(txt_files[0])
        records=parse_target_sales(txt_content)
        print(f"Parsed {len(records)} records")
        ingestion_date=date.today().isoformat()
        cur.execute(f"DELETE FROM TARGET_POS_RAW WHERE ingestion_date='{ingestion_date}' AND source='target_daily_sales'")
        for rec in records:
            cur.execute("INSERT INTO TARGET_POS_RAW (id,ingestion_date,source,raw_data) SELECT %s,%s::DATE,%s,PARSE_JSON(%s)",(f"{rec.get('BARCODE_TCIN','')}_{rec.get('SALES_DATE','')}_{rec.get('LOCATION_ID','')}",ingestion_date,"target_daily_sales",json.dumps(rec)))
        print(f"✅ {len(records)} records written")
    cur.close()
    conn.close()
    print("✅ Target ingestion complete!")
if __name__=="__main__":
    run()
