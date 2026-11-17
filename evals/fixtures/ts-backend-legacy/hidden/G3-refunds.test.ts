import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;
type Ledger = { entries: { invoiceId: string | null; kind: string; amountCents: number }[]; balanceCents: number };
const admin = SEED_TOKENS.acmeAdmin;

// Seed: inv_acme_1 (issued, total 55000) has 20000 paid. inv_acme_2 is a draft. inv_globex_1 belongs to Globex.
// The finance tool sends an Idempotency-Key with every call, as it does for payments, so every request
// here carries one: a solution may require it.
const refund = (context: Context, invoiceId: string, amountCents: unknown, key = crypto.randomUUID(), token = admin) =>
  context.request("POST", `/api/invoices/${invoiceId}/refunds`, {
    token,
    headers: { "idempotency-key": key },
    body: { amountCents, reason: "Goodwill" },
  });

async function ledger(context: Context, token = admin) {
  const response = await context.request("GET", "/api/ledger", { token });
  expect(response.status).toBe(200);
  return (await response.json()) as Ledger;
}

const refundsOf = (book: Ledger, invoiceId: string) =>
  book.entries.filter((entry) => entry.invoiceId === invoiceId && entry.kind === "refund");

async function invoice(context: Context, id: string) {
  return (await (await context.request("GET", `/api/invoices/${id}`, { token: admin })).json()) as Record<string, unknown>;
}

/** Issues a fresh invoice of `cents` for Northwind. */
async function issuedInvoice(context: Context, cents: number) {
  const created = await context.request("POST", "/api/invoices", {
    token: admin,
    body: { clientId: "cli_northwind", issueDate: "2026-11-16", lines: [{ description: "Work", unitPriceCents: cents }] },
  });
  const { id } = (await created.json()) as { id: string };
  expect((await context.request("POST", `/api/invoices/${id}/issue`, { token: admin })).status).toBe(200);
  return id;
}

describe("hidden G3: partial refunds", { timeout: 30_000 }, () => {
  it("records a partial refund and answers 201 with it", async () => {
    const context = await createTestContext();
    const response = await refund(context, "inv_acme_1", 3000);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id: expect.any(String), invoiceId: "inv_acme_1", amountCents: 3000, reason: "Goodwill", createdAt: expect.any(String) });
  });

  it("shows refundedCents on the invoice", async () => {
    const context = await createTestContext();
    await refund(context, "inv_acme_1", 3000);
    await refund(context, "inv_acme_1", 1500);
    expect((await invoice(context, "inv_acme_1")).refundedCents).toBe(4500);
    expect((await invoice(context, "inv_acme_2")).refundedCents).toBe(0);
  });

  it("books each refund as a negative refund entry and keeps the ledger balance in step", async () => {
    const context = await createTestContext();
    const before = await ledger(context);
    await refund(context, "inv_acme_1", 3000);
    const after = await ledger(context);
    expect(refundsOf(after, "inv_acme_1").map((entry) => entry.amountCents)).toEqual([-3000]);
    expect(after.balanceCents).toBe(before.balanceCents - 3000);
    expect(after.balanceCents).toBe(after.entries.reduce((sum, entry) => sum + entry.amountCents, 0));
  });

  it("never refunds more than was paid, counting earlier refunds, but allows exactly the rest", async () => {
    const context = await createTestContext();
    expect((await refund(context, "inv_acme_1", 15000)).status).toBe(201);
    expect((await refund(context, "inv_acme_1", 5001)).status).toBe(409);
    expect(refundsOf(await ledger(context), "inv_acme_1")).toHaveLength(1);
    expect((await refund(context, "inv_acme_1", 5000)).status).toBe(201);
    expect((await refund(context, "inv_acme_1", 1)).status).toBe(409);
    expect((await invoice(context, "inv_acme_1")).refundedCents).toBe(20000);
  });

  it("refuses refunds on an invoice nothing was paid on", async () => {
    const context = await createTestContext();
    const id = await issuedInvoice(context, 10000);
    expect((await refund(context, id, 1)).status).toBe(409);
    expect((await refund(context, "inv_acme_2", 1)).status).toBe(409);
    expect(refundsOf(await ledger(context), id)).toHaveLength(0);
  });

  it("rejects amounts that are not positive whole cents with 422", async () => {
    const context = await createTestContext();
    for (const amount of [0, -500, 10.5, null]) {
      expect((await refund(context, "inv_acme_1", amount)).status, String(amount)).toBe(422);
    }
    expect(refundsOf(await ledger(context), "inv_acme_1")).toHaveLength(0);
  });

  it("is for admins of the invoice's own organization", async () => {
    const context = await createTestContext();
    expect((await refund(context, "inv_acme_1", 100, undefined, SEED_TOKENS.acmeMember)).status).toBe(403);
    expect((await refund(context, "inv_globex_1", 100)).status).toBe(404);
    expect(refundsOf(await ledger(context, SEED_TOKENS.globexAdmin), "inv_globex_1")).toHaveLength(0);
  });

  it("answers a retry with the original response and refunds once", async () => {
    const context = await createTestContext();
    const first = await refund(context, "inv_acme_1", 2500, "refund-retry-1");
    const second = await refund(context, "inv_acme_1", 2500, "refund-retry-1");
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(((await second.json()) as { id: string }).id).toBe(((await first.json()) as { id: string }).id);
    expect(refundsOf(await ledger(context), "inv_acme_1")).toHaveLength(1);
  });

  it("refunds once when the same retry arrives several times at once", async () => {
    const context = await createTestContext();
    const responses = await Promise.all(Array.from({ length: 6 }, () => refund(context, "inv_acme_1", 4000, "refund-burst")));
    const bodies = (await Promise.all(responses.map((response) => response.json()))) as { id: string }[];
    expect(responses.map((response) => response.status)).toEqual(Array(6).fill(201));
    expect(new Set(bodies.map((body) => body.id)).size).toBe(1);
    expect(refundsOf(await ledger(context), "inv_acme_1").map((entry) => entry.amountCents)).toEqual([-4000]);
  });

  it("never over-refunds when refunds arrive at the same time", async () => {
    const context = await createTestContext();
    const before = await ledger(context);
    const responses = await Promise.all(Array.from({ length: 8 }, () => refund(context, "inv_acme_1", 6000)));
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([201, 201, 201, 409, 409, 409, 409, 409]);
    const after = await ledger(context);
    expect(refundsOf(after, "inv_acme_1").reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(-18000);
    expect(after.balanceCents).toBe(before.balanceCents - 18000);
    expect(after.balanceCents).toBeGreaterThanOrEqual(0);
  });

  it("lets finance refund in full what a decimal payment paid", async () => {
    const context = await createTestContext();
    const id = await issuedInvoice(context, 1999);
    const paid = await context.request("POST", `/api/invoices/${id}/payments`, { token: admin, body: { amount: 19.99, method: "card" } });
    expect(paid.status).toBe(201);
    expect((await refund(context, id, 1999)).status).toBe(201);
    const book = await ledger(context);
    expect(book.entries.filter((entry) => entry.invoiceId === id).reduce((sum, entry) => sum + entry.amountCents, 0)).toBe(0);
  });
});
