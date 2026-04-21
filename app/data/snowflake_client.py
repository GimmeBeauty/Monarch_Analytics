import os
import json
import warnings
import snowflake.connector
from dotenv import load_dotenv

load_dotenv()
warnings.filterwarnings("ignore")


def get_connection():
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
        database=os.environ["SNOWFLAKE_DATABASE"],
        login_timeout=30,
    )


def query_date_range(schema: str, table: str, days: int) -> list[dict]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        sql = f"""
            SELECT raw_data
            FROM {os.environ['SNOWFLAKE_DATABASE']}.{schema}.{table}
            WHERE ingestion_date >= DATEADD(day, -{days}, CURRENT_DATE())
            ORDER BY ingested_at ASC
        """
        cur.execute(sql)
        rows = cur.fetchall()
        result = []
        for row in rows:
            raw = row[0]
            if isinstance(raw, str):
                result.append(json.loads(raw))
            elif isinstance(raw, dict):
                result.append(raw)
        return result
    finally:
        conn.close()


def query_raw(
    schema: str,
    table: str,
    for_date: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    conn = get_connection()
    try:
        cur = conn.cursor()
        db = os.environ["SNOWFLAKE_DATABASE"]
        if for_date:
            where = f"WHERE ingestion_date = '{for_date}'"
        elif start_date and end_date:
            where = f"WHERE ingestion_date BETWEEN '{start_date}' AND '{end_date}'"
        elif start_date:
            where = f"WHERE ingestion_date >= '{start_date}'"
        elif end_date:
            where = f"WHERE ingestion_date <= '{end_date}'"
        else:
            where = ""
        sql = f"SELECT raw_data FROM {db}.{schema}.{table} {where} ORDER BY ingested_at ASC"
        cur.execute(sql)
        rows = cur.fetchall()
        result = []
        for row in rows:
            raw = row[0]
            if isinstance(raw, str):
                result.append(json.loads(raw))
            elif isinstance(raw, dict):
                result.append(raw)
        return result
    finally:
        conn.close()
