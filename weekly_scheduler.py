import sys, os
sys.path.insert(0, "/home/runner/workspace")
from datetime import date, timedelta
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

print(f"=== Monarch Weekly Scheduler — {date.today()} ===")

def run_netsuite():
    print("\n[1/1] NetSuite weekly sync...")
    try:
        import subprocess
        result = subprocess.run(
            ["python3", "/home/runner/workspace/netsuite_fast_sync.py"],
            capture_output=True, text=True, timeout=3600
        )
        print(result.stdout[-1000:] if result.stdout else "No output")
        if result.returncode == 0:
            print("  ✅ NetSuite done")
        else:
            print(f"  ❌ NetSuite error: {result.stderr[-200:]}")
    except Exception as e:
        print(f"  ❌ NetSuite error: {e}")

if __name__ == "__main__":
    run_netsuite()
    print("\n✅ Weekly scheduler complete!")
