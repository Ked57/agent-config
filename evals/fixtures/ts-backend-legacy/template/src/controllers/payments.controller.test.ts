import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

const admin = SEED_TOKENS.acmeAdmin;

describe("payments", () => {
  it("records a payment and marks the invoice paid when covered", async () => {
    const { json } = await createTestContext();
    const paid = await json("POST", "/api/invoices/inv_acme_1/payments", {
      token: admin,
      body: { amount: 350, method: "card" },
    });
    expect(paid.status).toBe(201);
    expect(paid.body).toMatchObject({
      amountCents: 35000,
      invoicePaidCents: 55000,
    });
    const invoice = await json("GET", "/api/invoices/inv_acme_1", {
      token: admin,
    });
    expect(invoice.body).toMatchObject({ status: "paid", balanceCents: 0 });
  });

  it("replays a retried request", async () => {
    const { json } = await createTestContext();
    const headers = { "idempotency-key": "retry-1" };
    const first = await json<{ id: string }>(
      "POST",
      "/api/invoices/inv_acme_1/payments",
      {
        token: admin,
        headers,
        body: { amount: 10 },
      },
    );
    const second = await json<{ id: string }>(
      "POST",
      "/api/invoices/inv_acme_1/payments",
      {
        token: admin,
        headers,
        body: { amount: 10 },
      },
    );
    expect(second.body.id).toBe(first.body.id);
    const ledger = await json<{ entries: unknown[] }>(
      "GET",
      "/api/ledger?invoiceId=inv_acme_1",
      { token: admin },
    );
    expect(ledger.body.entries).toHaveLength(2);
  });

  it("refuses drafts and bad amounts", async () => {
    const { request } = await createTestContext();
    const draft = await request("POST", "/api/invoices/inv_acme_2/payments", {
      token: admin,
      body: { amount: 5 },
    });
    expect(draft.status).toBe(409);
    const negative = await request(
      "POST",
      "/api/invoices/inv_acme_1/payments",
      { token: admin, body: { amount: -5 } },
    );
    expect(negative.status).toBe(400);
  });

  it("lists payments", async () => {
    const { json } = await createTestContext();
    const { body } = await json<{ items: { reference: string }[] }>(
      "GET",
      "/api/invoices/inv_acme_1/payments",
      { token: admin },
    );
    expect(body.items.map((p) => p.reference)).toEqual(["NW-7781"]);
  });
});
