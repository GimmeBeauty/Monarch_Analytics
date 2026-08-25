import sys, os, zipfile, io, json, tempfile
sys.path.insert(0, "/home/runner/workspace")
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")
from datetime import date

from ingestion.sources.target_kiteworks import get_kw_token, list_kw_files, download_kw_file
from snowflake_connect import get_connection

def parse_inventory_file(txt_content):
    lines = txt_content.decode('utf-8', errors='replace').split('\n')
    header = lines[0].split('\t')
    col_idx = {name.strip(): i for i, name in enumerate(header)}
    records = []
    for line in lines[1:]:
        if not line.strip():
            continue
        fields = line.split('\t')
        if len(fields) < len(header):
            continue
        try:
            records.append({
                "BUSINESS_DATE": fields[col_idx["BUSINESS_D"]].strip(),
                "TCIN": fields[col_idx["TCIN"]].strip(),
                "DPCI": fields[col_idx["DPCI"]].strip(),
                "ITEM_DESCRIPTION": fields[col_idx["ITEM_DESCRIPTION"]].strip(),
                "LOCATION_ID": fields[col_idx["LOCATION_ID"]].strip(),
                "ENDING_ON_HAND_Q": float(fields[col_idx["ENDING_ON_HAND_Q"]].strip() or 0),
                "INSTOCK_PERCENTAGE": float(fields[col_idx["INSTOCK_PERCENTAGE"]].strip() or 0),
                "OUT_OF_STOCK_Q": int(float(fields[col_idx["OUT_OF_STOCK_Q"]].strip() or 0)),
            })
        except (ValueError, IndexError):
            continue
    return records
def run_inventory_backfill(days_back=8):
    print("Authenticating...", flush=True)
    token = get_kw_token()
    print("✅ Authenticated", flush=True)

    files = list_kw_files(token)
    inv_files = sorted([f for f in files if "DAILY_INV_TCIN_LOC" in f.get("name","")], key=lambda f: f.get("name",""))
    print(f"Found {len(inv_files)} daily inventory files", flush=True)

    conn = get_connection(schema="RETAIL")
    cur = conn.cursor()
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")

    for idx, file_info in enumerate(inv_files, 1):
        print(f"\n[{idx}/{len(inv_files)}] Downloading {file_info['name']}...", flush=True)
        content = download_kw_file(token, file_info["id"])
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            txt_files = [n for n in z.namelist() if n.endswith(".txt")]
            if not txt_files:
                continue
            txt_content = z.read(txt_files[0])
        records = parse_inventory_file(txt_content)
        print(f"  Parsed {len(records):,} records", flush=True)
        if not records:
            continue

        biz_date = records[0]["BUSINESS_DATE"]
        cur.execute(f"DELETE FROM MONARCH_RAW.RETAIL.TARGET_INVENTORY_DAILY WHERE business_date='{biz_date}'")
        conn.commit()

        tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, dir='/tmp')
        for rec in records:
            tmp.write(json.dumps(rec) + "\n")
        tmp.close()

        cur.execute(f"PUT file://{tmp.name} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
        fname = os.path.basename(tmp.name) + ".gz"
        cur.execute(f"""COPY INTO MONARCH_RAW.RETAIL.TARGET_INVENTORY_DAILY
(business_date,tcin,dpci,item_description,location_id,ending_on_hand_units,instock_percentage,out_of_stock_flag)
FROM (SELECT $1:BUSINESS_DATE::DATE,$1:TCIN::STRING,$1:DPCI::STRING,$1:ITEM_DESCRIPTION::STRING,
$1:LOCATION_ID::STRING,$1:ENDING_ON_HAND_Q::FLOAT,$1:INSTOCK_PERCENTAGE::FLOAT,$1:OUT_OF_STOCK_Q::INTEGER
FROM @monarch_stage/{fname}) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'""")
        os.unlink(tmp.name)
        conn.commit()
        print(f"  ✅ {len(records):,} records written for {biz_date}", flush=True)

    cur.close()
    conn.close()
    print("\n✅ Inventory backfill complete!", flush=True)

def run_inventory_daily():
    """Pulls only the most recent inventory file (for daily scheduler use)."""
    print("Authenticating...", flush=True)
    token = get_kw_token()
    files = list_kw_files(token)
    inv_files = sorted([f for f in files if "DAILY_INV_TCIN_LOC" in f.get("name","")], key=lambda f: f.get("name",""), reverse=True)
    if not inv_files:
        print("No inventory files found", flush=True)
        return
    latest = inv_files[0]
    print(f"Processing most recent: {latest['name']}", flush=True)

    content = download_kw_file(token, latest["id"])
    with zipfile.ZipFile(io.BytesIO(content)) as z:
        txt_files = [n for n in z.namelist() if n.endswith(".txt")]
        if not txt_files:
            print("No txt file found", flush=True)
            return
        txt_content = z.read(txt_files[0])
    records = parse_inventory_file(txt_content)
    print(f"Parsed {len(records):,} records", flush=True)
    if not records:
        return

    biz_date = records[0]["BUSINESS_DATE"]
    conn = get_connection(schema="RETAIL")
    cur = conn.cursor()
    cur.execute("CREATE TEMP STAGE IF NOT EXISTS monarch_stage FILE_FORMAT = (TYPE = 'JSON')")
    cur.execute(f"DELETE FROM MONARCH_RAW.RETAIL.TARGET_INVENTORY_DAILY WHERE business_date='{biz_date}'")
    conn.commit()

    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, dir='/tmp')
    for rec in records:
        tmp.write(json.dumps(rec) + "\n")
    tmp.close()

    cur.execute(f"PUT file://{tmp.name} @monarch_stage AUTO_COMPRESS=TRUE OVERWRITE=TRUE")
    fname = os.path.basename(tmp.name) + ".gz"
    cur.execute(f"""COPY INTO MONARCH_RAW.RETAIL.TARGET_INVENTORY_DAILY
(business_date,tcin,dpci,item_description,location_id,ending_on_hand_units,instock_percentage,out_of_stock_flag)
FROM (SELECT $1:BUSINESS_DATE::DATE,$1:TCIN::STRING,$1:DPCI::STRING,$1:ITEM_DESCRIPTION::STRING,
$1:LOCATION_ID::STRING,$1:ENDING_ON_HAND_Q::FLOAT,$1:INSTOCK_PERCENTAGE::FLOAT,$1:OUT_OF_STOCK_Q::INTEGER
FROM @monarch_stage/{fname}) FILE_FORMAT=(TYPE='JSON') ON_ERROR='CONTINUE'""")
    os.unlink(tmp.name)
    conn.commit()
    cur.close()
    conn.close()
    print(f"✅ {len(records):,} records written for {biz_date}", flush=True)

if __name__ == "__main__":
    run_inventory_backfill()
