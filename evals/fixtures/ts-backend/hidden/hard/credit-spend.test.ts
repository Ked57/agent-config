import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { organizations } from "../db/schema";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;

async function balance(db: Context["db"], orgId: string) {
  const org = await db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  return org?.credits;
}

const spend = (request: Context["request"], token: string, amount: unknown, key?: string) =>
  request("POST", "/api/credits/spend", { token, body: { amount, reason: "export" }, headers: key ? { "idempotency-key": key } : {} });

// org_acme is seeded with 100 credits, org_globex with 0.
describe("hidden: spending credits", () => {
  it("deducts, reports the remaining balance and refuses to overdraw", async () => {
    const { request, db } = await createTestContext();
    const ok = await spend(request, SEED_TOKENS.acmeMember, 30);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ credits: 70 });
    const tooMuch = await spend(request, SEED_TOKENS.acmeAdmin, 71);
    expect(tooMuch.status).toBe(402);
    expect(await balance(db, "org_acme")).toBe(70);
    const exact = await spend(request, SEED_TOKENS.acmeAdmin, 70);
    expect(exact.status).toBe(200);
    expect(await exact.json()).toMatchObject({ credits: 0 });
    expect((await spend(request, SEED_TOKENS.globexAdmin, 1)).status).toBe(402);
    expect(await balance(db, "org_globex")).toBe(0);
  });

  it("requires authentication and a positive whole amount", async () => {
    const { request, db } = await createTestContext();
    expect((await request("POST", "/api/credits/spend", { body: { amount: 1 } })).status).toBe(401);
    for (const amount of [0, -5, 1.5, "ten"]) {
      const response = await spend(request, SEED_TOKENS.acmeAdmin, amount);
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }
    expect(await balance(db, "org_acme")).toBe(100);
  });

  it("never overdraws or loses a spend when requests arrive together", async () => {
    const { request, db } = await createTestContext();
    // 100 credits, 30 simultaneous spends of 7: exactly 14 fit (98), 16 must be refused.
    const responses = await Promise.all(Array.from({ length: 30 }, (_, index) => spend(request, index % 2 ? SEED_TOKENS.acmeAdmin : SEED_TOKENS.acmeMember, 7)));
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status !== 200 && status !== 402)).toEqual([]);
    expect(statuses.filter((status) => status === 200)).toHaveLength(14);
    expect(statuses.filter((status) => status === 402)).toHaveLength(16);
    expect(await balance(db, "org_acme")).toBe(2);
  });

  it("replays the first answer for a repeated Idempotency-Key", async () => {
    const { request, db } = await createTestContext();
    const first = await spend(request, SEED_TOKENS.acmeAdmin, 10, "key-1");
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody).toMatchObject({ credits: 90 });
    expect((await spend(request, SEED_TOKENS.acmeAdmin, 5)).status).toBe(200);
    // Same key again, from another user of the same organization: no new deduction, original answer.
    const replay = await spend(request, SEED_TOKENS.acmeMember, 10, "key-1");
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(firstBody);
    expect(await balance(db, "org_acme")).toBe(85);
    // A different key is a different spend.
    expect((await spend(request, SEED_TOKENS.acmeAdmin, 10, "key-2")).status).toBe(200);
    expect(await balance(db, "org_acme")).toBe(75);
  });

  it("replays a refusal too, even after the balance was topped up", async () => {
    const { request, db } = await createTestContext();
    const refused = await spend(request, SEED_TOKENS.acmeAdmin, 500, "big-export");
    expect(refused.status).toBe(402);
    const refusedBody = await refused.text();
    const topUp = await request("POST", "/api/webhooks/billing", {
      headers: { "x-webhook-secret": "test-webhook-secret" },
      body: { id: "evt_topup", type: "payment.succeeded", data: { orgId: "org_acme", credits: 1000 } },
    });
    expect(topUp.status).toBe(200);
    const replay = await spend(request, SEED_TOKENS.acmeAdmin, 500, "big-export");
    expect(replay.status).toBe(402);
    expect(await replay.text()).toBe(refusedBody);
    expect(await balance(db, "org_acme")).toBe(1100);
  });

  it("scopes idempotency keys to the organization", async () => {
    const { request, db } = await createTestContext();
    await request("POST", "/api/webhooks/billing", {
      headers: { "x-webhook-secret": "test-webhook-secret" },
      body: { id: "evt_globex", type: "payment.succeeded", data: { orgId: "org_globex", credits: 50 } },
    });
    expect((await spend(request, SEED_TOKENS.acmeAdmin, 10, "shared-key")).status).toBe(200);
    const other = await spend(request, SEED_TOKENS.globexAdmin, 20, "shared-key");
    expect(other.status).toBe(200);
    expect(await other.json()).toMatchObject({ credits: 30 });
    expect(await balance(db, "org_acme")).toBe(90);
    expect(await balance(db, "org_globex")).toBe(30);
  });

  it("charges once when the same key arrives many times at once", async () => {
    const { request, db } = await createTestContext();
    const responses = await Promise.all(Array.from({ length: 12 }, () => spend(request, SEED_TOKENS.acmeAdmin, 10, "retry-storm")));
    expect(responses.map((response) => response.status)).toEqual(Array.from({ length: 12 }, () => 200));
    for (const response of responses) expect(await response.json()).toMatchObject({ credits: 90 });
    expect(await balance(db, "org_acme")).toBe(90);
  });
});
