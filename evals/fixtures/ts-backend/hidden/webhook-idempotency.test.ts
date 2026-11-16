import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { organizations } from "../db/schema";
import { createTestContext } from "../test/helpers";

const headers = { "x-webhook-secret": "test-webhook-secret" };
const event = (id: string, credits = 50) => ({ id, type: "payment.succeeded", data: { orgId: "org_globex", credits } });
const acknowledged = (response: Response) => response.status >= 200 && response.status < 300;

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

  // Idempotency is on the event id, not on what the event says: a different event with the same
  // organization and amount is a new payment.
  it("applies a different event with an identical payload", async () => {
    const { request, db } = await createTestContext();
    expect(acknowledged(await request("POST", "/api/webhooks/billing", { body: event("evt_d"), headers }))).toBe(true);
    expect(acknowledged(await request("POST", "/api/webhooks/billing", { body: event("evt_e"), headers }))).toBe(true);
    expect(acknowledged(await request("POST", "/api/webhooks/billing", { body: event("evt_d"), headers }))).toBe(true);
    const org = await db.select().from(organizations).where(eq(organizations.id, "org_globex")).get();
    expect(org?.credits).toBe(100);
  });

  // A provider retry can overlap the original delivery. Every delivery of a repeated event must be
  // acknowledged (a 5xx makes the provider retry again) and the credits applied once.
  it("acknowledges concurrent deliveries of the same event and applies it once", async () => {
    const { request, db } = await createTestContext();
    const responses = await Promise.all(Array.from({ length: 4 }, () => request("POST", "/api/webhooks/billing", { body: event("evt_c"), headers })));
    expect(responses.map((response) => response.status).filter((status) => status < 200 || status >= 300)).toEqual([]);
    const org = await db.select().from(organizations).where(eq(organizations.id, "org_globex")).get();
    expect(org?.credits).toBe(50);
  });

  // The provider retries for hours, so a retry can arrive after a deploy or on another instance:
  // a fresh copy of the server code on the same database must still recognise the event.
  it("does not apply a retry again after the server restarts", async () => {
    const { request, db } = await createTestContext();
    expect(acknowledged(await request("POST", "/api/webhooks/billing", { body: event("evt_r"), headers }))).toBe(true);
    vi.resetModules();
    const { createApp } = await import("../app");
    const restarted = createApp({ db });
    const retry = await restarted.handle(
      new Request("http://localhost/api/webhooks/billing", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify(event("evt_r")),
      }),
    );
    expect(acknowledged(retry)).toBe(true);
    const org = await db.select().from(organizations).where(eq(organizations.id, "org_globex")).get();
    expect(org?.credits).toBe(50);
  });
});
