import snowflake from "snowflake-sdk";

snowflake.configure({ logLevel: "ERROR" });

function createConn() {
  const account   = process.env.SNOWFLAKE_ACCOUNT!;
  const username  = process.env.SNOWFLAKE_USER!;
  const database  = process.env.SNOWFLAKE_DATABASE!;
  const warehouse = process.env.SNOWFLAKE_WAREHOUSE!;

  const privateKeyB64 = process.env.SNOWFLAKE_PRIVATE_KEY_B64;
  const password      = process.env.SNOWFLAKE_PASSWORD;

  if (privateKeyB64) {
    const privateKey = Buffer.from(privateKeyB64, "base64").toString("utf8");
    return snowflake.createConnection({
      account,
      username,
      authenticator: "SNOWFLAKE_JWT",
      privateKey,
      database,
      warehouse,
    });
  }

  if (password) {
    return snowflake.createConnection({
      account,
      username,
      password,
      database,
      warehouse,
    });
  }

  throw new Error("No Snowflake credentials configured — set SNOWFLAKE_PRIVATE_KEY_B64 or SNOWFLAKE_PASSWORD");
}

export function querySnowflake(sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const conn = createConn();
    conn.connect((connErr) => {
      if (connErr) { reject(connErr); return; }
      conn.execute({
        sqlText: sql,
        complete(execErr, _stmt, rows) {
          conn.destroy(() => {});
          if (execErr) { reject(execErr); return; }
          resolve((rows ?? []) as Record<string, unknown>[]);
        },
      });
    });
  });
}
