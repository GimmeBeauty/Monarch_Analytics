import os,requests,time,hmac,hashlib,binascii,urllib.parse,secrets,base64,json,tempfile
from datetime import date
import snowflake.connector
from cryptography.hazmat.primitives.serialization import load_pem_private_key,Encoding,PrivateFormat,NoEncryption

aid="1307706";ck=os.environ["NETSUITE_CLIENT_ID"];cs=os.environ["NETSUITE_CLIENT_SECRET"];ti=os.environ["NETSUITE_TOKEN_ID"];ts=os.environ["NETSUITE_TOKEN_SECRET"];today=date.today().isoformat()
STAGE="MONARCH_RAW.FINANCE.NETSUITE_STAGE"

def ns(sql, retries=3):
    for attempt in range(retries):
        try:
            url=f"https://{aid}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql";no=secrets.token_hex(16);t=str(int(time.time()))
            bs="&".join(["POST",urllib.parse.quote(url,safe=''),urllib.parse.quote(f"oauth_consumer_key={ck}&oauth_nonce={no}&oauth_signature_method=HMAC-SHA256&oauth_timestamp={t}&oauth_token={ti}&oauth_version=1.0",safe='')])
            sk=f"{urllib.parse.quote(cs,safe='')}&{urllib.parse.quote(ts,safe='')}";sig=binascii.b2a_base64(hmac.new(sk.encode(),bs.encode(),hashlib.sha256).digest()).decode().strip()
            ah=f'OAuth realm="{aid}",oauth_consumer_key="{ck}",oauth_token="{ti}",oauth_signature_method="HMAC-SHA256",oauth_timestamp="{t}",oauth_nonce="{no}",oauth_version="1.0",oauth_signature="{urllib.parse.quote(sig,safe="")}"'
            resp=requests.post(url,headers={"Authorization":ah,"Content-Type":"application/json","Prefer":"transient"},json={"q":sql},timeout=60)
            return resp.json()
        except Exception as e:
            print(f"  Retry {attempt+1}/{retries} after error: {e}",flush=True)
            time.sleep(10)
    return {"items":[]}

pk=base64.b64decode(os.environ["SNOWFLAKE_PRIVATE_KEY_B64"]).decode("utf8")
pkd=load_pem_private_key(pk.encode(),password=None).private_bytes(Encoding.DER,PrivateFormat.PKCS8,NoEncryption())
conn=snowflake.connector.connect(account=os.environ["SNOWFLAKE_ACCOUNT"],user=os.environ["SNOWFLAKE_USER"],private_key=pkd,database=os.environ["SNOWFLAKE_DATABASE"],warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],schema="FINANCE")
cur=conn.cursor()

def sync_entity(entity,store_name,store_type):
    print(f"Starting {store_name}...",flush=True)
    sql=f"SELECT i.entity, i.trandate, tl.item, inv.itemid as sku, inv.fullname as product_name, inv.upccode, SUM(ABS(tl.quantity)) as units, SUM(tl.creditforeignamount) as revenue FROM invoice i INNER JOIN transactionLine tl ON i.id=tl.transaction INNER JOIN inventoryitem inv ON tl.item=inv.id WHERE i.trandate>='1/1/2025' AND i.total > 0 AND tl.mainline='F' AND tl.taxline='F' AND tl.item IS NOT NULL AND i.entity='{entity}' GROUP BY i.entity, i.trandate, tl.item, inv.itemid, inv.fullname, inv.upccode ORDER BY i.trandate DESC"
    all_items,offset=[],0
    while True:
        items=ns(f"{sql} OFFSET {offset} ROWS FETCH FIRST 1000 ROWS ONLY").get("items",[])
        all_items.extend(items)
        print(f"  {store_name} page {offset//1000+1}: {len(all_items)} rows",flush=True)
        if len(items)<1000: break
        offset+=1000
    if not all_items:
        print(f"  No data for {store_name}, skipping",flush=True)
        return
    cur.execute(f"DELETE FROM NETSUITE_SALES_BY_PRODUCT WHERE STORE_NAME='{store_name}'")
    with tempfile.NamedTemporaryFile(mode='w',suffix='.jsonl',delete=False,dir='/home/runner/workspace') as f:
        tmp=f.name
        for o in all_items:
            f.write(json.dumps({"ENTITY_ID":entity,"STORE_NAME":store_name,"STORE_TYPE":store_type,"TRANDATE":o.get("trandate"),"ITEM_ID":o.get("item"),"SKU":o.get("sku"),"PRODUCT_NAME":o.get("product_name"),"UPCCODE":o.get("upccode"),"UNITS":o.get("units"),"REVENUE":o.get("revenue")})+"\n")
    cur.execute(f"PUT file://{tmp} @{STAGE} AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
    cur.execute(f"DELETE FROM NETSUITE_SALES_BY_PRODUCT WHERE STORE_NAME='{store_name}'")
    cur.execute(f"COPY INTO NETSUITE_SALES_BY_PRODUCT (ENTITY_ID,STORE_NAME,STORE_TYPE,TRANDATE,ITEM_ID,SKU,PRODUCT_NAME,UPCCODE,UNITS,REVENUE) FROM (SELECT $1:ENTITY_ID::STRING,$1:STORE_NAME::STRING,$1:STORE_TYPE::STRING,$1:TRANDATE::DATE,$1:ITEM_ID::STRING,$1:SKU::STRING,$1:PRODUCT_NAME::STRING,$1:UPCCODE::STRING,$1:UNITS::FLOAT,$1:REVENUE::FLOAT FROM @{STAGE}) FILE_FORMAT=(TYPE='JSON' STRIP_OUTER_ARRAY=FALSE) PURGE=TRUE")
    os.unlink(tmp)
    print(f"DONE {store_name}: {len(all_items)} rows loaded",flush=True)

# Skipping Walmart and Target for now - too large, will do separately
for entity,store_name,store_type in [
    ("222","CVS","Retail"),
    ("230","Ulta Beauty","Retail"),
    ("1068","Walgreens","Retail"),
    ("49270","Amazon (Pattern)","Marketplace"),
    ("633","Publix","Retail"),
    ("228","Kroger","Retail")
]:
    sync_entity(entity,store_name,store_type)

conn.commit();cur.close();conn.close()
print("ALL SMALLER STORES DONE",flush=True)
