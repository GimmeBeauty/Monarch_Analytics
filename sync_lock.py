"""
Shared sync lock utility to prevent concurrent/overlapping runs of the same
ingestion job, which can cause duplicate rows in Snowflake tables.

Usage:
    from sync_lock import acquire_lock, release_lock

    if not acquire_lock("netsuite_sync", max_age_hours=2):
        print("Job already running or ran recently — skipping")
        exit(0)
    try:
        # ... do the sync work ...
    finally:
        release_lock("netsuite_sync")
"""
import sys
sys.path.insert(0, "/home/runner/workspace")
from datetime import datetime, timedelta
from snowflake_connect import get_connection
import os, socket

def acquire_lock(job_name, max_age_hours=2):
    conn = get_connection(schema="COMMERCE")
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT locked_at FROM MONARCH_RAW.COMMERCE.SYNC_LOCKS WHERE job_name = '{job_name}'")
        row = cur.fetchone()
        now = datetime.utcnow()
        if row:
            locked_at = row[0]
            age = now - locked_at
            if age < timedelta(hours=max_age_hours):
                print(f"  Lock active for '{job_name}' — acquired {age} ago (limit {max_age_hours}h). Skipping.")
                return False
            else:
                print(f"  Stale lock for '{job_name}' ({age} old) — proceeding and refreshing lock.")
        locker = f"{socket.gethostname()}:{os.getpid()}"
        now_str = now.strftime("%Y-%m-%d %H:%M:%S.%f")
        cur.execute(f"""
            MERGE INTO MONARCH_RAW.COMMERCE.SYNC_LOCKS AS tgt
            USING (SELECT '{job_name}' AS job_name) AS src
            ON tgt.job_name = src.job_name
            WHEN MATCHED THEN UPDATE SET locked_at = '{now_str}'::TIMESTAMP_NTZ, locked_by = '{locker}'
            WHEN NOT MATCHED THEN INSERT (job_name, locked_at, locked_by)
            VALUES ('{job_name}', '{now_str}'::TIMESTAMP_NTZ, '{locker}')
        """)
        conn.commit()
        print(f"  Lock acquired for '{job_name}'")
        return True
    finally:
        cur.close()
        conn.close()

def release_lock(job_name):
    conn = get_connection(schema="COMMERCE")
    cur = conn.cursor()
    try:
        cur.execute(f"DELETE FROM MONARCH_RAW.COMMERCE.SYNC_LOCKS WHERE job_name = '{job_name}'")
        conn.commit()
        print(f"  Lock released for '{job_name}'")
    finally:
        cur.close()
        conn.close()
