import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { organizations } from "../db/schema";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;
type Entry = { id: string; approval: string; approvedBy: string | null; rejectionReason: string | null; minutes: number };
const admin = SEED_TOKENS.acmeAdmin;
const bob = SEED_TOKENS.acmeMember;

// Seed: te_1 and te_2 are on invoice inv_acme_1; te_3 (Bob), te_4 and te_7 (Sam), te_5 and te_6 (Ada) are not.
async function call(context: Context, method: string, path: string, body?: unknown, token: string = admin) {
  const response = await context.request(method, path, { token, body });
  const text = await response.text();
  let json: any = undefined;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, json };
}

async function entry(context: Context, id: string, token: string = admin): Promise<Entry | undefined> {
  const { json } = await call(context, "GET", "/api/time-entries", undefined, token);
  return (json.items as Entry[]).find((item) => item.id === id);
}

async function setApprovalsFlag(context: Context, on: boolean) {
  await context.db.update(organizations).set({ featureFlags: JSON.stringify({ webhooks: true, timeApprovals: on }) }).where(eq(organizations.id, "org_acme"));
}

const invoiceFor = (context: Context, timeEntryIds: string[]) =>
  call(context, "POST", "/api/invoices", { clientId: "cli_northwind", issueDate: "2026-11-16", timeEntryIds });

