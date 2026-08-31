/**
 * Manually mark the TikTok Shop integration as connected, using credentials
 * obtained outside the (currently broken) OAuth flow.
 *
 * Writes the exact same shape the real OAuth callback writes
 * (artifacts/api-server/src/routes/oauth.ts, tiktok_shop callback):
 *   - accessToken  -> top-level `access_token` column
 *   - refreshToken -> inside the `metadata` JSON string
 *   - shopId       -> inside the `metadata` JSON string (TikTok's seller_id)
 *   - status       -> "connected"
 * Upserts on the unique `provider` column, preserving any existing metadata
 * keys (e.g. a previously-resolved shopCipher or backfill checkpoint) the
 * same way the real callback does.
 *
 * DO NOT hardcode secrets in this file. Pass them via environment variables
 * so they never end up in shell history in plaintext command args or in
 * chat/editor history:
 *
 *   export TIKTOK_SHOP_ACCESS_TOKEN="<real access_token>"
 *   export TIKTOK_SHOP_REFRESH_TOKEN="<real refresh_token>"
 *   export TIKTOK_SHOP_SHOP_ID="<real shop_id / seller_id>"
 *   DATABASE_URL=postgres://... pnpm --filter @workspace/scripts connect-tiktok-shop
 *
 * Safe to re-run: upserts, same as the OAuth callback.
 */

import { db, integrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const accessToken = process.env.TIKTOK_SHOP_ACCESS_TOKEN;
const refreshToken = process.env.TIKTOK_SHOP_REFRESH_TOKEN;
const shopId = process.env.TIKTOK_SHOP_SHOP_ID;

if (!accessToken || !refreshToken) {
  console.error(
    "Missing required env vars. Set TIKTOK_SHOP_ACCESS_TOKEN and TIKTOK_SHOP_REFRESH_TOKEN " +
      "(TIKTOK_SHOP_SHOP_ID is optional but recommended) before running this script.",
  );
  process.exit(1);
}

async function connect(accessToken: string, refreshToken: string, shopId: string | undefined) {
  const existing = await db
    .select()
    .from(integrationsTable)
    .where(eq(integrationsTable.provider, "tiktok_shop"))
    .limit(1);

  const existingMeta = existing[0]?.metadata
    ? (JSON.parse(existing[0].metadata) as Record<string, unknown>)
    : {};

  const newMeta = {
    ...existingMeta,
    refreshToken,
    ...(shopId && { shopId }),
  };

  await db
    .insert(integrationsTable)
    .values({
      provider: "tiktok_shop",
      accessToken,
      metadata: JSON.stringify(newMeta),
      status: "connected",
    })
    .onConflictDoUpdate({
      target: integrationsTable.provider,
      set: {
        accessToken,
        metadata: JSON.stringify(newMeta),
        status: "connected",
        updatedAt: new Date(),
      },
    });

  console.log("✓ tiktok_shop integration row upserted as connected.");
  process.exit(0);
}

connect(accessToken, refreshToken, shopId).catch((err) => {
  console.error("Manual TikTok Shop connect failed:", err);
  process.exit(1);
});
