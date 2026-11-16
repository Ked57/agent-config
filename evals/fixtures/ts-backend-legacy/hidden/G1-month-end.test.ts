import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;
const admin = SEED_TOKENS.acmeAdmin;

async function call(context: Context, method: string, path: string, body?: unknown) {
  const response = await context.request(method, path, { token: admin, body });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // CSV or plain text
  }
  return { status: response.status, body: parsed as Record<string, unknown> & { [key: string]: never }, text };
}

/** cli_initech (seeded) pays on next-month terms. */
async function invoiceOn(context: Context, issueDate: string, extra: Record<string, unknown> = {}) {
  const created = await call(context, "POST", "/api/invoices", {
    clientId: "cli_initech",
    issueDate,
    lines: [{ description: "Retainer", unitPriceCents: 10000 }],
    ...extra,
  });
  expect(created.status).toBe(201);
  return created.body as unknown as { id: string; dueDate: string; number: string };
}

const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const pad = (value: number) => String(value).padStart(2, "0");

// The log excerpt: the invoice export fails with `RangeError: invalid calendar day "2026-11-31"`.
// The invoice behind it was issued on 2026-10-31 on next-month terms, and the legacy addMonths
// helper documents its contract: "the day of month is kept, clamped to the last day of the
// target month (2026-01-31 + 1 month = 2026-02-28)".
describe("hidden G1: month-end dates", { timeout: 30_000 }, () => {
  it("exports invoices again when one was issued on the 31st on next-month terms", async () => {
    const context = await createTestContext();
    const invoice = await invoiceOn(context, "2026-10-31");
    const exported = await call(context, "GET", "/api/exports/invoices.csv");
    expect(exported.status).toBe(200);
    const row = exported.text.split("\n").find((line) => line.startsWith(`${invoice.number},`));
    expect(row).toContain(",31/10/2026,30/11/2026,");
  });

  it("gives that invoice a real due date: the last day of the next month", async () => {
    const context = await createTestContext();
    const invoice = await invoiceOn(context, "2026-10-31");
    expect(invoice.dueDate).toBe("2026-11-30");
    const fetched = await call(context, "GET", `/api/invoices/${invoice.id}`);
    expect(fetched.body.dueDate).toBe("2026-11-30");
  });

  it("clamps to the end of February, including leap years", async () => {
    const context = await createTestContext();
    expect((await invoiceOn(context, "2027-01-31")).dueDate).toBe("2027-02-28");
    expect((await invoiceOn(context, "2027-01-29")).dueDate).toBe("2027-02-28");
    expect((await invoiceOn(context, "2028-01-31")).dueDate).toBe("2028-02-29");
    expect((await invoiceOn(context, "2028-01-30")).dueDate).toBe("2028-02-29");
  });

  it("clamps to 30-day months", async () => {
    const context = await createTestContext();
    expect((await invoiceOn(context, "2027-03-31")).dueDate).toBe("2027-04-30");
    expect((await invoiceOn(context, "2027-08-31")).dueDate).toBe("2027-09-30");
  });

  it("keeps the day of month when it exists in the next month", async () => {
    const context = await createTestContext();
    expect((await invoiceOn(context, "2026-11-15")).dueDate).toBe("2026-12-15");
    expect((await invoiceOn(context, "2026-12-31")).dueDate).toBe("2027-01-31");
    expect((await invoiceOn(context, "2027-02-28")).dueDate).toBe("2027-03-28");
    expect((await invoiceOn(context, "2027-01-30", { terms: "net_30" })).dueDate).toBe("2027-03-01");
  });

  it("gives every day of a year a valid next-month due date", async () => {
    const context = await createTestContext();
    for (let month = 1; month <= 12; month += 1) {
      for (const day of [28, 29, 30, 31]) {
        if (day > lastDay(2027, month)) continue;
        const issueDate = `2027-${pad(month)}-${pad(day)}`;
        const nextYear = month === 12 ? 2028 : 2027;
        const nextMonth = month === 12 ? 1 : month + 1;
        const expected = `${nextYear}-${pad(nextMonth)}-${pad(Math.min(day, lastDay(nextYear, nextMonth)))}`;
        expect((await invoiceOn(context, issueDate)).dueDate, issueDate).toBe(expected);
      }
    }
  });

  it("drafts the next monthly invoice on the last day of a shorter month", async () => {
    const context = await createTestContext();
    const invoice = await invoiceOn(context, "2027-01-31", { repeat: "monthly" });
    const issued = await call(context, "POST", `/api/invoices/${invoice.id}/issue`);
    expect(issued.status).toBe(200);
    const next = issued.body.nextInvoice as unknown as { id: string; issueDate: string; dueDate: string };
    expect(next.issueDate).toBe("2027-02-28");
    expect(next.dueDate).toBe("2027-03-28");
    const exported = await call(context, "GET", "/api/exports/invoices.csv");
    expect(exported.status).toBe(200);
  });

  it("schedules the next monthly task on the last day of a shorter month", async () => {
    const context = await createTestContext();
    const dates: Record<string, string> = { "2026-10-31": "2026-11-30", "2027-01-30": "2027-02-28", "2028-01-31": "2028-02-29" };
    for (const [dueDate, expected] of Object.entries(dates)) {
      const created = await call(context, "POST", "/api/projects/prj_internal/tasks", {
        title: `Month-end close ${dueDate}`,
        dueDate,
        repeat: "monthly",
      });
      expect(created.status).toBe(201);
      const done = await call(context, "PATCH", `/api/tasks/${created.body.id as unknown as string}`, { status: "done" });
      expect(done.status).toBe(200);
      const next = done.body.nextOccurrence as unknown as { id: string; dueDate: string };
      expect(next.dueDate, dueDate).toBe(expected);
      const fetched = await call(context, "GET", `/api/tasks/${next.id}`);
      expect(fetched.body.dueDate).toBe(expected);
    }
  });

  it("keeps the deprecated invoice report working for such invoices", async () => {
    const context = await createTestContext();
    const invoice = await invoiceOn(context, "2026-10-31");
    expect((await call(context, "POST", `/api/invoices/${invoice.id}/issue`)).status).toBe(200);
    const report = await call(context, "GET", "/api/v1/reports/invoices");
    expect(report.status).toBe(200);
    const rows = (report.body as unknown as { invoices: { number: string; due: string }[] }).invoices;
    expect(rows.find((row) => row.number === invoice.number)?.due).toBe("30/11/2026");
  });
});
