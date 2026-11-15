import { afterEach, describe, expect, it, vi } from "vitest";

import { setMailTransport } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

afterEach(() => setMailTransport(async () => undefined));

const patch = (body: unknown, token: string = SEED_TOKENS.acmeAdmin) => ({ token, body });

describe("hidden: task update rules are unchanged", () => {
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
});
