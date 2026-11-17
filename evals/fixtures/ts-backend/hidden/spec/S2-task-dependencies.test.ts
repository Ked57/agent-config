import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { setMailTransport } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

// Hidden acceptance tests for spec #202 (docs/issues/202-task-dependencies.md).
// Seed: prj_web has tsk_1 (done), tsk_2 (in_progress, bob), tsk_3 (todo, ada), created in that
// order; prj_app has tsk_4. Globex owns tsk_6.

afterEach(() => setMailTransport(async () => undefined));

type Context = Awaited<ReturnType<typeof createTestContext>>;
type Request = Context["request"];
type TaskJson = { id: string; status: string; title: string; blocked: boolean };
type Summary = { id: string; title: string; status: string };

const admin = { token: SEED_TOKENS.acmeAdmin };
const member = { token: SEED_TOKENS.acmeMember };
const globex = { token: SEED_TOKENS.globexAdmin };

async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function link(request: Request, taskId: string, dependsOnId: string, as: { token: string } = member) {
  return request("POST", `/api/tasks/${taskId}/dependencies`, { ...as, body: { dependsOnId } });
}

async function newTask(request: Request, title: string, projectId = "prj_web") {
  const response = await request("POST", `/api/projects/${projectId}/tasks`, { ...admin, body: { title, assigneeId: "usr_ada" } });
  expect(response.status).toBe(201);
  return (await json<TaskJson>(response)).id;
}

async function getTask(request: Request, id: string) {
  return json<TaskJson>(await request("GET", `/api/tasks/${id}`, member));
}

async function deps(request: Request, id: string) {
  const response = await request("GET", `/api/tasks/${id}/dependencies`, member);
  expect(response.status).toBe(200);
  return json<{ blockedBy: Summary[]; blocking: Summary[] }>(response);
}

