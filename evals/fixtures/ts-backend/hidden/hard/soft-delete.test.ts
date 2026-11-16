import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { setMailTransport } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

afterEach(() => setMailTransport(async () => undefined));

type Context = Awaited<ReturnType<typeof createTestContext>>;
type ProjectList = { items: Array<{ id: string; taskCounts: Record<string, number> }> };
type TaskList = { items: Array<{ id: string }> };

const admin = { token: SEED_TOKENS.acmeAdmin };
const member = { token: SEED_TOKENS.acmeMember };

async function webCounts(request: Context["request"]) {
  const list = (await (await request("GET", "/api/projects", member)).json()) as ProjectList;
  return list.items.find((item) => item.id === "prj_web")?.taskCounts;
}

async function webTaskIds(request: Context["request"]) {
  const list = (await (await request("GET", "/api/projects/prj_web/tasks", member)).json()) as TaskList;
  return list.items.map((item) => item.id);
}

async function restoreAsAdmin(request: Context["request"], id: string) {
  expect((await request("POST", `/api/tasks/${id}/restore`, admin)).status).toBe(200);
}

async function deleteAsAdmin(request: Context["request"], id: string) {
  expect((await request("DELETE", `/api/tasks/${id}`, admin)).status).toBe(204);
}

// Seed: prj_web has tsk_1 (done), tsk_2 (in_progress, "Design homepage", assigned to usr_bob), tsk_3 (todo).
describe("hidden: soft-deleted tasks", { timeout: 30_000 }, () => {
  // Prompt: existing DELETE behaviour (admin-only, 204) is unchanged; only what it does to the row changes
  it("keeps DELETE admin-only with a 204", async () => {
    const { request } = await createTestContext();
    expect((await request("DELETE", "/api/tasks/tsk_2", member)).status).toBe(403);
    expect((await request("DELETE", "/api/tasks/tsk_2", admin)).status).toBe(204);
  });

  // Prompt: "a soft delete that keeps the row with a deleted_at timestamp"

  it("keeps the row and stamps deleted_at instead of deleting it", async () => {
    const { request, db } = await createTestContext();
    await deleteAsAdmin(request, "tsk_2");
    const rows = await db.all<{ id: string; deleted_at: number | null }>(sql`SELECT id, deleted_at FROM tasks WHERE id IN ('tsk_1', 'tsk_2') ORDER BY id`);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.deleted_at).toBeNull();
    expect(rows[1]?.deleted_at).not.toBeNull();
  });

  // Prompt: "a deleted task must behave everywhere as if it did not exist"

  it("answers 404 to GET for a deleted task", async () => {
    const { request } = await createTestContext();
    await deleteAsAdmin(request, "tsk_2");
    expect((await request("GET", "/api/tasks/tsk_2", admin)).status).toBe(404);
    expect((await request("GET", "/api/tasks/tsk_2", member)).status).toBe(404);
    await restoreAsAdmin(request, "tsk_2");
    expect((await request("GET", "/api/tasks/tsk_2", member)).status).toBe(200);
  });

  // Prompt: "... as if it did not exist": editing a missing task is a 404 and changes nothing

  it("answers 404 to PATCH for a deleted task and changes nothing", async () => {
    const { request } = await createTestContext();
    await deleteAsAdmin(request, "tsk_2");
    expect((await request("PATCH", "/api/tasks/tsk_2", { ...admin, body: { title: "Edited while deleted" } })).status).toBe(404);
    expect((await request("PATCH", "/api/tasks/tsk_2", { ...member, body: { status: "done" } })).status).toBe(404);
    const restored = await request("POST", "/api/tasks/tsk_2/restore", admin);
    expect(restored.status).toBe(200);
    expect(await restored.json()).toMatchObject({ id: "tsk_2", title: "Design homepage", status: "in_progress" });
  });

  // Prompt: "... as if it did not exist": deleting a missing task is a 404

  it("answers 404 to a second DELETE of the same task", async () => {
    const { request } = await createTestContext();
    await deleteAsAdmin(request, "tsk_2");
    expect((await request("DELETE", "/api/tasks/tsk_2", admin)).status).toBe(404);
    // The second DELETE did not touch the deleted row: restoring still works once.
    await restoreAsAdmin(request, "tsk_2");
    expect((await request("GET", "/api/tasks/tsk_2", member)).status).toBe(200);
  });

  // Prompt: "... as if it did not exist" (lists)

  it("leaves deleted tasks out of the project's task list", async () => {
    const { request } = await createTestContext();
    expect(await webTaskIds(request)).toEqual(["tsk_1", "tsk_2", "tsk_3"]);
    await deleteAsAdmin(request, "tsk_2");
    expect(await webTaskIds(request)).toEqual(["tsk_1", "tsk_3"]);
    await deleteAsAdmin(request, "tsk_1");
    await deleteAsAdmin(request, "tsk_3");
    expect(await webTaskIds(request)).toEqual([]);
    await restoreAsAdmin(request, "tsk_3");
    expect(await webTaskIds(request)).toEqual(["tsk_3"]);
  });

  // Prompt: "... as if it did not exist" (the task counts in GET /api/projects)

  it("leaves deleted tasks out of the per-status task counts", async () => {
    const { request } = await createTestContext();
    expect(await webCounts(request)).toEqual({ todo: 1, in_progress: 1, done: 1 });
    await deleteAsAdmin(request, "tsk_2");
    expect(await webCounts(request)).toEqual({ todo: 1, in_progress: 0, done: 1 });
    await deleteAsAdmin(request, "tsk_1");
    await deleteAsAdmin(request, "tsk_3");
    expect(await webCounts(request)).toEqual({ todo: 0, in_progress: 0, done: 0 });
    await restoreAsAdmin(request, "tsk_1");
    expect(await webCounts(request)).toEqual({ todo: 0, in_progress: 0, done: 1 });
  });

  // Prompt: "POST /api/tasks/:id/restore for admins to undo it (200 with the task)"

  it("restores a deleted task for an admin, unchanged and visible everywhere again", async () => {
    const { request } = await createTestContext();
    await deleteAsAdmin(request, "tsk_2");
    const restored = await request("POST", "/api/tasks/tsk_2/restore", admin);
    expect(restored.status).toBe(200);
    expect(await restored.json()).toMatchObject({ id: "tsk_2", title: "Design homepage", status: "in_progress", assigneeId: "usr_bob" });
    expect((await request("GET", "/api/tasks/tsk_2", member)).status).toBe(200);
    expect(await webTaskIds(request)).toEqual(["tsk_1", "tsk_2", "tsk_3"]);
    expect(await webCounts(request)).toEqual({ todo: 1, in_progress: 1, done: 1 });
    expect((await request("PATCH", "/api/tasks/tsk_2", { ...member, body: { title: "Editable again" } })).status).toBe(200);
  });

  // Prompt: "for admins" (of the task's organization; 401 is the existing convention without a token)

  it("lets only admins of the task's organization restore it", async () => {
    const { request } = await createTestContext();
    await deleteAsAdmin(request, "tsk_2");
    expect((await request("POST", "/api/tasks/tsk_2/restore")).status).toBe(401);
    // 403 or 404 are both reasonable refusals; what matters is that nothing is restored.
    expect([403, 404]).toContain((await request("POST", "/api/tasks/tsk_2/restore", member)).status);
    expect([403, 404]).toContain((await request("POST", "/api/tasks/tsk_2/restore", { token: SEED_TOKENS.globexAdmin })).status);
    // None of the refused attempts restored it.
    expect((await request("GET", "/api/tasks/tsk_2", admin)).status).toBe(404);
  });

  // Prompt: "as if it did not exist" applies to unknown ids; restore must not damage a live task

  it("answers 404 to restoring an unknown task and does not break a task that is not deleted", async () => {
    const { request } = await createTestContext();
    expect((await request("POST", "/api/tasks/nope/restore", admin)).status).toBe(404);
    // Restoring a live task may be refused (4xx) or be a no-op (2xx), but must not fail or change it.
    expect((await request("POST", "/api/tasks/tsk_2/restore", admin)).status).toBeLessThan(500);
    const live = await request("GET", "/api/tasks/tsk_2", member);
    expect(live.status).toBe(200);
    expect(await live.json()).toMatchObject({ id: "tsk_2", title: "Design homepage", status: "in_progress" });
    expect(await webTaskIds(request)).toEqual(["tsk_1", "tsk_2", "tsk_3"]);
  });
});
