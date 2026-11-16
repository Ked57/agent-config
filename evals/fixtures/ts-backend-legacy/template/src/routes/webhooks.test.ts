import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

const headers = { "x-webhook-secret": "test-webhook-secret" };

describe("billing webhook", () => {
  it("rejects a wrong secret", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/webhooks/billing", {
      headers: { "x-webhook-secret": "nope" },
      body: {
        id: "evt_1",
        type: "payment.succeeded",
        data: { orgId: "org_acme" },
      },
    });
    expect(response.status).toBe(401);
  });

  it("records provider payments once", async () => {
    const { json, request } = await createTestContext();
    const event = {
      id: "evt_2",
      type: "payment.succeeded",
      data: { orgId: "org_acme", invoiceId: "inv_acme_1", amount: 100 },
    };
    await request("POST", "/api/webhooks/billing", { headers, body: event });
    const again = await json("POST", "/api/webhooks/billing", {
      headers,
      body: event,
    });
    expect(again.body).toEqual({ received: true, duplicate: true });
    const invoice = await json("GET", "/api/invoices/inv_acme_1", {
      token: SEED_TOKENS.acmeAdmin,
    });
    expect(invoice.body).toMatchObject({ paidCents: 30000 });
  });
});
