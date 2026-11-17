import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

// K3: POST /api/projects/:id/tasks/import with { csv }. Header title,assignee_email,due_date;
// valid rows are imported, invalid rows reported as { line (1-based, header is line 1), message };
// blank lines ignored; a wrong header is 400 { code: "invalid_csv" }.
const HEADER = "title,assignee_email,due_date";

type ImportResult = { created: number; errors: Array<{ line: number; message: string }> };

async function importCsv(csv: string, project = "prj_app", token: string = SEED_TOKENS.acmeAdmin) {
  const context = await createTestContext();
  const response = await context.request("POST", `/api/projects/${project}/tasks/import`, {
    token,
    body: { csv },
  });
  return { ...context, response };
}

async function titles(context: Awaited<ReturnType<typeof importCsv>>) {
  const listed = await context.request("GET", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin });
  const body = (await listed.json()) as {
    items: Array<{ title: string; assigneeId: string | null; dueDate: string | null; status: string }>;
  };
  return body.items;
}

describe("hidden: task CSV import", () => {
  it("imports valid rows with assignee and due date", async () => {
    const context = await importCsv(`${HEADER}\nWrite docs,bob@acme.test,2026-12-24\nShip it,,\n`);
    expect(context.response.status).toBe(200);
    expect(await context.response.json()).toEqual({ created: 2, errors: [] });
    const items = await titles(context);
    expect(items.map((task) => task.title).sort()).toEqual(["Push notifications", "Ship it", "Write docs"]);
    expect(items.find((task) => task.title === "Write docs")).toMatchObject({
      assigneeId: "usr_bob",
      dueDate: "2026-12-24",
      status: "todo",
    });
    expect(items.find((task) => task.title === "Ship it")).toMatchObject({ assigneeId: null, dueDate: null });
  });

  it("skips invalid rows, reports their 1-based line numbers and imports the rest", async () => {
    const csv = [
      HEADER,
      "Good one,,",
      "Too few columns,bob@acme.test",
      "Too,many,columns,here",
      ",bob@acme.test,",
      "Stranger,nobody@acme.test,",
      "Other org,gina@globex.test,",
      "Bad date,,next week",
      "Short date,,2026-1-5",
      "No month 13,,2026-13-01",
      "Good two,ada@acme.test,2027-01-31",
    ].join("\n");
    const context = await importCsv(csv);
    expect(context.response.status).toBe(200);
    const body = (await context.response.json()) as ImportResult;
    expect(body.created).toBe(2);
    expect(body.errors.map((error) => error.line).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    for (const error of body.errors) expect(error.message).toEqual(expect.any(String));
    const items = await titles(context);
    expect(items.map((task) => task.title).sort()).toEqual(["Good one", "Good two", "Push notifications"]);
  });

  it("ignores blank lines but keeps counting them for line numbers", async () => {
    const context = await importCsv(`${HEADER}\n\nFirst,,\n\n,,\nSecond,,\n\n`);
    const body = (await context.response.json()) as ImportResult;
    expect(body).toEqual({ created: 2, errors: [{ line: 5, message: expect.any(String) }] });
  });

  it("accepts a header-only file", async () => {
    const context = await importCsv(`${HEADER}\n`);
    expect(await context.response.json()).toEqual({ created: 0, errors: [] });
  });

  it.each(["", "title,assignee,due\nA,,", "Write docs,bob@acme.test,2026-12-24"])(
    "rejects a missing or wrong header (%j)",
    async (csv) => {
      const context = await importCsv(csv);
      expect(context.response.status).toBe(400);
      expect(await context.response.json()).toMatchObject({ code: "invalid_csv", message: expect.any(String) });
      expect((await titles(context)).map((task) => task.title)).toEqual(["Push notifications"]);
    },
  );

  it("keeps tenant scoping and auth", async () => {
    const other = await importCsv(`${HEADER}\nX,,\n`, "prj_app", SEED_TOKENS.globexAdmin);
    expect(other.response.status).toBe(404);
    const anonymous = await other.request("POST", "/api/projects/prj_app/tasks/import", { body: { csv: HEADER } });
    expect(anonymous.status).toBe(401);
  });
});
