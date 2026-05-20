import sys, os
sys.path.insert(0, "/home/runner/workspace")
from datetime import date
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

print(f"=== Monarch Weekly Scheduler — {date.today()} ===")

def run_netsuite():
    print("\n[1/2] NetSuite weekly sync...")
    try:
        import subprocess
        result = subprocess.run(
            ["python3", "netsuite_fast_sync.py"],
            capture_output=True, text=True, timeout=3600
        )
        print(result.stdout[-1000:] if result.stdout else "No output")
        if result.returncode == 0:
            print("  ✅ NetSuite done")
        else:
            print(f"  ❌ NetSuite error: {result.stderr[-200:]}")
    except Exception as e:
        print(f"  ❌ NetSuite error: {e}")

def run_roundel():
    print("\n[2/2] Roundel (Target) Ads...")
    try:
        from ingestion.sources.roundel_ads import run_roundel_ingestion
        run_roundel_ingestion()
        print("  ✅ Roundel done")
    except Exception as e:
        print(f"  ❌ Roundel error: {e}")

def run_circana():
    print("\n[3/3] Circana POS data...")
    try:
        from ingestion.sources.circana_pos import run_circana_ingestion
        run_circana_ingestion()
        print("  ✅ Circana done")
    except Exception as e:
        print(f"  ❌ Circana error: {e}")

if __name__ == "__main__":
    run_netsuite()
    run_roundel()
    run_circana()
    print("\n✅ Weekly scheduler complete!")
