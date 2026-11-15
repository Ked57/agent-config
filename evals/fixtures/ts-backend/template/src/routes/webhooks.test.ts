import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { organizations } from "../db/schema";
import { createTestContext } from "../test/helpers";

const event = {
  id: "evt_1",
  type: "payment.succeeded",
  data: { orgId: "org_globex", credits: 50 },
};

describe("POST /api/webhooks/billing", () => {
  it("requires the shared secret", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/webhooks/billing", {
      body: event,
      headers: { "x-webhook-secret": "wrong" },
    });
    expect(response.status).toBe(401);
  });

  it("adds purchased credits to the organization", async () => {
    const { request, db } = await createTestContext();
    const response = await request("POST", "/api/webhooks/billing", {
      body: event,
      headers: { "x-webhook-secret": "test-webhook-secret" },
    });
    expect(response.status).toBe(200);
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, "org_globex"))
      .get();
    expect(org?.credits).toBe(50);
  });
});
