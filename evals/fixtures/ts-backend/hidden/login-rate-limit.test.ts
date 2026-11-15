import { describe, expect, it } from "vitest";

import { createTestContext } from "../test/helpers";

const login = (email: string, password: string) => ({ body: { email, password } });

describe("hidden: login rate limiting", () => {
  it("locks an email after 5 failures with 429 and Retry-After", async () => {
    const { request } = await createTestContext();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await request("POST", "/api/auth/token", login("ada@acme.test", "wrong"))).status).toBe(401);
    }
    const locked = await request("POST", "/api/auth/token", login("ada@acme.test", "wrong"));
    expect(locked.status).toBe(429);
    const retryAfter = Number(locked.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(900);
    expect((await request("POST", "/api/auth/token", login("ada@acme.test", "password123"))).status).toBe(429);
    expect((await request("POST", "/api/auth/token", login("bob@acme.test", "password123"))).status).toBe(200);
  });

  it("does not lock before the fifth failure", async () => {
    const { request } = await createTestContext();
    for (let attempt = 0; attempt < 4; attempt += 1) await request("POST", "/api/auth/token", login("gina@globex.test", "wrong"));
    expect((await request("POST", "/api/auth/token", login("gina@globex.test", "password123"))).status).toBe(200);
  });
});
