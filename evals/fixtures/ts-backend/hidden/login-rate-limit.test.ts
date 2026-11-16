import { afterEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../test/helpers";

const login = (email: string, password: string) => ({ body: { email, password } });
const WINDOW_SECONDS = 15 * 60;

afterEach(() => {
  vi.useRealTimers();
});

describe("hidden: login rate limiting", { timeout: 30_000 }, () => {
  it("locks an email after 5 failures with 429 and Retry-After", async () => {
    const { request } = await createTestContext();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await request("POST", "/api/auth/token", login("ada@acme.test", "wrong"))).status).toBe(401);
    }
    const locked = await request("POST", "/api/auth/token", login("ada@acme.test", "wrong"));
    expect(locked.status).toBe(429);
    const retryAfter = Number(locked.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(WINDOW_SECONDS);
    expect((await request("POST", "/api/auth/token", login("ada@acme.test", "password123"))).status).toBe(429);
  });

  it("does not affect other emails", async () => {
    const { request } = await createTestContext();
    for (let attempt = 0; attempt < 6; attempt += 1) await request("POST", "/api/auth/token", login("ada@acme.test", "wrong"));
    expect((await request("POST", "/api/auth/token", login("bob@acme.test", "password123"))).status).toBe(200);
    expect((await request("POST", "/api/auth/token", login("bob@acme.test", "wrong"))).status).toBe(401);
  });

  it("does not lock before the fifth failure", async () => {
    const { request } = await createTestContext();
    for (let attempt = 0; attempt < 4; attempt += 1) await request("POST", "/api/auth/token", login("gina@globex.test", "wrong"));
    expect((await request("POST", "/api/auth/token", login("gina@globex.test", "password123"))).status).toBe(200);
  });

  it("does not count successful logins as failures", async () => {
    const { request } = await createTestContext();
    for (let attempt = 0; attempt < 7; attempt += 1) {
      expect((await request("POST", "/api/auth/token", login("ada@acme.test", "password123"))).status).toBe(200);
    }
  });

  // Login matches emails case-insensitively, so differently cased spellings are the same email.
  it("treats differently cased spellings as the same email", async () => {
    const { request } = await createTestContext();
    const spellings = ["Ada@acme.test", "ADA@ACME.TEST", "ada@Acme.test", "aDa@acme.test", "ada@acme.TEST"];
    for (const email of spellings) expect((await request("POST", "/api/auth/token", login(email, "wrong"))).status).toBe(401);
    expect((await request("POST", "/api/auth/token", login("ada@acme.test", "password123"))).status).toBe(429);
  });

  it("limits emails that belong to no account", async () => {
    const { request } = await createTestContext();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await request("POST", "/api/auth/token", login("nobody@acme.test", "wrong"))).status).toBe(401);
    }
    expect((await request("POST", "/api/auth/token", login("nobody@acme.test", "wrong"))).status).toBe(429);
  });

  // Only `Date` is faked: database I/O keeps its real timers.
  it("lets the email log in again once the 15-minute window has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { request } = await createTestContext();
    for (let attempt = 0; attempt < 6; attempt += 1) await request("POST", "/api/auth/token", login("ada@acme.test", "wrong"));
    expect((await request("POST", "/api/auth/token", login("ada@acme.test", "password123"))).status).toBe(429);
    vi.advanceTimersByTime(5 * 60 * 1000);
    expect((await request("POST", "/api/auth/token", login("ada@acme.test", "password123"))).status).toBe(429);
    vi.advanceTimersByTime((WINDOW_SECONDS + 1) * 1000);
    expect((await request("POST", "/api/auth/token", login("ada@acme.test", "password123"))).status).toBe(200);
  });
});
