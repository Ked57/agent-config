import { describe, expect, it } from "vitest";

import { SEED_PASSWORD } from "../db/seed";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("auth", () => {
  it("issues a token for valid credentials", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/auth/token", {
      body: { email: "ADA@acme.test", password: SEED_PASSWORD },
    });
    expect(response.status).toBe(200);
    const { token } = (await response.json()) as { token: string };
    const me = await request("GET", "/api/me", { token });
    expect(((await me.json()) as { id: string }).id).toBe("usr_ada");
  });

  it("rejects a wrong password", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/auth/token", {
      body: { email: "ada@acme.test", password: "nope" },
    });
    expect(response.status).toBe(401);
  });

  it("requires a bearer token", async () => {
    const { request } = await createTestContext();
    expect((await request("GET", "/api/me")).status).toBe(401);
    expect(
      (await request("GET", "/api/me", { token: "not-a-token" })).status,
    ).toBe(401);
  });

  it("returns the profile with feature flags", async () => {
    const { request } = await createTestContext();
    const me = await request("GET", "/api/me", {
      token: SEED_TOKENS.acmeSydney,
    });
    expect(await me.json()).toMatchObject({
      id: "usr_sam",
      orgId: "org_acme",
      timezone: "Australia/Sydney",
      flags: { reportsV2: true, webhooks: true, timeApprovals: false },
    });
  });
});
