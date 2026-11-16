import { performance } from "node:perf_hooks";

import { beforeAll, describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;
type Row = Record<string, unknown>;
const admin = SEED_TOKENS.acmeAdmin;

// ---------------------------------------------------------------------------------------------
// Query counting through the driver: every statement libSQL executes (single or batched).
// ---------------------------------------------------------------------------------------------
function countStatements(context: Context) {
  const client = context.db.$client as unknown as Record<string, (...args: unknown[]) => unknown>;
  const counter = { statements: 0 };
  for (const method of ["execute", "batch", "executeMultiple", "migrate"]) {
    const original = client[method];
    if (typeof original !== "function") continue;
    client[method] = function (this: unknown, ...args: unknown[]) {
      counter.statements += Array.isArray(args[0]) ? args[0].length : 1;
      return original.apply(client, args);
    };
  }
  const transaction = client.transaction;
  if (typeof transaction === "function") {
    client.transaction = async function (...args: unknown[]) {
      const tx = (await transaction.apply(client, args)) as Record<string, (...a: unknown[]) => unknown>;
      for (const method of ["execute", "batch"]) {
        const original = tx[method]!;
        tx[method] = (...a: unknown[]) => {
          counter.statements += Array.isArray(a[0]) ? a[0].length : 1;
          return original.apply(tx, a);
        };
      }
      return tx;
    };
  }
  return counter;
}

// ---------------------------------------------------------------------------------------------
// The report as the current implementation defines it, computed straight from the database.
// ---------------------------------------------------------------------------------------------
const byName = (a: string, b: string) => a.localeCompare(b);

async function rows(context: Context, sql: string, args: unknown[] = []) {
  const result = await (context.db.$client as unknown as { execute: (s: { sql: string; args: unknown[] }) => Promise<{ rows: Row[] }> }).execute({ sql, args });
  return result.rows.map((row) => ({ ...row }));
}

async function expectedReport(context: Context, orgId: string, projectId: string) {
  const [project] = await rows(context, "SELECT * FROM projects WHERE id = ? AND org_id = ?", [projectId, orgId]);
  if (!project) return null;
  const users = new Map((await rows(context, "SELECT id, name, hourly_rate_cents FROM users")).map((user) => [user.id as string, user]));
  const entries = await rows(context, "SELECT * FROM time_entries ORDER BY rowid");
  const tasks = await rows(context, "SELECT * FROM tasks WHERE project_id = ? ORDER BY rowid", [projectId]);
  const labelRows = await rows(context, "SELECT tl.task_id, l.name FROM task_labels tl JOIN labels l ON l.id = tl.label_id");
  const people = new Map<string, { userId: string; name: string; minutes: number; amountCents: number }>();
  const totals = { minutes: 0, billableMinutes: 0, amountCents: 0, entries: 0 };
  const tally = (list: Row[]) => {
    const line = { minutes: 0, billableMinutes: 0, amountCents: 0 };
    let last: number | null = null;
    for (const entry of list) {
      const user = users.get(entry.user_id as string);
      const rate = (user?.hourly_rate_cents as number | null) ?? (project.hourly_rate_cents as number);
      const minutes = entry.minutes as number;
      const amount = entry.billable ? Math.round((minutes * rate) / 60) : 0;
      line.minutes += minutes;
      if (entry.billable) line.billableMinutes += minutes;
      line.amountCents += amount;
      const startedAt = entry.started_at as number;
      if (last === null || startedAt > last) last = startedAt;
      const person = people.get(entry.user_id as string) ?? { userId: entry.user_id as string, name: (user?.name as string) ?? "Unknown", minutes: 0, amountCents: 0 };
      person.minutes += minutes;
      person.amountCents += amount;
      people.set(entry.user_id as string, person);
    }
    totals.minutes += line.minutes;
    totals.billableMinutes += line.billableMinutes;
    totals.amountCents += line.amountCents;
    totals.entries += list.length;
    return { ...line, lastLoggedAt: last === null ? null : new Date(last).toISOString() };
  };
  const taskReports = tasks.map((task) => ({
    id: task.id as string,
    title: task.title as string,
    status: task.status,
    labels: labelRows.filter((row) => row.task_id === task.id).map((row) => row.name as string).sort(byName),
    ...tally(entries.filter((entry) => entry.task_id === task.id)),
  }));
  taskReports.sort((a, b) => byName(a.title, b.title) || (a.id < b.id ? -1 : 1));
  const unassigned = tally(entries.filter((entry) => entry.project_id === projectId && entry.task_id === null));
  return {
    project: { id: project.id, name: project.name, hourlyRateCents: project.hourly_rate_cents },
    totals,
    tasks: taskReports,
    unassignedMinutes: unassigned.minutes,
    people: [...people.values()].sort((a, b) => b.minutes - a.minutes || byName(a.name, b.name)),
  };
}

// ---------------------------------------------------------------------------------------------
// Data: a deterministic big customer. Titles, names and labels mix case and accents on purpose.
// ---------------------------------------------------------------------------------------------
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = ["api", "Billing", "écran", "Zebra", "zebra", "Ångström", "login", "Login", "ömega", "Report", "export", "Émail", "cache", "Cache", "alpha", "Beta"];
const NAMES = ["émile Zola", "Zoë Quinn", "adam Smith", "Åsa Berg", "Ömer Kaya", "bea Arthur", "Carl Sagan", "Ünal Demir", "zara Ali", "Lena Fox"];
const LABELS = ["urgent", "Backend", "Frontend", "Écosystème", "zeta", "Alpha", "beta", "UX"];

async function insertMany(context: Context, table: string, columns: string[], values: unknown[][]) {
  const client = context.db.$client as unknown as { batch: (stmts: { sql: string; args: unknown[] }[], mode: string) => Promise<unknown> };
  const statements = [];
  for (let start = 0; start < values.length; start += 400) {
    const chunk = values.slice(start, start + 400);
    statements.push({
      sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${chunk.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ")}`,
      args: chunk.flat(),
    });
  }
  for (let start = 0; start < statements.length; start += 50) await client.batch(statements.slice(start, start + 50), "write");
}

async function seedBigCustomer(context: Context, { bigTasks, bigEntries, fillerTasks, fillerEntries }: { bigTasks: number; bigEntries: number; fillerTasks: number; fillerEntries: number }) {
  const next = random(42);
  const pick = <T>(list: T[]) => list[Math.floor(next() * list.length)]!;
  const now = Date.parse("2026-11-01T00:00:00Z");
  const userIds = NAMES.map((_, index) => `usr_big_${index}`);
  await insertMany(context, "users", ["id", "org_id", "email", "name", "password_hash", "role", "timezone", "hourly_rate_cents", "created_at"],
    NAMES.map((name, index) => [userIds[index], "org_acme", `big${index}@acme.test`, name, "x", "member", "UTC", index % 3 === 0 ? null : 5000 + index * 1111, now]));
  const labelIds = LABELS.map((_, index) => `lbl_big_${index}`);
  await insertMany(context, "labels", ["id", "org_id", "name", "color", "created_at"], LABELS.map((name, index) => [labelIds[index], "org_acme", name, "#123456", now]));
  const projectIds = ["prj_big", ...Array.from({ length: 9 }, (_, index) => `prj_filler_${index}`)];
  await insertMany(context, "projects", ["id", "org_id", "name", "hourly_rate_cents", "created_at"], projectIds.map((id, index) => [id, "org_acme", `Big ${index}`, 9999 + index, now]));
  const statuses = ["todo", "in_progress", "done"];
  const task = (id: string, projectId: string, index: number) => [id, "org_acme", projectId, `${pick(WORDS)} ${pick(WORDS)} ${index % 7}`, pick(statuses), "none", now + index, now + index];
  const bigTaskIds = Array.from({ length: bigTasks }, (_, index) => `tsk_big_${index}`);
  const taskColumns = ["id", "org_id", "project_id", "title", "status", "repeat", "created_at", "updated_at"];
  await insertMany(context, "tasks", taskColumns, bigTaskIds.map((id, index) => task(id, "prj_big", index)));
  await insertMany(context, "tasks", taskColumns, Array.from({ length: fillerTasks }, (_, index) => task(`tsk_fill_${index}`, projectIds[1 + (index % 9)]!, index)));
  const taskLabels: unknown[][] = [];
  for (const id of bigTaskIds) {
    if (next() < 0.4) for (const labelId of new Set([pick(labelIds), pick(labelIds)])) taskLabels.push([id, labelId]);
  }
  await insertMany(context, "task_labels", ["task_id", "label_id"], taskLabels);
  const entryColumns = ["id", "org_id", "user_id", "project_id", "task_id", "started_at", "minutes", "note", "billable", "created_at"];
  const entry = (id: string, projectId: string, taskId: string | null) => [id, "org_acme", pick(userIds), projectId, taskId, now - Math.floor(next() * 90 * 86_400_000), 1 + Math.floor(next() * 300), null, next() < 0.8 ? 1 : 0, now];
  await insertMany(context, "time_entries", entryColumns, Array.from({ length: bigEntries }, (_, index) => entry(`te_big_${index}`, "prj_big", index % 20 === 0 ? null : pick(bigTaskIds))));
  await insertMany(context, "time_entries", entryColumns, Array.from({ length: fillerEntries }, (_, index) => entry(`te_fill_${index}`, projectIds[1 + (index % 9)]!, `tsk_fill_${(index % 9) + 9 * Math.floor(next() * Math.floor(fillerTasks / 9))}`)));
}

async function report(context: Context, projectId: string, token = admin) {
  const response = await context.request("GET", `/api/reports/projects/${projectId}`, { token });
  return { status: response.status, body: (await response.json()) as unknown };
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

// ---------------------------------------------------------------------------------------------
describe("hidden G5: project report on a big customer", { timeout: 60_000 }, () => {
  let big: Context;
  let counter: { statements: number };

  beforeAll(async () => {
    big = await createTestContext();
    await seedBigCustomer(big, { bigTasks: 1500, bigEntries: 6000, fillerTasks: 48_500, fillerEntries: 30_000 });
    counter = countStatements(big);
  }, 120_000);

  it("keeps the output of the seeded projects", async () => {
    const context = await createTestContext();
    for (const projectId of ["prj_web", "prj_app", "prj_internal"]) {
      const { status, body } = await report(context, projectId);
      expect(status).toBe(200);
      expect(body, projectId).toEqual(await expectedReport(context, "org_acme", projectId));
    }
  });

  it("keeps the output on tricky data: accents, case, ties, rates, rounding, empty tasks", async () => {
    const context = await createTestContext();
    await seedBigCustomer(context, { bigTasks: 60, bigEntries: 400, fillerTasks: 10, fillerEntries: 20 });
    const { body } = await report(context, "prj_big");
    expect(body).toEqual(await expectedReport(context, "org_acme", "prj_big"));
    const empty = await report(context, "prj_filler_3");
    expect(empty.body).toEqual(await expectedReport(context, "org_acme", "prj_filler_3"));
  });

  it("keeps the output on the big project", async () => {
    const { status, body } = await report(big, "prj_big");
    expect(status).toBe(200);
    expect(body).toEqual(await expectedReport(big, "org_acme", "prj_big"));
  });

  it("runs at most 10 queries on a project with 1,500 tasks and 6,000 entries", async () => {
    counter.statements = 0;
    expect((await report(big, "prj_big")).status).toBe(200);
    expect(counter.statements).toBeLessThanOrEqual(10);
  });

  it("runs the same number of queries whatever the size of the project", async () => {
    counter.statements = 0;
    await report(big, "prj_filler_0");
    const filler = counter.statements;
    counter.statements = 0;
    await report(big, "prj_big");
    const large = counter.statements;
    counter.statements = 0;
    await report(big, "prj_filler_8");
    expect([filler, counter.statements]).toEqual([large, large]);
  });

  it("answers well under a second, measured against a plain scan of the same data", async () => {
    // Baseline: read the project's entries and tasks once, in this process, on this machine.
    const client = big.db.$client as unknown as { execute: (sql: string) => Promise<unknown> };
    const baseline: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      await client.execute("SELECT * FROM time_entries WHERE project_id = 'prj_big'");
      await client.execute("SELECT * FROM tasks WHERE project_id = 'prj_big'");
      baseline.push(performance.now() - started);
    }
    await report(big, "prj_big");
    const timings: number[] = [];
    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      expect((await report(big, "prj_big")).status).toBe(200);
      timings.push(performance.now() - started);
    }
    const budget = Math.max(15 * median(baseline), 250);
    expect(median(timings), `median ${median(timings).toFixed(0)} ms, baseline ${median(baseline).toFixed(1)} ms, budget ${budget.toFixed(0)} ms`).toBeLessThan(budget);
  });

  it("still hides other organizations' projects", async () => {
    expect((await report(big, "prj_infra")).status).toBe(404);
    expect((await report(big, "prj_big", SEED_TOKENS.globexAdmin)).status).toBe(404);
  });
});
