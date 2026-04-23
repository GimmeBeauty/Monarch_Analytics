import snowflake.connector
import json, os
from datetime import date
from dotenv import load_dotenv
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
load_dotenv(dotenv_path=".env")

def _get_snowflake_connection(schema=None):
    params = dict(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "MONARCH_WH"),
        database=os.environ.get("SNOWFLAKE_DATABASE", "MONARCH_RAW"),
    )
    if schema:
        params["schema"] = schema
    key_path = "/home/runner/workspace/monarch_private_key.pem"
    if os.path.exists(key_path):
        with open(key_path, "rb") as f:
            pk = serialization.load_pem_private_key(f.read(), password=None, backend=default_backend())
        params["private_key"] = pk.private_bytes(encoding=serialization.Encoding.DER, format=serialization.PrivateFormat.PKCS8, encryption_algorithm=serialization.NoEncryption())
    else:
        params["password"] = os.environ["SNOWFLAKE_PASSWORD"]
    return snowflake.connector.connect(**params)

class BaseIngestor:
    def __init__(self, source_name, schema, table):
        self.source_name = source_name
        self.schema = schema
        self.table = table
        self.ingestion_date = date.today().isoformat()
        self.conn = _get_snowflake_connection(schema=schema)
        print(f"[{self.source_name}] Connected to Snowflake")

    def upsert_records(self, records, id_field="id"):
        if not records:
            print(f"[{self.source_name}] No records to upsert")
            return
        cur = self.conn.cursor()
        success = 0
        for r in records:
            try:
                cur.execute(f"INSERT INTO {self.table} (id,ingestion_date,source,raw_data) SELECT %s,%s::DATE,%s,PARSE_JSON(%s)",
                    (str(r.get(id_field,"")), self.ingestion_date, self.source_name, json.dumps(r)))
                success += 1
            except Exception as e:
                print(f"[{self.source_name}] Row error: {e}")
        cur.close()
        print(f"[{self.source_name}] ✅ {success} records upserted for {self.ingestion_date}")

    def close(self):
        if self.conn:
            self.conn.close()
