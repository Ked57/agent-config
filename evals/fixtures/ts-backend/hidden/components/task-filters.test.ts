import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

// K2: GET /api/projects/:id/tasks filters (status repeatable, assignee id or "none", dueBefore
// YYYY-MM-DD strictly before, urgent true/false), combined with AND; invalid values and unknown
// parameters get 400 { code: "invalid_query", message }.
async function ids(project: string, query: string) {
  const { request } = await createTestContext();
  const response = await request("GET", `/api/projects/${project}/tasks?${query}`, {
    token: SEED_TOKENS.acmeAdmin,
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { items: Array<{ id: string }> };
  return body.items.map((task) => task.id);
}

describe("hidden: task filters", () => {
  it("returns every task without filters", async () => {
    expect(await ids("prj_web", "")).toEqual(["tsk_1", "tsk_2", "tsk_3"]);
  });

  it("filters by one or several statuses", async () => {
    expect(await ids("prj_web", "status=todo")).toEqual(["tsk_3"]);
    expect(await ids("prj_web", "status=todo&status=done")).toEqual(["tsk_1", "tsk_3"]);
  });

  it("filters by assignee, including unassigned", async () => {
    expect(await ids("prj_web", "assignee=usr_bob")).toEqual(["tsk_2"]);
    expect(await ids("prj_web", "assignee=none")).toEqual(["tsk_1"]);
  });

  it("filters by urgency", async () => {
    expect(await ids("prj_web", "urgent=true")).toEqual(["tsk_3"]);
    expect(await ids("prj_web", "urgent=false")).toEqual(["tsk_1", "tsk_2"]);
  });

  it("filters by due date, strictly before", async () => {
    expect(await ids("prj_app", "dueBefore=2026-12-02")).toEqual(["tsk_4"]);
    expect(await ids("prj_app", "dueBefore=2026-12-01")).toEqual([]);
  });

  it("combines filters with AND", async () => {
    expect(await ids("prj_web", "status=todo&urgent=true")).toEqual(["tsk_3"]);
    expect(await ids("prj_web", "status=done&assignee=none")).toEqual(["tsk_1"]);
    expect(await ids("prj_web", "status=in_progress&assignee=usr_ada")).toEqual([]);
  });

  it.each([
    "status=DONE",
    "status=archived",
    "status=",
    "status=todo&status=nope",
    "dueBefore=2026-13-01",
    "dueBefore=tomorrow",
    "dueBefore=2026-1-5",
    "urgent=yes",
    "urgent=1",
    "urgent=",
    "sort=createdAt",
    "status=todo&page=2",
  ])("rejects %s with 400 invalid_query", async (query) => {
    const { request } = await createTestContext();
    const response = await request("GET", `/api/projects/prj_web/tasks?${query}`, {
      token: SEED_TOKENS.acmeAdmin,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_query", message: expect.any(String) });
  });

  it("keeps tenant scoping and auth", async () => {
    const { request } = await createTestContext();
    const other = await request("GET", "/api/projects/prj_web/tasks?status=todo", {
      token: SEED_TOKENS.globexAdmin,
    });
    expect(other.status).toBe(404);
    expect((await request("GET", "/api/projects/prj_web/tasks?status=todo")).status).toBe(401);
  });
});
