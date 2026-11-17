import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runDueJobs } from "../services/jobs";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;
const admin = SEED_TOKENS.acmeAdmin;
const GOLDEN_FILE = join(__dirname, "G8-golden.json");
// Captured from the v1 implementation (CAPTURE=1 writes it).
const golden: Record<string, unknown> = process.env.CAPTURE ? {} : JSON.parse(readFileSync(GOLDEN_FILE, "utf8"));
const captured: Record<string, unknown> = {};

function check(name: string, value: unknown) {
  if (process.env.CAPTURE) {
    captured[name] = value;
    writeFileSync(GOLDEN_FILE, JSON.stringify(captured, null, 2));
    return;
  }
  expect(value, name).toEqual(golden[name]);
}

const NOW = Date.parse("2026-11-20T12:00:00Z");

/** Seed plus people whose names sort differently by bytes and by locale, odd minutes and rates, and invoices. */
async function scenario(): Promise<Context> {
  const context = await createTestContext();
  const client = context.db.$client;
  const passwordHash = "scrypt$not$used";
  const run = (sql: string, args: unknown[]) => client.execute({ sql, args: args as never });
  for (const [id, name, rate] of [
    ["usr_adam", "adam Smith", 6000],
    ["usr_emile", "Émile Zola", null],
    ["usr_zoe", "Zoë Quinn", 8333],
  ] as const) {
    await run("INSERT INTO users (id, org_id, email, name, password_hash, role, timezone, hourly_rate_cents, created_at) VALUES (?, 'org_acme', ?, ?, ?, 'member', 'UTC', ?, ?)", [id, `${id}@acme.test`, name, passwordHash, rate, NOW]);
  }
  const entries: [string, string, string, string | null, string, number, number][] = [
    ["te_g1", "usr_adam", "prj_web", "tsk_2", "2026-11-09T08:00:00Z", 7, 1],
    ["te_g2", "usr_adam", "prj_web", null, "2026-11-09T15:00:00Z", 13, 1],
    ["te_g3", "usr_emile", "prj_web", "tsk_3", "2026-11-10T10:00:00Z", 50, 0],
    ["te_g4", "usr_zoe", "prj_web", "tsk_2", "2026-11-11T09:00:00Z", 19, 1],
    ["te_g5", "usr_zoe", "prj_web", "tsk_2", "2026-11-11T13:00:00Z", 23, 1],
    ["te_g6", "usr_ada", "prj_web", "tsk_1", "2026-11-12T09:00:00Z", 7, 1],
    ["te_g7", "usr_emile", "prj_app", null, "2026-11-15T23:59:00Z", 1, 1],
    ["te_g8", "usr_bob", "prj_internal", null, "2026-11-16T00:01:00Z", 45, 1],
    ["te_g9", "usr_emile", "prj_web", "tsk_1", "2026-11-13T08:00:00Z", 7, 1],
    ["te_g10", "usr_ada", "prj_web", "tsk_1", "2026-11-13T09:00:00Z", 7, 1],
    ["te_g11", "usr_emile", "prj_web", null, "2026-11-14T10:00:00Z", 7, 1],
  ];
  for (const [id, userId, projectId, taskId, startedAt, minutes, billable] of entries) {
    await run("INSERT INTO time_entries (id, org_id, user_id, project_id, task_id, started_at, minutes, note, billable, created_at) VALUES (?, 'org_acme', ?, ?, ?, ?, ?, NULL, ?, ?)", [id, userId, projectId, taskId, Date.parse(startedAt), minutes, billable, NOW]);
  }
  await run("INSERT INTO projects (id, org_id, name, hourly_rate_cents, created_at) VALUES ('prj_empty', 'org_acme', 'Empty', 5000, ?)", [NOW]);
  const invoice = (id: string, number: string, status: string, issue: string, due: string, total: number) =>
    run("INSERT INTO invoices (id, org_id, client_id, number, client_name, status, issue_date, due_date, terms, repeat, currency, total_cents, created_at) VALUES (?, 'org_acme', 'cli_initech', ?, 'Initech', ?, ?, ?, 'net_30', 'none', 'USD', ?, ?)", [id, number, status, issue, due, total, NOW]);
  await invoice("inv_g1", "INV-2026-0101", "issued", "2026-10-01", "2026-10-31", 123456);
  await invoice("inv_g2", "INV-2026-0102", "paid", "2026-09-01", "2026-10-01", 10010);
  await invoice("inv_g3", "INV-2026-0103", "issued", "2026-11-18", "2026-12-18", 999);
  await invoice("inv_g4", "INV-2026-0104", "void", "2026-09-05", "2026-10-05", 5000);
  await run("INSERT INTO ledger_entries (id, org_id, invoice_id, kind, amount_cents, memo, created_at) VALUES ('led_g1', 'org_acme', 'inv_g2', 'payment', 10010, 'x', ?), ('led_g2', 'org_acme', 'inv_g1', 'payment', 3333, 'x', ?)", [NOW, NOW]);
  return context;
}

