import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEED_PASSWORD } from "../db/seed";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse("2027-03-01T08:00:00.000Z");

// Only Date is faked: the app reads the clock through Date like the template does, timers stay real.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

const at = (offsetMs: number) => vi.setSystemTime(T0 + offsetMs);

async function login(request: Context["request"], email = "ada@acme.test") {
  const response = await request("POST", "/api/auth/token", { body: { email, password: SEED_PASSWORD } });
  expect(response.status).toBe(200);
  return ((await response.json()) as { token: string }).token;
}

const me = (request: Context["request"], token: string) => request("GET", "/api/me", { token });

async function expiresAtOf(request: Context["request"], token: string) {
  const response = await me(request, token);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { expiresAt: string };
  return Date.parse(body.expiresAt);
}

describe("hidden: logout and sliding token expiry", { timeout: 30_000 }, () => {
  it("revokes the token on logout so it gets 401 everywhere", async () => {
    const { request } = await createTestContext();
    const token = await login(request);
    expect((await me(request, token)).status).toBe(200);
    expect((await request("POST", "/api/auth/logout", { token })).status).toBe(204);
    expect((await me(request, token)).status).toBe(401);
    expect((await request("GET", "/api/projects", { token })).status).toBe(401);
  });

  it("keeps the user's other tokens working after a logout", async () => {
    const { request } = await createTestContext();
    const first = await login(request);
    const second = await login(request);
    expect((await request("POST", "/api/auth/logout", { token: first })).status).toBe(204);
    expect((await me(request, second)).status).toBe(200);
    expect((await me(request, SEED_TOKENS.acmeAdmin)).status).toBe(200);
  });

  it("answers 401 to a logout without a valid token, including a second logout", async () => {
    const { request } = await createTestContext();
    expect((await request("POST", "/api/auth/logout")).status).toBe(401);
    expect((await request("POST", "/api/auth/logout", { token: "bogus" })).status).toBe(401);
    const token = await login(request);
    expect((await request("POST", "/api/auth/logout", { token })).status).toBe(204);
    expect((await request("POST", "/api/auth/logout", { token })).status).toBe(401);
    expect((await me(request, token)).status).toBe(401);
  });

  it("revokes every token of the user on logout-all, and only that user's", async () => {
    const { request } = await createTestContext();
    const first = await login(request);
    const second = await login(request);
    const bob = await login(request, "bob@acme.test");
    expect((await request("POST", "/api/auth/logout-all", { token: first })).status).toBe(204);
    for (const token of [first, second, SEED_TOKENS.acmeAdmin]) expect((await me(request, token)).status).toBe(401);
    for (const token of [bob, SEED_TOKENS.acmeMember, SEED_TOKENS.globexAdmin]) expect((await me(request, token)).status).toBe(200);
    expect((await request("POST", "/api/auth/logout-all")).status).toBe(401);
  });

  it("includes the token's expiry in GET /api/me", async () => {
    const { request } = await createTestContext();
    const token = await login(request);
    const response = await me(request, token);
    const body = (await response.json()) as { id: string; expiresAt: string };
    expect(body.id).toBe("usr_ada");
    expect(typeof body.expiresAt).toBe("string");
    expect(new Date(body.expiresAt).toISOString()).toBe(body.expiresAt);
    expect(Date.parse(body.expiresAt)).toBe(T0 + 24 * HOUR);
  });

  it("slides the expiry forward on every request", async () => {
    const { request } = await createTestContext();
    const token = await login(request);
    at(20 * HOUR);
    expect(await expiresAtOf(request, token)).toBe(T0 + 44 * HOUR);
    // Past the original 24 hours, still valid because it was used at hour 20.
    at(40 * HOUR);
    expect(await expiresAtOf(request, token)).toBe(T0 + 64 * HOUR);
    expect((await request("GET", "/api/projects", { token })).status).toBe(200);
  });

  it("rejects a token from the exact moment it expires", async () => {
    const { request } = await createTestContext();
    const early = await login(request);
    const exact = await login(request);
    at(24 * HOUR - 1);
    expect((await me(request, early)).status).toBe(200);
    at(24 * HOUR);
    expect((await me(request, exact)).status).toBe(401);
  });

  it("never extends a token beyond 7 days after it was issued", async () => {
    const { request } = await createTestContext();
    const token = await login(request);
    for (let hour = 20; hour <= 160; hour += 20) {
      at(hour * HOUR);
      expect((await me(request, token)).status).toBe(200);
    }
    at(168 * HOUR - 1);
    expect(await expiresAtOf(request, token)).toBe(T0 + 168 * HOUR);
    at(168 * HOUR);
    expect((await me(request, token)).status).toBe(401);
  });

  it("does not bring an expired token back", async () => {
    const { request, db } = await createTestContext();
    const token = await login(request);
    at(25 * HOUR);
    expect((await me(request, token)).status).toBe(401);
    expect((await me(request, token)).status).toBe(401);
    expect((await request("GET", "/api/projects", { token })).status).toBe(401);
    const rows = await db.all<{ expires_at: number }>(sql`SELECT expires_at FROM api_tokens WHERE user_id = 'usr_ada' AND id <> 'tok_ada'`);
    // Either the row was removed or its expiry was left where it was.
    for (const row of rows) expect(row.expires_at).toBeLessThanOrEqual(T0 + 24 * HOUR);
  });

  it("does not bring a revoked token back, even with requests racing the logout", async () => {
    const { request } = await createTestContext();
    const token = await login(request);
    // Requests that were already being authenticated while the logout ran must not undo it.
    // Each request starts a few microtasks later than the previous one, so some overlap every step of the logout.
    const delayed = async (hops: number) => {
      for (let hop = 0; hop < hops; hop += 1) await null;
      return me(request, token);
    };
    const responses = await Promise.all([request("POST", "/api/auth/logout", { token }), ...Array.from({ length: 80 }, (_, hops) => delayed(hops))]);
    expect(responses[0]?.status).toBe(204);
    for (let index = 0; index < 3; index += 1) expect((await me(request, token)).status).toBe(401);
  });
});
