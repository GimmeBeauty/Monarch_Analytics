const SUITEQL_URL = "https://1307706.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql";

export async function queryNetSuite(sql: string, accessToken: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(SUITEQL_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Prefer": "transient",
    },
    body: JSON.stringify({ q: sql }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`NetSuite SuiteQL error ${res.status}: ${text}`);
  }
  const data = await res.json() as { items?: Record<string, unknown>[] };
  return data.items ?? [];
}
