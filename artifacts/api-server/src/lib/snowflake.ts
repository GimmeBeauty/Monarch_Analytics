import snowflake from "snowflake-sdk";

snowflake.configure({ logLevel: "ERROR" });

function createConn() {
  const privateKey = Buffer.from(process.env.SNOWFLAKE_PRIVATE_KEY_B64!, "base64").toString("utf8");
  return snowflake.createConnection({
    account:       process.env.SNOWFLAKE_ACCOUNT!,
    username:      process.env.SNOWFLAKE_USER!,
    authenticator: "SNOWFLAKE_JWT",
    privateKey,
    database:      process.env.SNOWFLAKE_DATABASE!,
    warehouse:     process.env.SNOWFLAKE_WAREHOUSE!,
  });
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
