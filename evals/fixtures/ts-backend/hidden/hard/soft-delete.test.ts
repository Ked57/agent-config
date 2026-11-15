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

// Seed: prj_web has tsk_1 (done), tsk_2 (in_progress), tsk_3 (todo).
describe("hidden: soft-deleted tasks", () => {
  it("keeps the row and stamps deleted_at instead of deleting", async () => {
    const { request, db } = await createTestContext();
    expect((await request("DELETE", "/api/tasks/tsk_2", member)).status).toBe(403);
    expect((await request("DELETE", "/api/tasks/tsk_2", admin)).status).toBe(204);
    const rows = await db.all<{ id: string; deleted_at: number | null }>(sql`SELECT id, deleted_at FROM tasks WHERE id IN ('tsk_1', 'tsk_2') ORDER BY id`);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.deleted_at).toBeNull();
    expect(rows[1]?.deleted_at).not.toBeNull();
  });

  it("answers 404 to every request for a deleted task by id", async () => {
    const { request } = await createTestContext();
    expect((await request("DELETE", "/api/tasks/tsk_2", admin)).status).toBe(204);
    expect((await request("GET", "/api/tasks/tsk_2", admin)).status).toBe(404);
    expect((await request("GET", "/api/tasks/tsk_2", member)).status).toBe(404);
    expect((await request("PATCH", "/api/tasks/tsk_2", { ...admin, body: { title: "Edited while deleted" } })).status).toBe(404);
    expect((await request("PATCH", "/api/tasks/tsk_2", { ...member, body: { status: "done" } })).status).toBe(404);
    expect((await request("DELETE", "/api/tasks/tsk_2", admin)).status).toBe(404);
    // The edit attempts changed nothing.
    const restored = await request("POST", "/api/tasks/tsk_2/restore", admin);
    expect(restored.status).toBe(200);
    expect(await restored.json()).toMatchObject({ id: "tsk_2", title: "Design homepage", status: "in_progress" });
  });

  it("leaves deleted tasks out of lists and counts", async () => {
    const { request } = await createTestContext();
    expect(await webTaskIds(request)).toEqual(["tsk_1", "tsk_2", "tsk_3"]);
    expect(await webCounts(request)).toEqual({ todo: 1, in_progress: 1, done: 1 });
    expect((await request("DELETE", "/api/tasks/tsk_2", admin)).status).toBe(204);
    expect(await webTaskIds(request)).toEqual(["tsk_1", "tsk_3"]);
    expect(await webCounts(request)).toEqual({ todo: 1, in_progress: 0, done: 1 });
    expect((await request("DELETE", "/api/tasks/tsk_1", admin)).status).toBe(204);
    expect((await request("DELETE", "/api/tasks/tsk_3", admin)).status).toBe(204);
    expect(await webTaskIds(request)).toEqual([]);
    expect(await webCounts(request)).toEqual({ todo: 0, in_progress: 0, done: 0 });
  });

  it("restores for admins of the task's organization only", async () => {
    const { request } = await createTestContext();
    expect((await request("DELETE", "/api/tasks/tsk_2", admin)).status).toBe(204);
    expect((await request("POST", "/api/tasks/tsk_2/restore")).status).toBe(401);
    expect((await request("POST", "/api/tasks/tsk_2/restore", member)).status).toBe(403);
    expect((await request("POST", "/api/tasks/tsk_2/restore", { token: SEED_TOKENS.globexAdmin })).status).toBe(404);
    expect((await request("GET", "/api/tasks/tsk_2", admin)).status).toBe(404);
    const restored = await request("POST", "/api/tasks/tsk_2/restore", admin);
    expect(restored.status).toBe(200);
    expect(await restored.json()).toMatchObject({ id: "tsk_2" });
    expect((await request("GET", "/api/tasks/tsk_2", member)).status).toBe(200);
    expect(await webTaskIds(request)).toEqual(["tsk_1", "tsk_2", "tsk_3"]);
    expect(await webCounts(request)).toEqual({ todo: 1, in_progress: 1, done: 1 });
    expect((await request("PATCH", "/api/tasks/tsk_2", { ...member, body: { title: "Editable again" } })).status).toBe(200);
  });

  it("answers 409 when the task is not deleted and 404 when it does not exist", async () => {
    const { request } = await createTestContext();
    expect((await request("POST", "/api/tasks/tsk_2/restore", admin)).status).toBe(409);
    expect((await request("POST", "/api/tasks/nope/restore", admin)).status).toBe(404);
    expect((await request("DELETE", "/api/tasks/tsk_2", admin)).status).toBe(204);
    expect((await request("POST", "/api/tasks/tsk_2/restore", admin)).status).toBe(200);
    expect((await request("POST", "/api/tasks/tsk_2/restore", admin)).status).toBe(409);
  });
});
