import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  users: new Map<string, { id: string; role: string; status: string }>(),
}));

vi.mock("@workspace/db", () => {
  const matches = (row: Record<string, unknown>, condition: any): boolean =>
    Array.isArray(condition)
      ? condition.every(c => matches(row, c))
      : row[condition.column] === condition.value;
  return {
    usersTable: { id: "id", role: "role", status: "status" },
    authTokensTable: {},
    db: {
      select: () => ({
        from: () => ({
          where: (condition: any) => ({
            limit: async () => [...state.users.values()].filter(row => matches(row, condition)),
          }),
        }),
      }),
      update: () => ({
        set: (patch: any) => ({
          where: (condition: any) => ({
            returning: async () => [...state.users.values()]
              .filter(row => matches(row, condition))
              .map(row => {
                Object.assign(row, patch);
                return { id: row.id, role: row.role };
              }),
          }),
        }),
      }),
    },
  };
});
vi.mock("drizzle-orm", () => ({
  eq: (column: string, value: unknown) => ({ column, value }),
  and: (...conditions: unknown[]) => conditions,
  isNull: vi.fn(),
  gt: vi.fn(),
}));
vi.mock("../lib/jwt.js", () => ({
  COOKIE_NAME: "session",
  MAX_AGE_SEC: 100,
  signToken: vi.fn(),
  // Deliberately stale claims; middleware must use the database role instead.
  verifyToken: (token: string) => ({
    userId: token,
    role: token === "owner" ? "user" : "admin",
  }),
}));
vi.mock("../lib/email.js", () => ({
  sendInviteEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

import authRouter from "./auth.js";

let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json(), cookieParser(), authRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve, reject) =>
  server.close(err => err ? reject(err) : resolve()),
));
beforeEach(() => {
  state.users.clear();
  for (const role of ["owner", "admin", "user"]) {
    state.users.set(role, { id: role, role, status: "active" });
  }
});

const change = (actor: string | null, target: string, role: unknown) =>
  fetch(`${base}/users/${target}/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(actor ? { Cookie: `session=${actor}` } : {}),
    },
    body: JSON.stringify({ role }),
  });

describe("owner member-role management", () => {
  it("persists promotions and demotions and returns only safe fields", async () => {
    const promoted = await change("owner", "user", "admin");
    expect(promoted.status).toBe(200);
    expect(await promoted.json()).toEqual({ user: { id: "user", role: "admin" } });
    expect(state.users.get("user")?.role).toBe("admin");
    expect((await change("owner", "user", "user")).status).toBe(200);
    expect(state.users.get("user")?.role).toBe("user");
  });
  it.each(["admin", "user"])("blocks %s even with stale admin JWT claims", async actor => {
    expect((await change(actor, "user", "admin")).status).toBe(403);
  });
  it("protects owner and rejects ownership grants", async () => {
    expect((await change("owner", "owner", "user")).status).toBe(403);
    expect((await change("owner", "user", "owner")).status).toBe(400);
    expect(state.users.get("owner")?.role).toBe("owner");
  });
  it.each(["manager", "", null, 123])("rejects invalid role %s", async role => {
    expect((await change("owner", "user", role)).status).toBe(400);
  });
  it("rejects anonymous, removed and disabled accounts", async () => {
    expect((await change(null, "user", "admin")).status).toBe(401);
    expect((await change("missing", "user", "admin")).status).toBe(401);
    state.users.get("owner")!.status = "disabled";
    expect((await change("owner", "user", "admin")).status).toBe(401);
  });
  it("reports missing members", async () => {
    expect((await change("owner", "missing", "admin")).status).toBe(404);
  });
  it("applies current database permissions without replacing the session", async () => {
    state.users.get("admin")!.role = "owner";
    expect((await change("admin", "user", "admin")).status).toBe(200);
    state.users.get("admin")!.role = "user";
    expect((await change("admin", "user", "user")).status).toBe(403);
  });
});
