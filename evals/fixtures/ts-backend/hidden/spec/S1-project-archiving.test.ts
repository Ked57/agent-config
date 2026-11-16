import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { setMailTransport, type MailMessage } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

// Hidden acceptance tests for spec #201 (docs/issues/201-project-archiving.md).
// Seed: prj_web has tsk_1 (done), tsk_2 (in_progress), tsk_3 (todo); prj_app has tsk_4 (todo);
// prj_billing has tsk_5 (todo). Globex owns prj_infra.

afterEach(() => setMailTransport(async () => undefined));

type Context = Awaited<ReturnType<typeof createTestContext>>;
type Project = { id: string; archivedAt: string | null; archivedBy: string | null; taskCounts?: Record<string, number> };

const admin = { token: SEED_TOKENS.acmeAdmin };
const member = { token: SEED_TOKENS.acmeMember };
const globex = { token: SEED_TOKENS.globexAdmin };

async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function listIds(request: Context["request"], query = "") {
  const response = await request("GET", `/api/projects${query}`, admin);
  expect(response.status).toBe(200);
  return (await json<{ items: Project[] }>(response)).items.map((item) => item.id);
}

async function archive(request: Context["request"], id: string, as: { token: string } = admin) {
  return request("POST", `/api/projects/${id}/archive`, as);
}

