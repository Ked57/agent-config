import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { organizations } from "../db/schema";
import { createTestContext } from "../test/helpers";

const headers = { "x-webhook-secret": "test-webhook-secret" };
const event = (id: string, credits = 50) => ({ id, type: "payment.succeeded", data: { orgId: "org_globex", credits } });

describe("hidden: idempotent billing webhooks", () => {
  it("applies a retried event once and still acknowledges it", async () => {
    const { request, db } = await createTestContext();
    const first = await request("POST", "/api/webhooks/billing", { body: event("evt_a"), headers });
    const retry = await request("POST", "/api/webhooks/billing", { body: event("evt_a"), headers });
    expect(first.status).toBeGreaterThanOrEqual(200);
    expect(first.status).toBeLessThan(300);
    expect(retry.status).toBeGreaterThanOrEqual(200);
    expect(retry.status).toBeLessThan(300);
    const second = await request("POST", "/api/webhooks/billing", { body: event("evt_b", 25), headers });
    expect(second.status).toBeLessThan(300);
    const org = await db.select().from(organizations).where(eq(organizations.id, "org_globex")).get();
    expect(org?.credits).toBe(75);
  });

  // SQLite may reject some concurrent writers (SQLITE_BUSY) and the provider will retry those, so
  // only the invariant is required: never applied twice, and at least one delivery acknowledged.
  it("applies concurrent deliveries of the same event once", async () => {
    const { request, db } = await createTestContext();
    const responses = await Promise.all(Array.from({ length: 4 }, () => request("POST", "/api/webhooks/billing", { body: event("evt_c"), headers })));
    expect(responses.some((response) => response.status >= 200 && response.status < 300)).toBe(true);
    const org = await db.select().from(organizations).where(eq(organizations.id, "org_globex")).get();
    expect(org?.credits).toBe(50);
  });
});
