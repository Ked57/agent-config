import { afterEach, describe, expect, it, vi } from "vitest";

import { setMailTransport } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

afterEach(() => setMailTransport(async () => undefined));

const patch = (body: unknown, token: string = SEED_TOKENS.acmeAdmin) => ({ token, body });

interface TaskBody {
  title: string;
  description: string | null;
  status: string;
  isUrgent: boolean;
  assigneeId: string | null;
  dueDate: string | null;
  updatedAt: string;
}

describe("hidden: task update rules are unchanged", { timeout: 30_000 }, () => {
  it("enforces transitions, roles and assignment rules", async () => {
    const { request } = await createTestContext();
    expect((await request("PATCH", "/api/tasks/tsk_4", patch({ status: "done" }))).status).toBe(409);
    expect((await request("PATCH", "/api/tasks/tsk_1", patch({ status: "in_progress" }))).status).toBe(409);
    expect((await request("PATCH", "/api/tasks/tsk_1", patch({ status: "todo" }, SEED_TOKENS.acmeMember))).status).toBe(403);
    expect((await request("PATCH", "/api/tasks/tsk_4", patch({ status: "in_progress" }))).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_4", patch({ status: "done" }))).status).toBe(409);
    expect((await request("PATCH", "/api/tasks/tsk_2", patch({ status: "done" }))).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_2", patch({ dueDate: "2027-01-01" }))).status).toBe(409);
    expect((await request("PATCH", "/api/tasks/tsk_3", patch({ title: "   " }))).status).toBe(400);
    expect((await request("PATCH", "/api/tasks/tsk_3", patch({ assigneeId: "usr_gina" }))).status).toBe(400);
    const trimmed = await request("PATCH", "/api/tasks/tsk_3", patch({ title: "  Fixed signup link  " }));
    expect(((await trimmed.json()) as { title: string }).title).toBe("Fixed signup link");
  });

  it("returns the task unchanged for an empty patch and notifies new assignees", async () => {
    const transport = vi.fn(async () => undefined);
    setMailTransport(transport);
    const { request } = await createTestContext();
    const before = (await (await request("GET", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin })).json()) as { updatedAt: string };
    const unchanged = (await (await request("PATCH", "/api/tasks/tsk_4", patch({}))).json()) as { updatedAt: string };
    expect(unchanged.updatedAt).toBe(before.updatedAt);
    await request("PATCH", "/api/tasks/tsk_4", patch({ assigneeId: "usr_bob" }));
    await request("PATCH", "/api/tasks/tsk_4", patch({ assigneeId: null }));
    expect(transport).toHaveBeenCalledTimes(1);
  });

  // Everything below pins behaviour of the untouched handler that the two tests above leave
  // open, so a refactor that quietly changes it ("Behaviour must not change") is caught.

  it("keeps tasks of another organization invisible", async () => {
    const { request } = await createTestContext();
    const foreign = await request("PATCH", "/api/tasks/tsk_4", patch({ title: "Hijacked" }, SEED_TOKENS.globexAdmin));
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual({ error: "task not found" });
    const task = (await (await request("GET", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin })).json()) as TaskBody;
    expect(task.title).toBe("Push notifications");
    expect((await request("PATCH", "/api/tasks/tsk_missing", patch({ title: "x" }))).status).toBe(404);
  });

  it("keeps the error bodies", async () => {
    const { request } = await createTestContext();
    expect(await (await request("PATCH", "/api/tasks/tsk_4", patch({ status: "done" }))).json()).toEqual({ error: "cannot move a task from todo to done" });
    expect(await (await request("PATCH", "/api/tasks/tsk_1", patch({ status: "todo" }, SEED_TOKENS.acmeMember))).json()).toEqual({ error: "only admins can reopen finished tasks" });
    expect(await (await request("PATCH", "/api/tasks/tsk_3", patch({ title: " " }))).json()).toEqual({ error: "title cannot be blank" });
    expect(await (await request("PATCH", "/api/tasks/tsk_3", patch({ assigneeId: "usr_gina" }))).json()).toEqual({ error: "assignee must be a member of your organization" });
    await request("PATCH", "/api/tasks/tsk_5", patch({ status: "in_progress" }));
    expect(await (await request("PATCH", "/api/tasks/tsk_5", patch({ status: "done" }))).json()).toEqual({ error: "assign the task before marking it done" });
    await request("PATCH", "/api/tasks/tsk_2", patch({ status: "done" }));
    expect(await (await request("PATCH", "/api/tasks/tsk_2", patch({ dueDate: "2027-01-01" }))).json()).toEqual({ error: "finished tasks cannot get a new due date" });
  });

  it("keeps the order of the rules and the edge cases around done tasks", async () => {
    const { request } = await createTestContext();
    // An impossible transition is a 409 even for a member touching a finished task.
    expect((await request("PATCH", "/api/tasks/tsk_1", patch({ status: "in_progress" }, SEED_TOKENS.acmeMember))).status).toBe(409);
    // Assigning and finishing in one request is allowed.
    expect((await request("PATCH", "/api/tasks/tsk_5", patch({ status: "in_progress" }))).status).toBe(200);
    const finished = await request("PATCH", "/api/tasks/tsk_5", patch({ status: "done", assigneeId: "usr_bob" }));
    expect(finished.status).toBe(200);
    expect((await finished.json()) as TaskBody).toMatchObject({ status: "done", assigneeId: "usr_bob" });
    // A finished task may lose its due date, and an admin may reopen it.
    expect((await request("PATCH", "/api/tasks/tsk_5", patch({ dueDate: null }))).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_5", patch({ status: "todo" }))).status).toBe(200);
    // Sending the current status is not a transition.
    expect((await request("PATCH", "/api/tasks/tsk_1", patch({ status: "done" }, SEED_TOKENS.acmeMember))).status).toBe(200);
  });

  it("stores every field and bumps updatedAt only when something changed", async () => {
    const transport = vi.fn(async () => undefined);
    setMailTransport(transport);
    const { request } = await createTestContext();
    const before = (await (await request("GET", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin })).json()) as TaskBody;
    const response = await request("PATCH", "/api/tasks/tsk_4", patch({ description: "Use FCM", isUrgent: true, dueDate: null, assigneeId: "usr_ada" }));
    expect(response.status).toBe(200);
    const updated = (await response.json()) as TaskBody;
    expect(updated).toMatchObject({ title: "Push notifications", description: "Use FCM", isUrgent: true, dueDate: null, assigneeId: "usr_ada", status: "todo" });
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));
    const stored = (await (await request("GET", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin })).json()) as TaskBody;
    expect(stored).toEqual(updated);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ to: "ada@acme.test" }));
    // Re-sending the current assignee is not a new assignment: no second email.
    await request("PATCH", "/api/tasks/tsk_4", patch({ assigneeId: "usr_ada" }));
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