async function taskCount(db: Context["db"], projectId: string) {
  const rows = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM tasks WHERE project_id = ${projectId}`);
  return rows[0]?.n;
}

describe("spec #201: archive and restore projects", () => {
  it("R1: an admin archives a project and gets it back with archivedAt and archivedBy", async () => {
    const { request } = await createTestContext();
    const before = Date.now();
    const response = await archive(request, "prj_app");
    expect(response.status).toBe(200);
    const body = await json<Project>(response);
    expect(body).toMatchObject({ id: "prj_app", archivedBy: "usr_ada" });
    expect(typeof body.archivedAt).toBe("string");
    const at = Date.parse(body.archivedAt ?? "");
    expect(at).toBeGreaterThanOrEqual(before - 1000);
    expect(at).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("Data: archiving is stored in projects.archived_at and projects.archived_by", async () => {
    const { request, db } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    const rows = await db.all<{ id: string; archived_at: number | null; archived_by: string | null }>(
      sql`SELECT id, archived_at, archived_by FROM projects WHERE id IN ('prj_app', 'prj_billing') ORDER BY id`,
    );
    expect(rows[0]).toMatchObject({ id: "prj_app", archived_by: "usr_ada" });
    expect(rows[0]?.archived_at).not.toBeNull();
    expect(rows[1]).toMatchObject({ id: "prj_billing", archived_at: null, archived_by: null });
  });

  it("R2: members cannot archive or restore", async () => {
    const { request } = await createTestContext();
    const denied = await archive(request, "prj_app", member);
    expect(denied.status).toBe(403);
    expect(await json(denied)).toMatchObject({ code: "forbidden" });
    expect(await listIds(request)).toContain("prj_app");

    expect((await archive(request, "prj_app")).status).toBe(200);
    const restore = await request("POST", "/api/projects/prj_app/restore", member);
    expect(restore.status).toBe(403);
    expect(await json(restore)).toMatchObject({ code: "forbidden" });
    expect(await listIds(request)).not.toContain("prj_app");
  });

  it("R3: other organizations' and unknown projects are 404 project_not_found", async () => {
    const { request } = await createTestContext();
    for (const response of [
      await archive(request, "prj_app", globex),
      await request("POST", "/api/projects/prj_app/restore", globex),
      await archive(request, "prj_nope"),
      await request("POST", "/api/projects/prj_nope/restore", admin),
    ]) {
      expect(response.status).toBe(404);
      expect(await json(response)).toMatchObject({ code: "project_not_found" });
    }
    expect(await listIds(request)).toContain("prj_app");
  });

  it("R4: archiving twice is 409 already_archived and keeps the first archivedAt", async () => {
    const { request } = await createTestContext();
    const first = await json<Project>(await archive(request, "prj_app"));
    await new Promise((resolve) => setTimeout(resolve, 15));
    const again = await archive(request, "prj_app");
    expect(again.status).toBe(409);
    expect(await json(again)).toMatchObject({ code: "already_archived" });
    const stored = await json<Project>(await request("GET", "/api/projects/prj_app", admin));
    expect(stored.archivedAt).toBe(first.archivedAt);
    expect(stored.archivedBy).toBe("usr_ada");
  });

  it("R5: a project with in-progress tasks cannot be archived, and taskIds lists them in creation order", async () => {
    const { request, db } = await createTestContext();
    const created = await json<{ id: string }>(
      await request("POST", "/api/projects/prj_web/tasks", { ...admin, body: { title: "Later task" } }),
    );
    // A later task whose id sorts first, so creation order and id order differ.
    await db.run(sql`UPDATE tasks SET id = 'tsk_0late' WHERE id = ${created.id}`);
    for (const id of ["tsk_3", "tsk_0late"]) {
      expect((await request("PATCH", `/api/tasks/${id}`, { ...admin, body: { status: "in_progress" } })).status).toBe(200);
    }
    const refused = await archive(request, "prj_web");
    expect(refused.status).toBe(409);
    expect(await json(refused)).toMatchObject({ code: "project_has_active_tasks", taskIds: ["tsk_2", "tsk_3", "tsk_0late"] });
    expect(await listIds(request)).toContain("prj_web");
  });

  it("R5: todo and done tasks do not block; resetting the in-progress task lets the archive through", async () => {
    const { request } = await createTestContext();
    expect((await archive(request, "prj_web")).status).toBe(409);
    expect((await request("PATCH", "/api/tasks/tsk_2", { ...admin, body: { status: "todo" } })).status).toBe(200);
    expect((await archive(request, "prj_web")).status).toBe(200);
  });

  it("R6: restore clears both fields and brings the project back to the default list", async () => {
    const { request } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    const restored = await request("POST", "/api/projects/prj_app/restore", admin);
    expect(restored.status).toBe(200);
    expect(await json(restored)).toMatchObject({ id: "prj_app", archivedAt: null, archivedBy: null });
    expect(await listIds(request)).toEqual(["prj_billing", "prj_app", "prj_web"]);
  });

  it("R6: restoring an active project is 409 not_archived", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/projects/prj_app/restore", admin);
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: "not_archived" });
  });

  it("R7: the default list and archived=false hide archived projects", async () => {
    const { request } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    expect(await listIds(request)).toEqual(["prj_billing", "prj_web"]);
    expect(await listIds(request, "?archived=false")).toEqual(["prj_billing", "prj_web"]);
  });

  it("R7: archived=true lists only archived projects, archived=all lists both by name", async () => {
    const { request } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    expect(await listIds(request, "?archived=true")).toEqual(["prj_app"]);
    expect(await listIds(request, "?archived=all")).toEqual(["prj_billing", "prj_app", "prj_web"]);
  });

  it("R7: list items carry archivedAt and archived projects keep their taskCounts", async () => {
    const { request } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    const all = await json<{ items: Project[] }>(await request("GET", "/api/projects?archived=all", admin));
    const app = all.items.find((item) => item.id === "prj_app");
    const billing = all.items.find((item) => item.id === "prj_billing");
    expect(typeof app?.archivedAt).toBe("string");
    expect(billing?.archivedAt).toBeNull();
    expect(app?.taskCounts).toEqual({ todo: 1, in_progress: 0, done: 0 });
  });

  it("R7: any other archived value is a 422 validation error", async () => {
    const { request } = await createTestContext();
    expect((await request("GET", "/api/projects?archived=yes", admin)).status).toBe(422);
  });

  it("R8: archived projects and their tasks stay readable", async () => {
    const { request } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    const project = await request("GET", "/api/projects/prj_app", member);
    expect(project.status).toBe(200);
    expect(await json(project)).toMatchObject({ id: "prj_app", archivedBy: "usr_ada" });
    const tasks = await request("GET", "/api/projects/prj_app/tasks", member);
    expect(tasks.status).toBe(200);
    expect((await json<{ items: Array<{ id: string }> }>(tasks)).items.map((task) => task.id)).toEqual(["tsk_4"]);
    expect((await request("GET", "/api/tasks/tsk_4", member)).status).toBe(200);
  });

  it("R9: creating a task in an archived project is 409 project_archived and writes nothing", async () => {
    const { request, db } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    const response = await request("POST", "/api/projects/prj_app/tasks", { ...admin, body: { title: "Too late" } });
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: "project_archived" });
    expect(await taskCount(db, "prj_app")).toBe(1);
  });

  it("R9: any PATCH of an archived project's task is 409 project_archived, even one that changes nothing", async () => {
    const { request, db } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    for (const body of [{ title: "Renamed" }, { isUrgent: true }, {}]) {
      const response = await request("PATCH", "/api/tasks/tsk_4", { ...member, body });
      expect(response.status).toBe(409);
      expect(await json(response)).toMatchObject({ code: "project_archived" });
    }
    const rows = await db.all<{ title: string; is_urgent: number }>(sql`SELECT title, is_urgent FROM tasks WHERE id = 'tsk_4'`);
    expect(rows[0]).toMatchObject({ title: "Push notifications", is_urgent: 0 });
  });

  it("R9: a refused assignment on an archived project sends no email", async () => {
    const sent: MailMessage[] = [];
    setMailTransport(async (message) => {
      sent.push(message);
    });
    const { request } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...admin, body: { assigneeId: "usr_bob" } })).status).toBe(409);
    expect((await request("POST", "/api/projects/prj_app/tasks", { ...admin, body: { title: "X", assigneeId: "usr_bob" } })).status).toBe(409);
    expect(sent).toEqual([]);
  });

  it("R9: an admin deleting an archived project's task is 409 project_archived and the task stays", async () => {
    const { request, db } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    const response = await request("DELETE", "/api/tasks/tsk_4", admin);
    expect(response.status).toBe(409);
    expect(await json(response)).toMatchObject({ code: "project_archived" });
    expect(await taskCount(db, "prj_app")).toBe(1);
  });

  it("R10: 404 and 403 come before the archive rule, and the archive rule before the status rules", async () => {
    const { request } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    expect((await request("DELETE", "/api/tasks/tsk_4", member)).status).toBe(403);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...globex, body: { title: "x" } })).status).toBe(404);
    const skip = await request("PATCH", "/api/tasks/tsk_4", { ...admin, body: { status: "done" } });
    expect(skip.status).toBe(409);
    expect(await json(skip)).toMatchObject({ code: "project_archived" });
  });

  it("R11: after a restore the project's tasks are writable again", async () => {
    const { request } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    expect((await request("POST", "/api/projects/prj_app/restore", admin)).status).toBe(200);
    expect((await request("POST", "/api/projects/prj_app/tasks", { ...admin, body: { title: "Back on" } })).status).toBe(201);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...member, body: { title: "Push it" } })).status).toBe(200);
    expect((await request("DELETE", "/api/tasks/tsk_4", admin)).status).toBe(204);
  });

  it("R12: every task response carries readOnly, following the project's archive state", async () => {
    const { request } = await createTestContext();
    const created = await json<{ id: string; readOnly: boolean }>(await request("POST", "/api/projects/prj_app/tasks", { ...admin, body: { title: "Fresh" } }));
    expect(created.readOnly).toBe(false);
    const patched = await request("PATCH", "/api/tasks/tsk_4", { ...member, body: { title: "Push it" } });
    expect(await json(patched)).toMatchObject({ readOnly: false });
    expect((await archive(request, "prj_app")).status).toBe(200);
    expect(await json(await request("GET", "/api/tasks/tsk_4", member))).toMatchObject({ readOnly: true });
    const list = await json<{ items: Array<{ id: string; readOnly: boolean }> }>(await request("GET", "/api/projects/prj_app/tasks", member));
    expect(list.items.map((task) => task.readOnly)).toEqual([true, true]);
    expect(await json(await request("GET", "/api/tasks/tsk_1", member))).toMatchObject({ readOnly: false });
    expect((await request("POST", "/api/projects/prj_app/restore", admin)).status).toBe(200);
    expect(await json(await request("GET", "/api/tasks/tsk_4", member))).toMatchObject({ readOnly: false });
  });

  it("R13: of simultaneous archive requests exactly one wins and its values are stored", async () => {
    const { request } = await createTestContext();
    const reasons = ["r0", "r1", "r2", "r3", "r4"];
    const responses = await Promise.all(reasons.map((reason) => request("POST", "/api/projects/prj_app/archive", { ...admin, body: { reason } })));
    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409]);
    const bodies = await Promise.all(responses.map((response) => json<Project & { code?: string; archiveReason?: string }>(response)));
    const winner = bodies.find((_, index) => responses[index]?.status === 200);
    for (const [index, body] of bodies.entries()) if (responses[index]?.status === 409) expect(body.code).toBe("already_archived");
    const stored = await json<Project & { archiveReason: string }>(await request("GET", "/api/projects/prj_app", admin));
    expect(stored.archivedAt).toBe(winner?.archivedAt);
    expect(stored.archiveReason).toBe(winner?.archiveReason);
  });

  it("R13: of simultaneous restores exactly one wins", async () => {
    const { request } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    const responses = await Promise.all([0, 1, 2, 3].map(() => request("POST", "/api/projects/prj_app/restore", admin)));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409, 409, 409]);
    for (const response of responses) if (response.status === 409) expect(await json(response)).toMatchObject({ code: "not_archived" });
  });

  it("R14: deleting the archiving user keeps the project archived with archivedBy null", async () => {
    const { request, db } = await createTestContext();
    expect((await archive(request, "prj_app")).status).toBe(200);
    await db.run(sql`DELETE FROM users WHERE id = 'usr_ada'`);
    const project = await json<Project>(await request("GET", "/api/projects/prj_app", member));
    expect(project.archivedBy).toBeNull();
    expect(typeof project.archivedAt).toBe("string");
  });

  it("R15: archived=true lists the most recently archived first; all keeps name order", async () => {
    const { request } = await createTestContext();
    expect((await archive(request, "prj_billing")).status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await archive(request, "prj_app")).status).toBe(200);
    expect(await listIds(request, "?archived=true")).toEqual(["prj_app", "prj_billing"]);
    expect(await listIds(request, "?archived=all")).toEqual(["prj_billing", "prj_app", "prj_web"]);
  });

  it("R16: an archive reason is trimmed, stored, listed and cleared by a restore", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/projects/prj_app/archive", { ...admin, body: { reason: "  Shipped v1  " } });
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ archiveReason: "Shipped v1" });
    const list = await json<{ items: Array<{ id: string; archiveReason: string | null }> }>(await request("GET", "/api/projects?archived=all", admin));
    expect(Object.fromEntries(list.items.map((item) => [item.id, item.archiveReason]))).toEqual({ prj_app: "Shipped v1", prj_billing: null, prj_web: null });
    const restored = await request("POST", "/api/projects/prj_app/restore", admin);
    expect(await json(restored)).toMatchObject({ archiveReason: null });
    const bare = await archive(request, "prj_app");
    expect(await json(bare)).toMatchObject({ archiveReason: null });
  });

  it("R16: an empty, too long or unknown-keyed archive body is 422 and archives nothing", async () => {
    const { request } = await createTestContext();
    for (const body of [{ reason: "   " }, { reason: "x".repeat(201) }, { reason: "ok", force: true }, { why: "ok" }]) {
      const response = await request("POST", "/api/projects/prj_app/archive", { ...admin, body });
      expect(response.status).toBe(422);
    }
    expect(await listIds(request)).toContain("prj_app");
    expect((await request("POST", "/api/projects/prj_app/archive", { ...admin, body: { reason: "y".repeat(200) } })).status).toBe(200);
  });
});
