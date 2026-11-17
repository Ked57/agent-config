import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;

// Seeded people: Sam (acme, Australia/Sydney), Ada (acme admin, Europe/Berlin),
// Bob (acme, Europe/London), Hal (globex, America/Los_Angeles), Gina (globex admin).
// Ticket: Sam logged 2 h on Monday morning, Sydney time; the weekly timesheet shows them on
// Sunday of the previous week, and payroll uses the same numbers. Stated rule: time counts on
// the calendar day it was logged on, for the person who logged it, wherever they are.

async function log(context: Context, token: string, projectId: string, startedAt: string, minutes: number) {
  const response = await context.request("POST", "/api/time-entries", { token, body: { projectId, startedAt, minutes } });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function get(context: Context, token: string, path: string) {
  const response = await context.request("GET", path, { token });
  expect(response.status, path).toBe(200);
  return response;
}

type Timesheet = { weekStart: string; users: { userId: string; days: Record<string, number>; totalMinutes: number }[] };
async function timesheet(context: Context, token: string, week: string) {
  return (await (await get(context, token, `/api/reports/timesheet?week=${week}`)).json()) as Timesheet;
}

const minutesOn = (sheet: Timesheet, userId: string, day: string) =>
  sheet.users.find((user) => user.userId === userId)?.days[day] ?? 0;
const totalFor = (sheet: Timesheet, userId: string) => sheet.users.find((user) => user.userId === userId)?.totalMinutes ?? 0;

// Monday 2026-11-16, 08:00 in Sydney (UTC+11 in November) is Sunday 21:00 UTC.
const SAM_MONDAY_MORNING = "2026-11-15T21:00:00Z";

describe("hidden G2: time counts on the logger's local day", { timeout: 30_000 }, () => {
  it("puts Sam's Monday-morning entry on Monday of his week", async () => {
    const context = await createTestContext();
    await log(context, SEED_TOKENS.acmeSydney, "prj_web", SAM_MONDAY_MORNING, 120);
    const sheet = await timesheet(context, SEED_TOKENS.acmeAdmin, "2026-11-16");
    expect(minutesOn(sheet, "usr_sam", "2026-11-16")).toBe(120);
    expect(totalFor(sheet, "usr_sam")).toBe(120);
  });

  it("leaves it out of the previous week", async () => {
    const context = await createTestContext();
    const before = await timesheet(context, SEED_TOKENS.acmeAdmin, "2026-11-09");
    await log(context, SEED_TOKENS.acmeSydney, "prj_web", SAM_MONDAY_MORNING, 120);
    const after = await timesheet(context, SEED_TOKENS.acmeAdmin, "2026-11-09");
    expect(totalFor(after, "usr_sam")).toBe(totalFor(before, "usr_sam"));
    expect(minutesOn(after, "usr_sam", "2026-11-15")).toBe(minutesOn(before, "usr_sam", "2026-11-15"));
  });

  it("puts a Monday-evening entry in Los Angeles on Monday", async () => {
    const context = await createTestContext();
    // 22:30 on Monday in Los Angeles (UTC-8) is 06:30 UTC on Tuesday.
    await log(context, SEED_TOKENS.globexMember, "prj_infra", "2026-11-17T06:30:00Z", 60);
    const sheet = await timesheet(context, SEED_TOKENS.globexAdmin, "2026-11-16");
    expect(minutesOn(sheet, "usr_hal", "2026-11-16")).toBe(60);
    expect(minutesOn(sheet, "usr_hal", "2026-11-17")).toBe(0);
  });

  it("puts an entry just after midnight in Berlin on the new day", async () => {
    const context = await createTestContext();
    // 00:30 on Monday in Berlin (UTC+1) is 23:30 UTC on Sunday.
    await log(context, SEED_TOKENS.acmeAdmin, "prj_internal", "2026-11-15T23:30:00Z", 30);
    const sheet = await timesheet(context, SEED_TOKENS.acmeAdmin, "2026-11-16");
    expect(minutesOn(sheet, "usr_ada", "2026-11-16")).toBe(30);
  });

  it("follows daylight saving time: Sydney's offset differs in July and November", async () => {
    const context = await createTestContext();
    // 23:30 on Sunday 2026-07-05 in Sydney (UTC+10 in winter) is 13:30 UTC the same day.
    await log(context, SEED_TOKENS.acmeSydney, "prj_web", "2026-07-05T13:30:00Z", 45);
    // 00:30 on Monday 2026-10-05, the day after clocks went forward (UTC+11), is 13:30 UTC on Sunday.
    await log(context, SEED_TOKENS.acmeSydney, "prj_web", "2026-10-04T13:30:00Z", 50);
    const july = await timesheet(context, SEED_TOKENS.acmeAdmin, "2026-06-29");
    expect(minutesOn(july, "usr_sam", "2026-07-05")).toBe(45);
    const october = await timesheet(context, SEED_TOKENS.acmeAdmin, "2026-10-05");
    expect(minutesOn(october, "usr_sam", "2026-10-05")).toBe(50);
  });

  it("keeps people whose local day matches UTC where they were", async () => {
    const context = await createTestContext();
    await log(context, SEED_TOKENS.acmeMember, "prj_web", "2026-11-16T09:30:00Z", 45);
    const sheet = await timesheet(context, SEED_TOKENS.acmeAdmin, "2026-11-16");
    expect(minutesOn(sheet, "usr_bob", "2026-11-16")).toBe(45);
  });

  it("shows the local day in the deprecated v1 timesheet", async () => {
    const context = await createTestContext();
    await log(context, SEED_TOKENS.acmeSydney, "prj_web", SAM_MONDAY_MORNING, 120);
    const report = (await (await get(context, SEED_TOKENS.acmeAdmin, "/api/v1/reports/timesheet?week=2026-11-16")).json()) as {
      rows: { user_id: string; day: string; hours: string }[];
    };
    expect(report.rows.filter((row) => row.user_id === "usr_sam")).toEqual([
      expect.objectContaining({ day: "16/11/2026", hours: "2.00" }),
    ]);
  });

  it("shows the local day in the payroll export", async () => {
    const context = await createTestContext();
    await log(context, SEED_TOKENS.acmeSydney, "prj_web", SAM_MONDAY_MORNING, 120);
    const csv = await (await get(context, SEED_TOKENS.acmeAdmin, "/api/exports/payroll.csv?week=2026-11-16")).text();
    const rows = csv.trim().split("\n").filter((line) => line.includes("usr_sam"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(",16/11/2026,2.00,");
  });

  it("gives the entry its local day in the time-entry list", async () => {
    const context = await createTestContext();
    const id = await log(context, SEED_TOKENS.acmeSydney, "prj_web", SAM_MONDAY_MORNING, 120);
    const { items } = (await (await get(context, SEED_TOKENS.acmeSydney, "/api/time-entries")).json()) as {
      items: { id: string; day: string }[];
    };
    expect(items.find((item) => item.id === id)?.day).toBe("2026-11-16");
  });

  it("finds the entry when filtering the list by its local day only", async () => {
    const context = await createTestContext();
    const id = await log(context, SEED_TOKENS.acmeSydney, "prj_web", SAM_MONDAY_MORNING, 120);
    const ids = async (date: string) =>
      ((await (await get(context, SEED_TOKENS.acmeSydney, `/api/time-entries?date=${date}`)).json()) as { items: { id: string }[] }).items.map(
        (item) => item.id,
      );
    expect(await ids("2026-11-16")).toContain(id);
    expect(await ids("2026-11-15")).not.toContain(id);
  });

  it("exports the entry on its local day and within that day's range", async () => {
    const context = await createTestContext();
    await log(context, SEED_TOKENS.acmeSydney, "prj_web", SAM_MONDAY_MORNING, 120);
    const day = await (await get(context, SEED_TOKENS.acmeAdmin, "/api/exports/time-entries.csv?from=2026-11-16&to=2026-11-16")).text();
    const sams = day.trim().split("\n").filter((line) => line.includes("Sam Taylor"));
    expect(sams).toHaveLength(1);
    expect(sams[0]).toMatch(/^16\/11\/2026,Sam Taylor,/);
    const sunday = await (await get(context, SEED_TOKENS.acmeAdmin, "/api/exports/time-entries.csv?from=2026-11-15&to=2026-11-15")).text();
    expect(sunday).not.toContain("Sam Taylor");
  });
});
