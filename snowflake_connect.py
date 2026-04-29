import snowflake.connector, os, base64
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

def get_private_key():
    key_path = os.environ.get("SNOWFLAKE_PRIVATE_KEY_PATH", "/home/runner/workspace/monarch_private_key.pem")
    if os.path.exists(key_path):
        with open(key_path, "rb") as f:
            pem_data = f.read()
        try:
            private_key = serialization.load_pem_private_key(pem_data, password=None, backend=default_backend())
            return private_key.private_bytes(encoding=serialization.Encoding.DER, format=serialization.PrivateFormat.PKCS8, encryption_algorithm=serialization.NoEncryption())
        except Exception:
            return None
    return None

def get_connection(schema=None):
    params = dict(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE","MONARCH_WH"),
        database=os.environ.get("SNOWFLAKE_DATABASE","MONARCH_RAW"),
    )
    if schema:
        params["schema"] = schema
    pk = get_private_key()
    if pk:
        params["private_key"] = pk
    else:
        params["password"] = os.environ["SNOWFLAKE_PASSWORD"]
    return snowflake.connector.connect(**params)
