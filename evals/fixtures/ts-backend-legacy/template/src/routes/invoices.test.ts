import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

const admin = SEED_TOKENS.acmeAdmin;
type Invoice = {
  id: string;
  number: string;
  status: string;
  dueDate: string;
  totalCents: number;
  lines: { amountCents: number }[];
  nextInvoice: { issueDate: string; status: string } | null;
};

describe("invoices", () => {
  it("creates a draft from fixed-price lines", async () => {
    const { json } = await createTestContext();
    const created = await json<Invoice>("POST", "/api/invoices", {
      token: admin,
      body: {
        clientId: "cli_northwind",
        issueDate: "2026-11-16",
        lines: [{ description: "Hosting", quantity: 3, unitPriceCents: 2500 }],
      },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      number: "INV-2026-0003",
      status: "draft",
      dueDate: "2026-12-16",
      totalCents: 7500,
    });
  });

  it("bills time entries at the person's rate or the project rate", async () => {
    const { json } = await createTestContext();
    const created = await json<Invoice>("POST", "/api/invoices", {
      token: admin,
      body: {
        clientName: "Northwind Traders",
        issueDate: "2026-11-16",
        timeEntryIds: ["te_3", "te_4"],
      },
    });
    expect(created.body.lines.map((line) => line.amountCents)).toEqual([
      18000, 5625,
    ]);
    const again = await json("POST", "/api/invoices", {
      token: admin,
      body: {
        clientName: "Northwind",
        issueDate: "2026-11-16",
        timeEntryIds: ["te_3"],
      },
    });
    expect(again.status).toBe(409);
  });

  it("uses the client's payment terms", async () => {
    const { json } = await createTestContext();
    const created = await json<Invoice>("POST", "/api/invoices", {
      token: admin,
      body: {
        clientId: "cli_initech",
        issueDate: "2026-11-10",
        lines: [{ description: "Support", unitPriceCents: 1000 }],
      },
    });
    expect(created.body.dueDate).toBe("2026-12-10");
  });

  it("issues a monthly invoice and drafts the next one", async () => {
    const { json } = await createTestContext();
    const created = await json<Invoice>("POST", "/api/invoices", {
      token: admin,
      body: {
        clientId: "cli_initech",
        issueDate: "2026-11-05",
        repeat: "monthly",
        lines: [{ description: "Retainer", unitPriceCents: 50000 }],
      },
    });
    const issued = await json<Invoice>(
      "POST",
      `/api/invoices/${created.body.id}/issue`,
      { token: admin },
    );
    expect(issued.body.status).toBe("issued");
    expect(issued.body.nextInvoice).toMatchObject({
      issueDate: "2026-12-05",
      status: "draft",
    });
  });

  it("is admin only and org scoped", async () => {
    const { request } = await createTestContext();
    const member = await request("POST", "/api/invoices", {
      token: SEED_TOKENS.acmeMember,
      body: {
        clientName: "x",
        issueDate: "2026-11-16",
        lines: [{ description: "x", unitPriceCents: 1 }],
      },
    });
    expect(member.status).toBe(403);
    expect(
      (await request("GET", "/api/invoices/inv_globex_1", { token: admin }))
        .status,
    ).toBe(404);
  });

  it("shows what has been paid", async () => {
    const { json } = await createTestContext();
    const { body } = await json("GET", "/api/invoices/inv_acme_1", {
      token: admin,
    });
    expect(body).toMatchObject({
      totalCents: 55000,
      paidCents: 20000,
      balanceCents: 35000,
    });
  });
});
