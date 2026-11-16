import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { setMailTransport, type MailMessage } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

// Hidden acceptance tests for spec #204 (docs/issues/204-task-import.md).
// Seed: prj_app ("Mobile app") has tsk_4 "Push notifications"; prj_web has "Design homepage".
// Acme users: ada@acme.test (usr_ada), bob@acme.test (usr_bob). Globex: gina@globex.test.

afterEach(() => setMailTransport(async () => undefined));

type Context = Awaited<ReturnType<typeof createTestContext>>;
type Request = Context["request"];
type RowError = { field: string; code: string };
type ImportResult = { created: Array<{ row: number; id: string }>; failed: Array<{ row: number; errors: RowError[] }> };
type TaskJson = { id: string; title: string; description: string | null; status: string; isUrgent: boolean; assigneeId: string | null; dueDate: string | null };

const admin = { token: SEED_TOKENS.acmeAdmin };
const member = { token: SEED_TOKENS.acmeMember };
const globex = { token: SEED_TOKENS.globexAdmin };

async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function importInto(request: Request, body: unknown, projectId = "prj_app", as: { token: string } = member) {
  return request("POST", `/api/projects/${projectId}/tasks/import`, { ...as, body });
}

async function importOk(request: Request, body: unknown, projectId = "prj_app") {
  const response = await importInto(request, body, projectId);
  expect(response.status).toBe(200);
  return json<ImportResult>(response);
}

async function projectTasks(request: Request, projectId = "prj_app") {
  return (await json<{ items: TaskJson[] }>(await request("GET", `/api/projects/${projectId}/tasks`, member))).items;
}

