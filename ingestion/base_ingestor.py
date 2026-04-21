import snowflake.connector
import json
import os
from datetime import date
from dotenv import load_dotenv
load_dotenv()

class BaseIngestor:
    def __init__(self, source_name, schema, table):
        self.source_name = source_name
        self.schema = schema
        self.table = table
        self.ingestion_date = date.today().isoformat()
        self.conn = snowflake.connector.connect(
            account=os.environ["SNOWFLAKE_ACCOUNT"],
            user=os.environ["SNOWFLAKE_USER"],
            password=os.environ["SNOWFLAKE_PASSWORD"],
            warehouse=os.environ["SNOWFLAKE_WAREHOUSE"],
            database=os.environ["SNOWFLAKE_DATABASE"],
            schema=schema,
        )

    def upsert_records(self, records, id_field="id"):
        if not records:
            print(f"[{self.source_name}] No records to upsert")
            return
        cur = self.conn.cursor()
        success = 0
        for r in records:
            try:
                cur.execute(f"""
                    MERGE INTO {self.table} AS target
                    USING (
                        SELECT %s AS id, %s::DATE AS ingestion_date,
                               %s AS source, PARSE_JSON(%s) AS raw_data
                    ) AS src
                    ON target.id = src.id
                    AND target.ingestion_date = src.ingestion_date
                    WHEN MATCHED THEN UPDATE SET
                        target.raw_data = src.raw_data,
                        target.ingested_at = CURRENT_TIMESTAMP()
                    WHEN NOT MATCHED THEN INSERT
                        (id, ingestion_date, source, raw_data)
                    VALUES (src.id, src.ingestion_date, src.source, src.raw_data)
                """, (str(r.get(id_field,"")), self.ingestion_date, self.source_name, json.dumps(r)))
                success += 1
            except Exception as e:
                print(f"[{self.source_name}] Row error: {e}")
        cur.close()
        print(f"[{self.source_name}] ✅ {success} records upserted for {self.ingestion_date}")

    def close(self):
        if self.conn:
            self.conn.close()
