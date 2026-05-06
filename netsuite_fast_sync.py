import os,requests,time,hmac,hashlib,binascii,urllib.parse,secrets,json,tempfile,base64
from datetime import date,datetime
from dateutil.relativedelta import relativedelta
from cryptography.hazmat.primitives.serialization import load_pem_private_key,Encoding,PrivateFormat,NoEncryption
import snowflake.connector

AID="1307706";CK=os.environ["NETSUITE_CLIENT_ID"];CS=os.environ["NETSUITE_CLIENT_SECRET"]
TI=os.environ["NETSUITE_TOKEN_ID"];TS=os.environ["NETSUITE_TOKEN_SECRET"]
STAGE="MONARCH_RAW.FINANCE.NETSUITE_STAGE";TABLE="MONARCH_RAW.FINANCE.NETSUITE_SALES_BY_PRODUCT"
START_DATE="2025-01-01";END_DATE=date.today().isoformat()

def get_sf():
    key_path=os.environ.get("SNOWFLAKE_PRIVATE_KEY_PATH","/home/runner/workspace/monarch_private_key.pem")
    with open(key_path,"rb") as f:
        pk=load_pem_private_key(f.read(),password=None)
    pkd=pk.private_bytes(Encoding.DER,PrivateFormat.PKCS8,NoEncryption())
    return snowflake.connector.connect(account=os.environ["SNOWFLAKE_ACCOUNT"],user=os.environ["SNOWFLAKE_USER"],private_key=pkd,database=os.environ["SNOWFLAKE_DATABASE"],warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],schema="FINANCE")

def ns_query(sql,retries=3):
    url=f"https://{AID}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql"
    for attempt in range(retries):
        try:
            no=secrets.token_hex(16);t=str(int(time.time()))
            bp=f"oauth_consumer_key={CK}&oauth_nonce={no}&oauth_signature_method=HMAC-SHA256&oauth_timestamp={t}&oauth_token={TI}&oauth_version=1.0"
            bs="&".join(["POST",urllib.parse.quote(url,safe=''),urllib.parse.quote(bp,safe='')])
            sk=f"{urllib.parse.quote(CS,safe='')}&{urllib.parse.quote(TS,safe='')}"
            sig=binascii.b2a_base64(hmac.new(sk.encode(),bs.encode(),hashlib.sha256).digest()).decode().strip()
            ah=f'OAuth realm="{AID}",oauth_consumer_key="{CK}",oauth_token="{TI}",oauth_signature_method="HMAC-SHA256",oauth_timestamp="{t}",oauth_nonce="{no}",oauth_version="1.0",oauth_signature="{urllib.parse.quote(sig,safe="")}"'
            resp=requests.post(url,headers={"Authorization":ah,"Content-Type":"application/json","Prefer":"transient"},json={"q":sql},timeout=120)
            if resp.status_code==200: return resp.json().get("items",[])
            print(f"  HTTP {resp.status_code}: {resp.text[:200]}",flush=True)
        except Exception as e:
            print(f"  Attempt {attempt+1} failed: {e}",flush=True);time.sleep(5*(attempt+1))
    return []

def month_chunks(start_str,end_str):
    start=datetime.strptime(start_str,"%Y-%m-%d").date();end=datetime.strptime(end_str,"%Y-%m-%d").date();cur=start.replace(day=1)
    while cur<=end:
        yield cur.isoformat(),(min(cur+relativedelta(months=1)-relativedelta(days=1),end)).isoformat();cur+=relativedelta(months=1)

def bulk_load(cur,rows,store_name,store_type,entity_id,month_start):
    if not rows: return 0
    tmp=f"/tmp/ns_{store_name.replace(' ','_').replace('(','').replace(')','')}_{month_start}.jsonl"
    with open(tmp,"w") as f:
        for r in rows:
            f.write(json.dumps({"ENTITY_ID":entity_id,"STORE_NAME":store_name,"STORE_TYPE":store_type,"TRANDATE":r.get("trandate"),"ITEM_ID":str(r.get("item","")),"SKU":r.get("sku",""),"PRODUCT_NAME":r.get("product_name",""),"UPCCODE":r.get("upccode",""),"UNITS":r.get("units",0),"REVENUE":r.get("revenue",0)})+"\n")
    cur.execute(f"PUT file://{tmp} @{STAGE} AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
    fname=os.path.basename(tmp)+".gz"
    cur.execute(f"COPY INTO {TABLE} (ENTITY_ID,STORE_NAME,STORE_TYPE,TRANDATE,ITEM_ID,SKU,PRODUCT_NAME,UPCCODE,UNITS,REVENUE) FROM (SELECT $1:ENTITY_ID::STRING,$1:STORE_NAME::STRING,$1:STORE_TYPE::STRING,$1:TRANDATE::DATE,$1:ITEM_ID::STRING,$1:SKU::STRING,$1:PRODUCT_NAME::STRING,$1:UPCCODE::STRING,$1:UNITS::FLOAT,$1:REVENUE::FLOAT FROM @{STAGE}/{fname}) FILE_FORMAT=(TYPE='JSON' STRIP_OUTER_ARRAY=FALSE) PURGE=TRUE")
    os.unlink(tmp);return len(rows)

def sync_entity(entity_id,store_name,store_type,conn):
    print(f"\n=== {store_name} ===",flush=True)
    cur=conn.cursor()
    cur.execute(f"DELETE FROM {TABLE} WHERE STORE_NAME='{store_name}'")
    total=0
    for month_start,month_end in month_chunks(START_DATE,END_DATE):
        sql=f"SELECT i.entity,i.trandate,tl.item,inv.itemid AS sku,inv.fullname AS product_name,inv.upccode,SUM(ABS(tl.quantity)) AS units,SUM(tl.creditforeignamount) AS revenue FROM invoice i INNER JOIN TransactionLine tl ON i.id=tl.transaction INNER JOIN InventoryItem inv ON tl.item=inv.id WHERE i.trandate>=TO_DATE('{month_start}','YYYY-MM-DD') AND i.trandate<=TO_DATE('{month_end}','YYYY-MM-DD') AND i.total>0 AND tl.mainline='F' AND tl.taxline='F' AND tl.item IS NOT NULL AND i.entity='{entity_id}' GROUP BY i.entity,i.trandate,tl.item,inv.itemid,inv.fullname,inv.upccode ORDER BY i.trandate DESC"
        rows=ns_query(sql)
        count=bulk_load(cur,rows,store_name,store_type,entity_id,month_start)
        total+=count;print(f"  {month_start}: {count} rows (total: {total})",flush=True)
    conn.commit();cur.close();print(f"  ✅ {store_name}: {total} rows",flush=True);return total

if __name__=="__main__":
    print(f"NetSuite Fast Sync — {date.today()}",flush=True)
    conn=get_sf()
    cur=conn.cursor();cur.execute(f"USE SCHEMA MONARCH_RAW.FINANCE");cur.close()
    stores=[("49270","Amazon (Pattern)","Marketplace"),("633","Publix","Retail"),("228","Kroger","Retail"),("229","Target","Retail"),("231","Walmart","Retail")]
    total=sum(sync_entity(eid,sn,st,conn) for eid,sn,st in stores)
    conn.close();print(f"\n✅ Done! {total} total rows",flush=True)