describe("hidden G7: spec #312 time approvals", { timeout: 30_000 }, () => {
  it("R1: new entries start pending with no approver or reason", async () => {
    const context = await createTestContext();
    const created = await call(context, "POST", "/api/time-entries", { projectId: "prj_web", startedAt: "2026-11-16T09:00:00Z", minutes: 30 }, bob);
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ approval: "pending", approvedBy: null, rejectionReason: null });
    expect(await entry(context, "te_3")).toMatchObject({ approval: "pending", approvedBy: null, rejectionReason: null });
  });

  it("R2: an admin approves an entry and is recorded as approver", async () => {
    const context = await createTestContext();
    const approved = await call(context, "POST", "/api/time-entries/te_3/approve");
    expect(approved.status).toBe(200);
    expect(approved.json).toMatchObject({ id: "te_3", approval: "approved", approvedBy: "usr_ada" });
    expect(await entry(context, "te_3", bob)).toMatchObject({ approval: "approved", approvedBy: "usr_ada" });
    const again = await call(context, "POST", "/api/time-entries/te_3/approve");
    expect(again.status).toBe(200);
    expect(again.json).toMatchObject({ approval: "approved", approvedBy: "usr_ada" });
  });

  it("R2/R3: only admins of the entry's own org approve or reject", async () => {
    const context = await createTestContext();
    expect((await call(context, "POST", "/api/time-entries/te_3/approve", undefined, bob)).status).toBe(403);
    expect((await call(context, "POST", "/api/time-entries/te_3/reject", { reason: "no" }, bob)).status).toBe(403);
    expect((await call(context, "POST", "/api/time-entries/te_8/approve")).status).toBe(404);
    expect((await call(context, "POST", "/api/time-entries/te_nope/reject", { reason: "no" })).status).toBe(404);
    expect(await entry(context, "te_3")).toMatchObject({ approval: "pending" });
  });

  it("R3: rejecting needs a reason and records it", async () => {
    const context = await createTestContext();
    for (const body of [{}, { reason: "" }, { reason: "   " }, { reason: "x".repeat(501) }]) {
      expect((await call(context, "POST", "/api/time-entries/te_3/reject", body)).status).toBe(400);
    }
    const rejected = await call(context, "POST", "/api/time-entries/te_3/reject", { reason: "Wrong project" });
    expect(rejected.status).toBe(200);
    expect(rejected.json).toMatchObject({ approval: "rejected", approvedBy: null, rejectionReason: "Wrong project" });
  });

  it("R4: invoiced entries can be neither approved nor rejected", async () => {
    const context = await createTestContext();
    expect((await call(context, "POST", "/api/time-entries/te_1/approve")).status).toBe(409);
    expect((await call(context, "POST", "/api/time-entries/te_2/reject", { reason: "late" })).status).toBe(409);
  });

  it("R5: editing an approved or rejected entry puts it back to pending", async () => {
    const context = await createTestContext();
    await call(context, "POST", "/api/time-entries/te_3/approve");
    const edited = await call(context, "PATCH", "/api/time-entries/te_3", { minutes: 125 }, bob);
    expect(edited.status).toBe(200);
    expect(edited.json).toMatchObject({ approval: "pending", approvedBy: null, minutes: 125 });
    await call(context, "POST", "/api/time-entries/te_4/reject", { reason: "Duplicate" });
    await call(context, "PATCH", "/api/time-entries/te_4", { note: "Repro signup bug (Safari)" });
    expect(await entry(context, "te_4")).toMatchObject({ approval: "pending", rejectionReason: null });
  });

  it("R6: bulk approval approves every id", async () => {
    const context = await createTestContext();
    const result = await call(context, "POST", "/api/time-entries/approve", { ids: ["te_3", "te_4", "te_5"] });
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ approved: 3 });
    for (const id of ["te_3", "te_4", "te_5"]) expect(await entry(context, id)).toMatchObject({ approval: "approved", approvedBy: "usr_ada" });
  });

  it("R6: bulk approval is all or nothing", async () => {
    const context = await createTestContext();
    expect((await call(context, "POST", "/api/time-entries/approve", { ids: ["te_3", "te_8"] })).status).toBe(404);
    expect((await call(context, "POST", "/api/time-entries/approve", { ids: ["te_4", "te_1"] })).status).toBe(409);
    expect((await call(context, "POST", "/api/time-entries/approve", { ids: ["te_3"] }, bob)).status).toBe(403);
    expect(await entry(context, "te_3")).toMatchObject({ approval: "pending" });
    expect(await entry(context, "te_4")).toMatchObject({ approval: "pending" });
  });

  it("R7: with the flag on, invoices refuse unapproved time and say which", async () => {
    const context = await createTestContext();
    await setApprovalsFlag(context, true);
    await call(context, "POST", "/api/time-entries/te_3/approve");
    await call(context, "POST", "/api/time-entries/te_4/reject", { reason: "Wrong client" });
    const refused = await invoiceFor(context, ["te_3", "te_4", "te_5"]);
    expect(refused.status).toBe(409);
    expect(refused.json).toMatchObject({ code: "unapproved_time" });
    expect([...refused.json.entryIds].sort()).toEqual(["te_4", "te_5"]);
    expect(await entry(context, "te_3")).toMatchObject({ approval: "approved" });
    const invoices = await call(context, "GET", "/api/invoices");
    expect(invoices.json.items).toHaveLength(2);
  });

  it("R7: with the flag on, approved time is invoiced", async () => {
    const context = await createTestContext();
    await setApprovalsFlag(context, true);
    await call(context, "POST", "/api/time-entries/approve", { ids: ["te_3", "te_5"] });
    const invoice = await invoiceFor(context, ["te_3", "te_5"]);
    expect(invoice.status).toBe(201);
    expect(invoice.json.lines).toHaveLength(2);
  });

  it("R7: with the flag off, invoicing works as before", async () => {
    const context = await createTestContext();
    const invoice = await invoiceFor(context, ["te_3", "te_4"]);
    expect(invoice.status).toBe(201);
    expect(invoice.json.lines.map((line: { amountCents: number }) => line.amountCents)).toEqual([18000, 5625]);
  });

  it("R8: an invoice total is exactly the sum of its lines", async () => {
    const context = await createTestContext();
    // Ada has no own rate: 7 minutes at Website relaunch's 100.00/h is 11.666... -> 1167 cents.
    const logged = await call(context, "POST", "/api/time-entries", { projectId: "prj_web", startedAt: "2026-11-16T10:00:00Z", minutes: 7 });
    const second = await call(context, "POST", "/api/time-entries", { projectId: "prj_web", startedAt: "2026-11-16T11:00:00Z", minutes: 13 });
    const invoice = await invoiceFor(context, [logged.json.id, second.json.id]);
    expect(invoice.status).toBe(201);
    const lines = invoice.json.lines as { amountCents: number }[];
    expect(lines.map((line) => line.amountCents)).toEqual([1167, 2167]);
    expect(invoice.json.totalCents).toBe(3334);
    const fixed = await call(context, "POST", "/api/invoices", { clientName: "Acme", issueDate: "2026-11-16", lines: [{ description: "Fix", unitPriceCents: 1999 }, { description: "Fee", unitPriceCents: 29 }] });
    expect(fixed.json.totalCents).toBe(2028);
  });

  it("R9: approvals and rejections are audited", async () => {
    const context = await createTestContext();
    await call(context, "POST", "/api/time-entries/te_3/approve");
    await call(context, "POST", "/api/time-entries/te_4/reject", { reason: "Duplicate" });
    await call(context, "POST", "/api/time-entries/approve", { ids: ["te_5", "te_6"] });
    const { json } = await call(context, "GET", "/api/audit?entityType=time_entry");
    const events = (json.items as { action: string; entityId: string; actorId: string; data: Record<string, unknown> }[]).map((event) => ({
      action: event.action,
      entityId: event.entityId,
      actorId: event.actorId,
      reason: event.data.reason,
    }));
    expect(events).toEqual(
      expect.arrayContaining([
        { action: "time_entry.approved", entityId: "te_3", actorId: "usr_ada", reason: undefined },
        { action: "time_entry.rejected", entityId: "te_4", actorId: "usr_ada", reason: "Duplicate" },
        { action: "time_entry.approved", entityId: "te_5", actorId: "usr_ada", reason: undefined },
        { action: "time_entry.approved", entityId: "te_6", actorId: "usr_ada", reason: undefined },
      ]),
    );
    expect(events).toHaveLength(4);
  });

  it("R10: rejecting notifies the person who logged the entry", async () => {
    const context = await createTestContext();
    await call(context, "POST", "/api/time-entries/te_3/reject", { reason: "Wrong project" });
    const { json } = await call(context, "GET", "/api/notifications", undefined, bob);
    expect(json.items).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "time_entry.rejected", payload: { timeEntryId: "te_3", reason: "Wrong project" } })]));
    const ada = await call(context, "GET", "/api/notifications");
    expect(ada.json.items.filter((item: { kind: string }) => item.kind === "time_entry.rejected")).toHaveLength(0);
  });

  it("R11: the weekly timesheet shows approved minutes per person", async () => {
    const context = await createTestContext();
    const before = await call(context, "GET", "/api/reports/timesheet?week=2026-11-09");
    await call(context, "POST", "/api/time-entries/approve", { ids: ["te_5"] });
    const { json } = await call(context, "GET", "/api/reports/timesheet?week=2026-11-09");
    const person = (sheet: any, id: string) => sheet.users.find((user: { userId: string }) => user.userId === id);
    expect(person(json, "usr_ada")).toMatchObject({ approvedMinutes: 60, totalMinutes: 90 });
    expect(person(json, "usr_bob")).toMatchObject({ approvedMinutes: 0 });
    const withoutApproved = (sheet: any) => ({ ...sheet, users: sheet.users.map(({ approvedMinutes: _ignored, ...user }: Record<string, unknown>) => user) });
    expect(withoutApproved(json)).toEqual(withoutApproved(before.json));
  });

  it("R11: the deprecated v1 timesheet shows approved hours per row", async () => {
    const context = await createTestContext();
    const before = await call(context, "GET", "/api/v1/reports/timesheet?week=2026-11-09");
    await call(context, "POST", "/api/time-entries/te_5/approve");
    const { json } = await call(context, "GET", "/api/v1/reports/timesheet?week=2026-11-09");
    expect(json.rows.map((row: { approved_hours: string }) => row.approved_hours)).toEqual(json.rows.map((row: { user_id: string; day: string }) => (row.user_id === "usr_ada" && row.day === "10/11/2026" ? "1.00" : "0.00")));
    const withoutApproved = (rows: Record<string, string>[]) => rows.map(({ approved_hours: _ignored, ...row }) => row);
    expect(withoutApproved(json.rows)).toEqual(withoutApproved(before.json.rows));
    expect(json.total_hours).toBe(before.json.total_hours);
  });

  it("R12: the time-entry list filters by approval state", async () => {
    const context = await createTestContext();
    await call(context, "POST", "/api/time-entries/te_3/approve");
    await call(context, "POST", "/api/time-entries/te_4/reject", { reason: "No" });
    const ids = async (state: string) => ((await call(context, "GET", `/api/time-entries?approval=${state}`)).json.items as Entry[]).map((item) => item.id).sort();
    expect(await ids("approved")).toEqual(["te_1", "te_2", "te_3"]);
    expect(await ids("rejected")).toEqual(["te_4"]);
    expect(await ids("pending")).toEqual(["te_5", "te_6", "te_7"]);
    expect((await call(context, "GET", "/api/time-entries?approval=maybe")).status).toBe(400);
  });

  it("R13: entries already on an invoice count as approved, others are pending", async () => {
    const context = await createTestContext();
    expect(await entry(context, "te_1")).toMatchObject({ approval: "approved", rejectionReason: null });
    expect(await entry(context, "te_2")).toMatchObject({ approval: "approved" });
    expect(await entry(context, "te_7")).toMatchObject({ approval: "pending" });
  });
});
