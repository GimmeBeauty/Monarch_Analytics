import os
import json
from dotenv import load_dotenv

load_dotenv()

CACHE_DIR = "/tmp/monarch_cache"


def _path(key: str) -> str:
    os.makedirs(CACHE_DIR, exist_ok=True)
    safe = key.replace("/", "_").replace(" ", "_")
    return os.path.join(CACHE_DIR, f"{safe}.json")


def get_cached(key: str):
    path = _path(key)
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return None


def set_cached(key: str, data) -> None:
    path = _path(key)
    with open(path, "w") as f:
        json.dump(data, f)
