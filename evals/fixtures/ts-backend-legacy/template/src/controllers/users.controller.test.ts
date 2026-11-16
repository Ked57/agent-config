import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("users controller", () => {
  it("lists the org's people", async () => {
    const { json } = await createTestContext();
    const { body } = await json<{ items: { id: string }[] }>(
      "GET",
      "/api/users",
      {
        token: SEED_TOKENS.acmeMember,
      },
    );
    expect(body.items.map((user) => user.id)).toEqual([
      "usr_ada",
      "usr_bob",
      "usr_sam",
    ]);
  });

  it("shows a colleague", async () => {
    const { json } = await createTestContext();
    const { status, body } = await json("GET", "/api/users/usr_sam", {
      token: SEED_TOKENS.acmeMember,
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      name: "Sam Taylor",
      timezone: "Australia/Sydney",
    });
  });

  it("updates the caller's own time zone", async () => {
    const { json } = await createTestContext();
    const ok = await json("PATCH", "/api/users/me", {
      token: SEED_TOKENS.acmeMember,
      body: { timezone: "Asia/Tokyo" },
    });
    expect(ok.body).toMatchObject({ id: "usr_bob", timezone: "Asia/Tokyo" });
    const bad = await json("PATCH", "/api/users/me", {
      token: SEED_TOKENS.acmeMember,
      body: { timezone: "Mars/Base" },
    });
    expect(bad.status).toBe(400);
  });

  it("lets admins set hourly rates", async () => {
    const { request } = await createTestContext();
    const member = await request("PUT", "/api/users/usr_sam/rate", {
      token: SEED_TOKENS.acmeMember,
      body: { hourlyRateCents: 1 },
    });
    expect(member.status).toBe(403);
    const ok = await request("PUT", "/api/users/usr_sam/rate", {
      token: SEED_TOKENS.acmeAdmin,
      body: { hourlyRateCents: 8000 },
    });
    expect(ok.status).toBe(200);
  });
});
