import os, re, boto3, zipfile, io, csv, json, tempfile
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

def _parse_money(s):
    return float(re.sub(r'[$,]', '', str(s or '')) or 0)

def _upsert_weekly_to_daily(cur, rows):
    """Insert 7 daily rows per weekly Roundel row into DAILY_AD_SUMMARY."""
    for row in rows:
        week_str = row.get('Week', '')
        if not week_str or ' to ' not in week_str:
            continue
        try:
            week_start = date.fromisoformat(week_str.split(' to ')[0].strip())
        except ValueError:
            continue

        w_spend  = _parse_money(row.get('Actualized Vendor Spend', 0))
        w_rev    = _parse_money(row.get('Attributed Total Sales', 0))
        w_clicks = _parse_money(row.get('Clicks', 0))
        w_impr   = _parse_money(row.get('Impressions', 0))

        d_spend  = w_spend  / 7
        d_rev    = w_rev    / 7
        d_clicks = round(w_clicks / 7)
        d_impr   = round(w_impr   / 7)
        d_ctr    = f"{(d_clicks / d_impr * 100):.6f}" if d_impr > 0 else "NULL"
        d_cpc    = f"{(d_spend  / d_clicks):.6f}"     if d_clicks > 0 else "NULL"
        d_cpm    = f"{(d_spend  / d_impr * 1000):.6f}" if d_impr > 0 else "NULL"
        d_roas   = f"{(d_rev    / d_spend):.6f}"      if d_spend > 0 else "NULL"

        dates = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]
        dates_sql = "','".join(dates)
        cur.execute(f"DELETE FROM MONARCH_RAW.ADS.DAILY_AD_SUMMARY WHERE channel='roundel_target' AND summary_date IN ('{dates_sql}')")

        values = ", ".join(
            f"('{(week_start + timedelta(days=i)).isoformat()}', 'roundel_target', "
            f"{d_spend:.6f}, {d_impr}, {d_clicks}, 0, {d_rev:.6f}, "
            f"{d_ctr}, {d_cpc}, {d_cpm}, {d_roas}, CURRENT_TIMESTAMP)"
            for i in range(7)
        )
        cur.execute(f"""
            INSERT INTO MONARCH_RAW.ADS.DAILY_AD_SUMMARY
              (summary_date, channel, spend, impressions, clicks, conversions,
               conversion_value, ctr, cpc, cpm, roas, created_at)
            VALUES {values}
        """)

def backfill_roundel_daily(from_date="2025-01-01"):
    """Read ROUNDEL_ADS_RAW and populate DAILY_AD_SUMMARY for all weeks >= from_date."""
    import sys
    sys.path.insert(0, "/home/runner/workspace")
    from snowflake_connect import get_connection
    conn = get_connection(schema="ROUNDEL")
    cur = conn.cursor()
    cur.execute(f"""
        SELECT
          raw_data:"Week"::STRING                                                                AS week,
          TRY_CAST(REGEXP_REPLACE(raw_data:"Actualized Vendor Spend"::STRING,'[$,]','') AS FLOAT) AS spend,
          TRY_CAST(REGEXP_REPLACE(raw_data:"Attributed Total Sales"::STRING, '[$,]','') AS FLOAT) AS revenue,
          TRY_CAST(REGEXP_REPLACE(raw_data:"Clicks"::STRING,                 '[$,]','') AS FLOAT) AS clicks,
          TRY_CAST(REGEXP_REPLACE(raw_data:"Impressions"::STRING,            '[$,]','') AS FLOAT) AS impressions
        FROM MONARCH_RAW.ROUNDEL.ROUNDEL_ADS_RAW
        WHERE report_type = 'Weekly Performance'
          AND TRY_CAST(SPLIT_PART(raw_data:"Week"::STRING,' to ',1) AS DATE) >= '{from_date}'
        ORDER BY week ASC
    """)
    raw_rows = cur.fetchall()
    cols = [d[0].lower() for d in cur.description]
    # Reformat into dicts matching CSV field names for _upsert_weekly_to_daily
    rows = []
    for r in raw_rows:
        d = dict(zip(cols, r))
        rows.append({
            'Week':                     d['week'],
            'Actualized Vendor Spend':  str(d['spend']       or 0),
            'Attributed Total Sales':   str(d['revenue']     or 0),
            'Clicks':                   str(d['clicks']      or 0),
            'Impressions':              str(d['impressions'] or 0),
        })
    print(f"  Backfilling {len(rows)} weekly rows into DAILY_AD_SUMMARY...")
    _upsert_weekly_to_daily(cur, rows)
    conn.commit()
    cur.close(); conn.close()
    print(f"  ✅ Backfill complete: {len(rows) * 7} daily rows written for roundel_target")

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
                if report_type == 'Weekly Performance':
                    _upsert_weekly_to_daily(cur, rows)
                    conn.commit()
                    print(f"    ✅ DAILY_AD_SUMMARY: {len(rows) * 7} daily rows written for roundel_target")
    cur.close(); conn.close()
    print(f"✅ Roundel complete: {total} rows")

if __name__ == "__main__":
    import sys
    if "--backfill" in sys.argv:
        print("Running Roundel → DAILY_AD_SUMMARY backfill...")
        backfill_roundel_daily(from_date="2025-01-01")
    else:
        run_roundel_ingestion()
