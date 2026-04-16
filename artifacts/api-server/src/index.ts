import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── Auto-bootstrap owner account ────────────────────────────────────────────
// Seeds the owner on every cold start so the production database is always
// usable without a manual seed step. Safe to run repeatedly — uses ON CONFLICT
// DO NOTHING so it never overwrites an existing account.

async function bootstrap() {
  try {
    await db
      .insert(usersTable)
      .values({
        email:        "nick@gimmebeauty.com",
        // bcrypt hash for: 030715TjNc!!
        passwordHash: "$2b$12$Yc5j3joO.Q2PCfD/aDZC6eyemZauVex1a/AgtbzV//XYFtSmYaPdS",
        name:         "Nick Christensen",
        role:         "owner",
        status:       "active",
      })
      .onConflictDoNothing({ target: usersTable.email });

    logger.info("Bootstrap complete — owner account ready");
  } catch (err) {
    logger.warn({ err }, "Bootstrap skipped or failed — will retry next start");
  }
}

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  await bootstrap();
});