async function taskCount(db: Context["db"]) {
  return (await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM tasks`))[0]?.n;
}

async function rowErrors(request: Request, row: Record<string, unknown>) {
  const result = await importOk(request, { rows: [row] });
  expect(result.created).toEqual([]);
  return result.failed[0]?.errors.map((error) => error.code);
}

describe("spec #204: bulk task import", () => {
  it("R5/R7: JSON rows are created with their fields, and ids are reported by row", async () => {
    const { request } = await createTestContext();
    const result = await importOk(request, {
      rows: [
        { title: "  Write copy ", description: "Hero and footer", assigneeEmail: "bob@acme.test", dueDate: "2026-12-01", isUrgent: true },
        { title: "Book venue", status: "in_progress" },
      ],
    });
    expect(result.failed).toEqual([]);
    expect(result.created.map((item) => item.row)).toEqual([1, 2]);
    const byId = new Map((await projectTasks(request)).map((task) => [task.id, task]));
    expect(byId.get(result.created[0]!.id)).toMatchObject({
      title: "Write copy",
      description: "Hero and footer",
      status: "todo",
      isUrgent: true,
      assigneeId: "usr_bob",
      dueDate: "2026-12-01",
    });
    expect(byId.get(result.created[1]!.id)).toMatchObject({ title: "Book venue", status: "in_progress", isUrgent: false, assigneeId: null, description: null, dueDate: null });
  });

  it("R7: imported tasks come after the existing ones, in row order, in the caller's organization", async () => {
    const { request, db } = await createTestContext();
    const titles = ["Zulu", "Alpha", "Mike", "Bravo", "Yankee"];
    const result = await importOk(request, { rows: titles.map((title) => ({ title })) });
    expect((await projectTasks(request)).map((task) => task.title)).toEqual(["Push notifications", ...titles]);
    const orgs = await db.all<{ org_id: string }>(sql`SELECT DISTINCT org_id FROM tasks WHERE project_id = 'prj_app'`);
    expect(orgs).toEqual([{ org_id: "org_acme" }]);
    expect(result.created).toHaveLength(5);
  });

  it("R1: another organization's or an unknown project is 404 project_not_found", async () => {
    const { request, db } = await createTestContext();
    for (const response of [await importInto(request, { rows: [{ title: "x" }] }, "prj_app", globex), await importInto(request, { rows: [{ title: "x" }] }, "prj_nope")]) {
      expect(response.status).toBe(404);
      expect(await json(response)).toMatchObject({ code: "project_not_found" });
    }
    expect(await taskCount(db)).toBe(6);
  });

  it("R2: rows and csv together, or neither, is 422 invalid_import; an unknown mode is 422", async () => {
    const { request } = await createTestContext();
    for (const body of [{ rows: [{ title: "x" }], csv: "title\ny" }, { mode: "partial" }]) {
      const response = await importInto(request, body);
      expect(response.status).toBe(422);
      expect(await json(response)).toMatchObject({ code: "invalid_import" });
    }
    expect((await importInto(request, { mode: "best-effort", rows: [{ title: "x" }] })).status).toBe(422);
  });

  it("R3: no rows is 422 no_rows, for JSON and for a CSV header alone", async () => {
    const { request } = await createTestContext();
    for (const body of [{ rows: [] }, { csv: "title,status\n" }]) {
      const response = await importInto(request, body);
      expect(response.status).toBe(422);
      expect(await json(response)).toMatchObject({ code: "no_rows" });
    }
  });

  it("R3: 201 rows is 413 too_many_rows and creates nothing; 200 rows is fine", async () => {
    const { request, db } = await createTestContext();
    const rows = (count: number) => Array.from({ length: count }, (_, index) => ({ title: `Task ${index}` }));
    const tooMany = await importInto(request, { rows: rows(201) });
    expect(tooMany.status).toBe(413);
    expect(await json(tooMany)).toMatchObject({ code: "too_many_rows" });
    expect(await taskCount(db)).toBe(6);
    expect((await importOk(request, { rows: rows(200) })).created).toHaveLength(200);
  });

  it("R4: title is required, trimmed and at most 200 characters", async () => {
    const { request } = await createTestContext();
    expect(await rowErrors(request, { title: "   " })).toEqual(["title_required"]);
    expect(await rowErrors(request, { description: "no title" })).toEqual(["title_required"]);
    expect(await rowErrors(request, { title: 42 })).toEqual(["title_required"]);
    expect(await rowErrors(request, { title: "x".repeat(201) })).toEqual(["title_too_long"]);
    expect((await importOk(request, { rows: [{ title: ` ${"y".repeat(200)} ` }] })).created).toHaveLength(1);
  });

  it("R4: description longer than 5000 characters is refused", async () => {
    const { request } = await createTestContext();
    expect(await rowErrors(request, { title: "Long", description: "d".repeat(5001) })).toEqual(["description_too_long"]);
  });

  it("R4: status must be todo, in_progress or done", async () => {
    const { request } = await createTestContext();
    expect(await rowErrors(request, { title: "Later", status: "later" })).toEqual(["invalid_status"]);
  });

  it("R4: isUrgent must be a boolean", async () => {
    const { request } = await createTestContext();
    expect(await rowErrors(request, { title: "Soon", isUrgent: "yes" })).toEqual(["invalid_is_urgent"]);
  });

  it("R4: assigneeEmail matches the caller's organization, trimmed and case-insensitive", async () => {
    const { request } = await createTestContext();
    const result = await importOk(request, { rows: [{ title: "Mine", assigneeEmail: "  BOB@Acme.Test " }] });
    expect((await projectTasks(request)).find((task) => task.id === result.created[0]?.id)?.assigneeId).toBe("usr_bob");
    expect(await rowErrors(request, { title: "Theirs", assigneeEmail: "gina@globex.test" })).toEqual(["unknown_assignee"]);
    expect(await rowErrors(request, { title: "Nobody", assigneeEmail: "nobody@acme.test" })).toEqual(["unknown_assignee"]);
  });

  it("R4: dueDate must be a real YYYY-MM-DD date", async () => {
    const { request } = await createTestContext();
    for (const dueDate of ["2026-02-30", "2026-2-3", "next week", "2026-13-01"]) {
      expect(await rowErrors(request, { title: `Due ${dueDate}`, dueDate })).toEqual(["invalid_due_date"]);
    }
    expect((await importOk(request, { rows: [{ title: "Leap", dueDate: "2028-02-29" }] })).created).toHaveLength(1);
  });

  it("R4: a done row needs an assignee", async () => {
    const { request } = await createTestContext();
    expect(await rowErrors(request, { title: "Finished", status: "done" })).toEqual(["assignee_required_for_done"]);
    const result = await importOk(request, { rows: [{ title: "Finished", status: "done", assigneeEmail: "ada@acme.test" }] });
    expect((await projectTasks(request)).find((task) => task.id === result.created[0]?.id)?.status).toBe("done");
  });

  it("R4: titles duplicating an existing task or an earlier row are refused, ignoring case and spaces", async () => {
    const { request } = await createTestContext();
    const result = await importOk(request, { rows: [{ title: " push NOTIFICATIONS" }, { title: "Ship it" }, { title: "ship IT " }, { title: "Design homepage" }] });
    expect(result.created.map((item) => item.row)).toEqual([2, 4]);
    expect(result.failed).toEqual([
      { row: 1, errors: [{ field: "title", code: "duplicate_title" }] },
      { row: 3, errors: [{ field: "title", code: "duplicate_title" }] },
    ]);
  });

  it("R4: every problem in a row is reported with its field, in the spec's order", async () => {
    const { request } = await createTestContext();
    const result = await importOk(request, { rows: [{ title: "", status: "later", isUrgent: 1, assigneeEmail: "who@acme.test", dueDate: "2026-02-30" }] });
    expect(result.failed).toEqual([
      {
        row: 1,
        errors: [
          { field: "title", code: "title_required" },
          { field: "status", code: "invalid_status" },
          { field: "isUrgent", code: "invalid_is_urgent" },
          { field: "assigneeEmail", code: "unknown_assignee" },
          { field: "dueDate", code: "invalid_due_date" },
        ],
      },
    ]);
  });

  it("R5: partial mode creates the valid rows and reports the rest, with 200 even when all fail", async () => {
    const { request, db } = await createTestContext();
    const mixed = await importOk(request, { rows: [{ title: "Good one" }, { title: "" }, { title: "Good two" }, { title: "Bad", status: "nope" }] });
    expect(mixed.created.map((item) => item.row)).toEqual([1, 3]);
    expect(mixed.failed.map((item) => item.row)).toEqual([2, 4]);
    expect(await taskCount(db)).toBe(8);
    const none = await importOk(request, { mode: "partial", rows: [{ title: "" }] });
    expect(none).toEqual({ created: [], failed: [{ row: 1, errors: [{ field: "title", code: "title_required" }] }] });
  });

  it("R6: atomic mode with a bad row is 422 import_failed and creates nothing", async () => {
    const { request, db } = await createTestContext();
    const response = await importInto(request, { mode: "atomic", rows: [{ title: "Good one" }, { title: "Bad", dueDate: "soon" }, { title: "Good two" }] });
    expect(response.status).toBe(422);
    expect(await json(response)).toMatchObject({
      code: "import_failed",
      created: [],
      failed: [{ row: 2, errors: [{ field: "dueDate", code: "invalid_due_date" }] }],
    });
    expect(await taskCount(db)).toBe(6);
  });

  it("R6: atomic mode with only good rows imports them all", async () => {
    const { request } = await createTestContext();
    const result = await importOk(request, { mode: "atomic", rows: [{ title: "One" }, { title: "Two" }] });
    expect(result.created.map((item) => item.row)).toEqual([1, 2]);
    expect(result.failed).toEqual([]);
  });

  it("R8: CSV columns in any order, empty cells as missing, isUrgent in any case", async () => {
    const { request } = await createTestContext();
    const csv = "isUrgent,title,assigneeEmail,dueDate,status\nTRUE,Write copy,bob@acme.test,2026-12-01,\n,Book venue,,,in_progress\nFalse,Order badges,,,\n";
    const result = await importOk(request, { csv });
    expect(result.failed).toEqual([]);
    const tasks = (await projectTasks(request)).slice(1);
    expect(tasks.map((task) => [task.title, task.isUrgent, task.assigneeId, task.dueDate, task.status])).toEqual([
      ["Write copy", true, "usr_bob", "2026-12-01", "todo"],
      ["Book venue", false, null, null, "in_progress"],
      ["Order badges", false, null, null, "todo"],
    ]);
  });

  it("R8: quoted CSV fields keep commas, doubled quotes and line breaks; CRLF works", async () => {
    const { request } = await createTestContext();
    const csv = 'title,description\r\n"Draft the ""launch"" post, v2","Line one\r\nLine two"\r\nPlain,"a,b"\r\n';
    const result = await importOk(request, { csv });
    expect(result.created).toHaveLength(2);
    const tasks = (await projectTasks(request)).slice(1);
    expect(tasks.map((task) => [task.title, task.description])).toEqual([
      ['Draft the "launch" post, v2', "Line one\r\nLine two"],
      ["Plain", "a,b"],
    ]);
  });

  it("R8: blank CSV lines are skipped and do not take a row number", async () => {
    const { request } = await createTestContext();
    const result = await importOk(request, { csv: "title,status\n\nFirst,\n\n\nSecond,later\nThird,\n" });
    expect(result.created.map((item) => item.row)).toEqual([1, 3]);
    expect(result.failed).toEqual([{ row: 2, errors: [{ field: "status", code: "invalid_status" }] }]);
  });

  it("R8: CSV row values are validated like JSON rows", async () => {
    const { request } = await createTestContext();
    const result = await importOk(request, { csv: "title,isUrgent,dueDate\nA,yes,\n,true,\nC,,2026-02-30" });
    expect(result.failed).toEqual([
      { row: 1, errors: [{ field: "isUrgent", code: "invalid_is_urgent" }] },
      { row: 2, errors: [{ field: "title", code: "title_required" }] },
      { row: 3, errors: [{ field: "dueDate", code: "invalid_due_date" }] },
    ]);
  });

  it("R8: a CSV header without title or with an unknown column is refused", async () => {
    const { request, db } = await createTestContext();
    const noTitle = await importInto(request, { csv: "description\nhello\n" });
    expect(noTitle.status).toBe(422);
    expect(await json(noTitle)).toMatchObject({ code: "missing_title_column" });
    const unknown = await importInto(request, { csv: "title,priority\nhello,high\n" });
    expect(unknown.status).toBe(422);
    expect(await json(unknown)).toMatchObject({ code: "unknown_column", column: "priority" });
    expect(await taskCount(db)).toBe(6);
  });

  it("R9: each assignee gets one email with their count", async () => {
    const sent: MailMessage[] = [];
    setMailTransport(async (message) => {
      sent.push(message);
    });
    const { request } = await createTestContext();
    await importOk(request, {
      rows: [
        { title: "B1", assigneeEmail: "bob@acme.test" },
        { title: "A1", assigneeEmail: "ada@acme.test" },
        { title: "B2", assigneeEmail: "BOB@acme.test" },
        { title: "Nobody" },
        { title: "B3", assigneeEmail: "bob@acme.test" },
      ],
    });
    expect(sent).toHaveLength(2);
    const byRecipient = Object.fromEntries(sent.map((message) => [message.to, message.subject]));
    expect(byRecipient).toEqual({
      "bob@acme.test": "3 imported task(s) assigned to you in Mobile app",
      "ada@acme.test": "1 imported task(s) assigned to you in Mobile app",
    });
  });

  it("R9: failed rows do not count and a failed atomic import sends nothing", async () => {
    const sent: MailMessage[] = [];
    setMailTransport(async (message) => {
      sent.push(message);
    });
    const { request } = await createTestContext();
    const rows = [
      { title: "B1", assigneeEmail: "bob@acme.test" },
      { title: "B2", assigneeEmail: "bob@acme.test", dueDate: "soon" },
    ];
    expect((await importInto(request, { mode: "atomic", rows })).status).toBe(422);
    expect(sent).toEqual([]);
    await importOk(request, { rows });
    expect(sent.map((message) => message.subject)).toEqual(["1 imported task(s) assigned to you in Mobile app"]);
  });
});
