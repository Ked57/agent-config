import { describe, expect, it } from "vitest";

import { SEED_PASSWORD } from "../db/seed";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("auth", () => {
  it("issues a token for valid credentials that works on /api/me", async () => {
    const { request } = await createTestContext();
    const login = await request("POST", "/api/auth/token", {
      body: { email: "ada@acme.test", password: SEED_PASSWORD },
    });
    expect(login.status).toBe(200);
    const { token } = (await login.json()) as { token: string };
    const me = await request("GET", "/api/me", { token });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      id: "usr_ada",
      orgId: "org_acme",
      role: "admin",
    });
  });

  it("rejects a wrong password", async () => {
    const { request } = await createTestContext();
    const login = await request("POST", "/api/auth/token", {
      body: { email: "ada@acme.test", password: "nope" },
    });
    expect(login.status).toBe(401);
  });

  it("rejects requests without a valid token", async () => {
    const { request } = await createTestContext();
    expect((await request("GET", "/api/me")).status).toBe(401);
    expect((await request("GET", "/api/me", { token: "bogus" })).status).toBe(
      401,
    );
    expect(
      (await request("GET", "/api/me", { token: SEED_TOKENS.acmeMember }))
        .status,
    ).toBe(200);
  });
});