async function text(context: Context, path: string, token = admin) {
  const response = await context.request("GET", path, { token });
  return { status: response.status, contentType: response.headers.get("content-type"), body: await response.text() };
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__hidden__" ? [] : sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

const SRC = join(__dirname, "..");

describe("hidden G8: spec #340 retire the v1 reports module", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("R2: GET /api/v1/reports/timesheet is byte-compatible", async () => {
    const context = await scenario();
    for (const week of ["2026-11-09", "2026-11-11", "2026-11-16", "2026-10-26"]) check(`timesheet ${week}`, await text(context, `/api/v1/reports/timesheet?week=${week}`));
    check("timesheet globex", await text(context, "/api/v1/reports/timesheet?week=2026-11-10", SEED_TOKENS.globexAdmin));
  });

  it("R2: GET /api/v1/reports/projects/:id/summary is byte-compatible", async () => {
    const context = await scenario();
    for (const id of ["prj_web", "prj_app", "prj_internal", "prj_empty"]) check(`summary ${id}`, await text(context, `/api/v1/reports/projects/${id}/summary`));
  });

  it("R2: GET /api/v1/reports/invoices is byte-compatible", async () => {
    const context = await scenario();
    check("invoices acme", await text(context, "/api/v1/reports/invoices"));
    check("invoices globex", await text(context, "/api/v1/reports/invoices", SEED_TOKENS.globexAdmin));
  });

  it("R2: v1 error responses are byte-compatible", async () => {
    const context = await scenario();
    check("timesheet bad week", await text(context, "/api/v1/reports/timesheet?week=2026-13-01"));
    check("summary unknown", await text(context, "/api/v1/reports/projects/prj_nope/summary"));
    check("summary other org", await text(context, "/api/v1/reports/projects/prj_infra/summary"));
  });

  it("R3: the v2 report responses do not change", async () => {
    const context = await scenario();
    check("v2 timesheet", await text(context, "/api/reports/timesheet?week=2026-11-09"));
    check("v2 project", await text(context, "/api/reports/projects/prj_web"));
  });

  it("R4: the payroll export is byte-compatible", async () => {
    const context = await scenario();
    check("payroll", await text(context, "/api/exports/payroll.csv?week=2026-11-11"));
  });

  it("R4: the weekly digest sends the same notifications", async () => {
    const context = await scenario();
    await context.db.$client.execute({ sql: "DELETE FROM notifications", args: [] });
    await context.db.$client.execute({ sql: "INSERT INTO jobs (id, kind, payload, run_at, attempts, status, created_at) VALUES ('job_digest', 'digest.weekly', ?, ?, 0, 'queued', ?)", args: [JSON.stringify({ orgId: "org_acme", day: "2026-11-12" }), NOW, NOW] });
    await runDueJobs(context.db, new Date(NOW));
    const notifications = await context.db.$client.execute({ sql: "SELECT user_id, kind, payload FROM notifications ORDER BY user_id", args: [] });
    const emails = await context.db.$client.execute({ sql: "SELECT payload FROM jobs WHERE kind = 'notification.email' ORDER BY payload", args: [] });
    check("digest", { notifications: notifications.rows.map((row) => ({ ...row })), emails: emails.rows.map((row) => row.payload) });
  });

  it("R5: every v1 call still leaves the same audit trail", async () => {
    const context = await scenario();
    await text(context, "/api/v1/reports/timesheet?week=2026-11-11");
    await text(context, "/api/v1/reports/projects/prj_web/summary");
    await text(context, "/api/v1/reports/invoices");
    await text(context, "/api/v1/reports/projects/prj_nope/summary");
    const rows = await context.db.$client.execute({ sql: "SELECT org_id, actor_id, action, entity_type, entity_id, data FROM audit_log WHERE action LIKE 'report.%' ORDER BY created_at, rowid", args: [] });
    check("audit", rows.rows.map((row) => ({ ...row })));
  });

  it("R6: v1 responses announce their deprecation", async () => {
    const context = await scenario();
    for (const path of ["/api/v1/reports/timesheet?week=2026-11-11", "/api/v1/reports/projects/prj_web/summary", "/api/v1/reports/invoices"]) {
      const response = await context.request("GET", path, { token: admin });
      expect(response.headers.get("deprecation"), path).toBe("true");
    }
  });

  it("R1: the v1 controller and its SQL helpers are deleted", () => {
    expect(existsSync(join(SRC, "controllers", "reports-v1.controller.ts"))).toBe(false);
    expect(existsSync(join(SRC, "sql", "reports.sql.ts"))).toBe(false);
  });

  it("R1: nothing imports the deleted modules", () => {
    const offenders = sourceFiles(SRC).filter((file) => /reports-v1\.controller|sql\/reports\.sql/.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => relative(SRC, file))).toEqual([]);
  });
});