describe("spec #202: task dependencies", () => {
  it("R1: linking two tasks returns 201 with taskId, dependsOnId and createdAt", async () => {
    const { request } = await createTestContext();
    const response = await link(request, "tsk_3", "tsk_2");
    expect(response.status).toBe(201);
    const body = await json<{ taskId: string; dependsOnId: string; createdAt: string }>(response);
    expect(body).toMatchObject({ taskId: "tsk_3", dependsOnId: "tsk_2" });
    expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);
  });

  it("Data: the link is stored in task_dependencies with its creator", async () => {
    const { request, db } = await createTestContext();
    expect((await link(request, "tsk_3", "tsk_2")).status).toBe(201);
    const rows = await db.all<{ task_id: string; depends_on_id: string; created_by: string }>(
      sql`SELECT task_id, depends_on_id, created_by FROM task_dependencies`,
    );
    expect(rows).toEqual([expect.objectContaining({ task_id: "tsk_3", depends_on_id: "tsk_2", created_by: "usr_bob" })]);
  });

  it("R1: a body without dependsOnId is a 422 validation error", async () => {
    const { request } = await createTestContext();
    expect((await request("POST", "/api/tasks/tsk_3/dependencies", { ...member, body: {} })).status).toBe(422);
  });

  it("R2: unknown or foreign tasks are 404 task_not_found / dependency_not_found", async () => {
    const { request } = await createTestContext();
    const foreignTask = await link(request, "tsk_3", "tsk_2", globex);
    expect(foreignTask.status).toBe(404);
    expect(await json(foreignTask)).toMatchObject({ code: "task_not_found" });
    for (const dependsOnId of ["tsk_6", "tsk_nope"]) {
      const response = await link(request, "tsk_3", dependsOnId);
      expect(response.status).toBe(404);
      expect(await json(response)).toMatchObject({ code: "dependency_not_found" });
    }
  });

  it("R3: a task cannot depend on itself", async () => {
    const { request } = await createTestContext();
    const response = await link(request, "tsk_3", "tsk_3");
    expect(response.status).toBe(422);
    expect(await json(response)).toMatchObject({ code: "self_dependency" });
  });

  it("R4: dependencies across projects are refused", async () => {
    const { request } = await createTestContext();
    const response = await link(request, "tsk_3", "tsk_4");
    expect(response.status).toBe(422);
    expect(await json(response)).toMatchObject({ code: "cross_project_dependency" });
    expect((await deps(request, "tsk_3")).blockedBy).toEqual([]);
  });

  it("R5: a duplicate link is 409 dependency_exists", async () => {
    const { request } = await createTestContext();
    expect((await link(request, "tsk_3", "tsk_2")).status).toBe(201);
    const again = await link(request, "tsk_3", "tsk_2");
    expect(again.status).toBe(409);
    expect(await json(again)).toMatchObject({ code: "dependency_exists" });
  });

  it("R6: a direct cycle is refused with the cycle path and nothing is stored", async () => {
    const { request } = await createTestContext();
    expect((await link(request, "tsk_3", "tsk_2")).status).toBe(201);
    const response = await link(request, "tsk_2", "tsk_3");
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: "dependency_cycle", cycle: ["tsk_2", "tsk_3", "tsk_2"] });
    expect((await deps(request, "tsk_2")).blockedBy).toEqual([]);
  });

  it("R6: a cycle through a chain is refused and reported in link order", async () => {
    const { request } = await createTestContext();
    const a = await newTask(request, "A");
    const b = await newTask(request, "B");
    const c = await newTask(request, "C");
    expect((await link(request, a, b)).status).toBe(201);
    expect((await link(request, b, c)).status).toBe(201);
    const response = await link(request, c, a);
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: "dependency_cycle", cycle: [c, a, b, c] });
  });

  it("R6: a diamond is not a cycle", async () => {
    const { request } = await createTestContext();
    const [a, b, c, d] = [await newTask(request, "A"), await newTask(request, "B"), await newTask(request, "C"), await newTask(request, "D")];
    for (const [from, to] of [[a, b], [a, c], [b, d], [c, d]] as const) {
      expect((await link(request, from, to)).status).toBe(201);
    }
  });

  it("R7: a task can have five blockers but not six", async () => {
    const { request } = await createTestContext();
    const target = await newTask(request, "Target");
    for (let index = 0; index < 5; index += 1) {
      expect((await link(request, target, await newTask(request, `Blocker ${index}`))).status).toBe(201);
    }
    const sixth = await link(request, target, await newTask(request, "Blocker 5"));
    expect(sixth.status).toBe(409);
    expect(await json(sixth)).toMatchObject({ code: "too_many_dependencies" });
    expect((await deps(request, target)).blockedBy).toHaveLength(5);
  });

  it("R8: removing a link returns 204, and a missing link is 404 dependency_not_found", async () => {
    const { request } = await createTestContext();
    expect((await link(request, "tsk_3", "tsk_2")).status).toBe(201);
    expect((await request("DELETE", "/api/tasks/tsk_3/dependencies/tsk_2", member)).status).toBe(204);
    expect((await getTask(request, "tsk_3")).blocked).toBe(false);
    const again = await request("DELETE", "/api/tasks/tsk_3/dependencies/tsk_2", member);
    expect(again.status).toBe(404);
    expect(await json(again)).toMatchObject({ code: "dependency_not_found" });
  });

  it("R8: another organization cannot remove a link", async () => {
    const { request } = await createTestContext();
    expect((await link(request, "tsk_3", "tsk_2")).status).toBe(201);
    const response = await request("DELETE", "/api/tasks/tsk_3/dependencies/tsk_2", globex);
    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({ code: "task_not_found" });
    expect((await deps(request, "tsk_3")).blockedBy.map((task) => task.id)).toEqual(["tsk_2"]);
  });

  it("R9: GET dependencies lists blockers and dependents with id, title and status in creation order", async () => {
    const { request } = await createTestContext();
    const later = await newTask(request, "Later");
    expect((await link(request, later, "tsk_2")).status).toBe(201);
    expect((await link(request, later, "tsk_1")).status).toBe(201);
    expect((await link(request, "tsk_3", later)).status).toBe(201);
    expect(await deps(request, later)).toEqual({
      blockedBy: [
        { id: "tsk_1", title: "Pick a CMS", status: "done" },
        { id: "tsk_2", title: "Design homepage", status: "in_progress" },
      ],
      blocking: [{ id: "tsk_3", title: "Fix broken signup link", status: "todo" }],
    });
  });

  it("R9: another organization's task dependencies are 404", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/tasks/tsk_3/dependencies", globex);
    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({ code: "task_not_found" });
  });

  it("R10: every task response carries blocked", async () => {
    const { request } = await createTestContext();
    const created = await json<TaskJson>(await request("POST", "/api/projects/prj_web/tasks", { ...admin, body: { title: "Fresh" } }));
    expect(created.blocked).toBe(false);
    expect((await link(request, "tsk_3", "tsk_2")).status).toBe(201);
    expect((await getTask(request, "tsk_3")).blocked).toBe(true);
    expect((await getTask(request, "tsk_2")).blocked).toBe(false);
    const list = await json<{ items: TaskJson[] }>(await request("GET", "/api/projects/prj_web/tasks", member));
    expect(Object.fromEntries(list.items.map((task) => [task.id, task.blocked]))).toMatchObject({ tsk_1: false, tsk_2: false, tsk_3: true });
    const patched = await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { title: "Fix the signup link" } });
    expect(patched.status).toBe(200);
    expect(await json(patched)).toMatchObject({ title: "Fix the signup link", blocked: true });
  });

  it("R11: a blocked task cannot start, and blockedBy lists only unfinished blockers in creation order", async () => {
    const { request } = await createTestContext();
    const later = await newTask(request, "Later");
    for (const blocker of [later, "tsk_1", "tsk_2"]) {
      expect((await link(request, "tsk_3", blocker)).status).toBe(201);
    }
    const response = await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { status: "in_progress" } });
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: "task_blocked", blockedBy: ["tsk_2", later] });
    expect((await getTask(request, "tsk_3")).status).toBe("todo");
  });

  it("R11: nothing in a refused PATCH is applied", async () => {
    const { request } = await createTestContext();
    expect((await link(request, "tsk_3", "tsk_2")).status).toBe(201);
    const response = await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { title: "Renamed", isUrgent: false, status: "in_progress" } });
    expect(response.status).toBe(409);
    expect(await getTask(request, "tsk_3")).toMatchObject({ title: "Fix broken signup link", status: "todo" });
  });

  it("R11: a blocked task cannot be finished but can go back to todo", async () => {
    const { request } = await createTestContext();
    expect((await link(request, "tsk_2", "tsk_3")).status).toBe(201);
    const finish = await request("PATCH", "/api/tasks/tsk_2", { ...member, body: { status: "done" } });
    expect(finish.status).toBe(409);
    expect(await json(finish)).toMatchObject({ code: "task_blocked", blockedBy: ["tsk_3"] });
    const back = await request("PATCH", "/api/tasks/tsk_2", { ...member, body: { status: "todo" } });
    expect(back.status).toBe(200);
    expect(await json(back)).toMatchObject({ status: "todo", blocked: true });
  });

  it("Decision 2: finishing a blocker unblocks; reopening it blocks again", async () => {
    const { request } = await createTestContext();
    expect((await link(request, "tsk_3", "tsk_2")).status).toBe(201);
    expect((await request("PATCH", "/api/tasks/tsk_2", { ...member, body: { status: "done" } })).status).toBe(200);
    expect((await getTask(request, "tsk_3")).blocked).toBe(false);
    expect((await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { status: "in_progress" } })).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_2", { ...admin, body: { status: "todo" } })).status).toBe(200);
    expect(await getTask(request, "tsk_3")).toMatchObject({ status: "in_progress", blocked: true });
    const finish = await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { status: "done" } });
    expect(finish.status).toBe(409);
    expect(await json(finish)).toMatchObject({ code: "task_blocked" });
  });

  it("R12: a task already in progress can get a blocker and keeps its status", async () => {
    const { request } = await createTestContext();
    expect((await link(request, "tsk_2", "tsk_3")).status).toBe(201);
    expect(await getTask(request, "tsk_2")).toMatchObject({ status: "in_progress", blocked: true });
  });

  it("R13: deleting a blocker removes its links and unblocks its dependents", async () => {
    const { request } = await createTestContext();
    expect((await link(request, "tsk_3", "tsk_2")).status).toBe(201);
    expect((await request("DELETE", "/api/tasks/tsk_2", admin)).status).toBe(204);
    expect((await getTask(request, "tsk_3")).blocked).toBe(false);
    expect((await deps(request, "tsk_3")).blockedBy).toEqual([]);
    expect((await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { status: "in_progress" } })).status).toBe(200);
  });

  it("R13: deleting a dependent removes it from its blocker's list", async () => {
    const { request } = await createTestContext();
    expect((await link(request, "tsk_3", "tsk_2")).status).toBe(201);
    expect((await request("DELETE", "/api/tasks/tsk_3", admin)).status).toBe(204);
    expect((await deps(request, "tsk_2")).blocking).toEqual([]);
  });
});
