import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { organizations } from "../db/schema";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;

async function balance(db: Context["db"], orgId: string) {
  const org = await db.select().from(organizations).where(eq(organizations.id, orgId)).get();
  return org?.credits;
}

// Every request carries a key: the prompt says clients send one, so a solution may require it.
const spend = (request: Context["request"], token: string, amount: unknown, key?: string) =>
  request("POST", "/api/credits/spend", { token, body: { amount }, headers: { "idempotency-key": key ?? crypto.randomUUID() } });

const topUp = (request: Context["request"], id: string, orgId: string, credits: number) =>
  request("POST", "/api/webhooks/billing", { headers: { "x-webhook-secret": "test-webhook-secret" }, body: { id, type: "payment.succeeded", data: { orgId, credits } } });

// org_acme is seeded with 100 credits, org_globex with 0.
describe("hidden: spending credits", { timeout: 30_000 }, () => {
  // Prompt: "spend credits ... answer 200 with {credits: <remaining balance>}"
  it("deducts the amount and answers 200 with the remaining balance", async () => {
    const { request, db } = await createTestContext();
    const ok = await spend(request, SEED_TOKENS.acmeMember, 30);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ credits: 70 });
    expect(await balance(db, "org_acme")).toBe(70);
  });

  // Prompt: "402 when the balance is too low" + "the balance must never go negative"

  it("refuses to overdraw with 402 and leaves the balance alone", async () => {
    const { request, db } = await createTestContext();
    expect((await spend(request, SEED_TOKENS.acmeAdmin, 101)).status).toBe(402);
    expect(await balance(db, "org_acme")).toBe(100);
    expect((await spend(request, SEED_TOKENS.globexAdmin, 1)).status).toBe(402);
    expect(await balance(db, "org_globex")).toBe(0);
  });

  // Prompt: "402 when the balance is too low": a balance equal to the amount is not too low

  it("lets an organization spend its balance down to exactly zero", async () => {
    const { request, db } = await createTestContext();
    expect((await spend(request, SEED_TOKENS.acmeAdmin, 60)).status).toBe(200);
    const exact = await spend(request, SEED_TOKENS.acmeAdmin, 40);
    expect(exact.status).toBe(200);
    expect(await exact.json()).toMatchObject({ credits: 0 });
    expect((await spend(request, SEED_TOKENS.acmeAdmin, 1)).status).toBe(402);
    expect(await balance(db, "org_acme")).toBe(0);
  });

  // Prompt: "{amount: <positive whole number>}" for "members of an organization" (401 is the API's existing convention)

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

  // Prompt: "a retry must get the original response back and never be charged twice"

  it("replays the first answer for a repeated Idempotency-Key without spending again", async () => {
    const { request, db } = await createTestContext();
    const first = await spend(request, SEED_TOKENS.acmeAdmin, 10, "key-1");
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody).toMatchObject({ credits: 90 });
    expect((await spend(request, SEED_TOKENS.acmeAdmin, 5)).status).toBe(200);
    // Same key again from the same client: no new deduction, original answer.
    const replay = await spend(request, SEED_TOKENS.acmeAdmin, 10, "key-1");
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(firstBody);
    expect(await balance(db, "org_acme")).toBe(85);
    // A different key is a different spend.
    expect((await spend(request, SEED_TOKENS.acmeAdmin, 10, "key-2")).status).toBe(200);
    expect(await balance(db, "org_acme")).toBe(75);
  });

  // Prompt: "a retry must get the original response back": the original response was the refusal

  it("replays a refusal too, even after the balance was topped up", async () => {
    const { request, db } = await createTestContext();
    const refused = await spend(request, SEED_TOKENS.acmeAdmin, 500, "big-export");
    expect(refused.status).toBe(402);
    const refusedBody = await refused.text();
    expect((await topUp(request, "evt_topup", "org_acme", 1000)).status).toBe(200);
    const replay = await spend(request, SEED_TOKENS.acmeAdmin, 500, "big-export");
    expect(replay.status).toBe(402);
    expect(await replay.text()).toBe(refusedBody);
    expect(await balance(db, "org_acme")).toBe(1100);
  });

  // Prompt: "members of an organization spend its credits": another organization's key cannot answer for or block this one

  it("scopes idempotency keys to the organization", async () => {
    const { request, db } = await createTestContext();
    expect((await topUp(request, "evt_globex", "org_globex", 50)).status).toBe(200);
    expect((await spend(request, SEED_TOKENS.acmeAdmin, 10, "shared-key")).status).toBe(200);
    const other = await spend(request, SEED_TOKENS.globexAdmin, 20, "shared-key");
    expect(other.status).toBe(200);
    expect(await other.json()).toMatchObject({ credits: 30 });
    expect(await balance(db, "org_acme")).toBe(90);
    expect(await balance(db, "org_globex")).toBe(30);
  });

  // Prompt: "never negative, even when requests arrive at the same time; each still gets a 200 or 402"

  it("never overdraws, loses a spend or errors when spends arrive together", async () => {
    const { request, db } = await createTestContext();
    // 100 credits, 30 simultaneous spends of 7: exactly 14 fit (98), 16 must be refused.
    const responses = await Promise.all(Array.from({ length: 30 }, (_, index) => spend(request, index % 2 ? SEED_TOKENS.acmeAdmin : SEED_TOKENS.acmeMember, 7)));
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status !== 200 && status !== 402)).toEqual([]);
    expect(statuses.filter((status) => status === 200)).toHaveLength(14);
    expect(statuses.filter((status) => status === 402)).toHaveLength(16);
    expect(await balance(db, "org_acme")).toBe(2);
  });

  // Prompt: "retries ... original response ... never charged twice" + "each still gets a 200 or 402"

  it("charges once and answers every request when the same key arrives many times at once", async () => {
    const { request, db } = await createTestContext();
    const responses = await Promise.all(Array.from({ length: 12 }, () => spend(request, SEED_TOKENS.acmeAdmin, 10, "retry-storm")));
    expect(responses.map((response) => response.status)).toEqual(Array.from({ length: 12 }, () => 200));
    for (const response of responses) expect(await response.json()).toMatchObject({ credits: 90 });
    expect(await balance(db, "org_acme")).toBe(90);
  });
});
