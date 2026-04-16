/**
 * Database seed — creates the initial owner account.
 *
 * Run from the workspace root:
 *   DATABASE_URL=postgres://... pnpm --filter @workspace/db seed
 *
 * Safe to re-run: uses INSERT … ON CONFLICT DO NOTHING.
 */

import { db, usersTable } from "./index.js";

const OWNER: typeof usersTable.$inferInsert = {
  email:        "nick@gimmebeauty.com",
  // bcrypt hash of the initial password (salt rounds: 12)
  passwordHash: "$2b$12$bIR06EGQHq99Jkmrn9CTNuTRBAcTqfrh9.vFqum9g4i1dWz.LBKga", // Monarch2024!
  name:         "Nick Christensen",
  role:         "owner",
  status:       "active",
};

async function seed() {
  console.log("Seeding initial owner account…");

  await db
    .insert(usersTable)
    .values(OWNER)
    .onConflictDoNothing({ target: usersTable.email });

  console.log(`✓ Owner account ready: ${OWNER.email}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
