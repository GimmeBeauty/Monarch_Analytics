import snowflake from "snowflake-sdk";

snowflake.configure({ logLevel: "ERROR" });

function createConn() {
  return snowflake.createConnection({
    account:   process.env.SNOWFLAKE_ACCOUNT!,
    username:  process.env.SNOWFLAKE_USER!,
    password:  process.env.SNOWFLAKE_PASSWORD!,
    database:  process.env.SNOWFLAKE_DATABASE!,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
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
