import { afterEach, describe, expect, it, vi } from "vitest";

import { setMailTransport, type MailMessage } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

afterEach(() => setMailTransport(async () => undefined));

describe("tasks", () => {
  it("creates a task and emails the assignee", async () => {
    const sent: MailMessage[] = [];
    setMailTransport(async (message) => {
      sent.push(message);
    });
    const { request } = await createTestContext();
    const response = await request("POST", "/api/projects/prj_app/tasks", {
      token: SEED_TOKENS.acmeAdmin,
      body: { title: "Write release notes", assigneeId: "usr_bob" },
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      title: "Write release notes",
      status: "todo",
      assigneeId: "usr_bob",
    });
    expect(sent).toEqual([expect.objectContaining({ to: "bob@acme.test" })]);
  });

  it("rejects assignees from another organization", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/projects/prj_app/tasks", {
      token: SEED_TOKENS.acmeAdmin,
      body: { title: "Sneaky", assigneeId: "usr_gina" },
    });
    expect(response.status).toBe(400);
  });

  it("enforces status transitions", async () => {
    const { request } = await createTestContext();
    const skip = await request("PATCH", "/api/tasks/tsk_4", {
      token: SEED_TOKENS.acmeMember,
      body: { status: "done" },
    });
    expect(skip.status).toBe(409);
    const start = await request("PATCH", "/api/tasks/tsk_3", {
      token: SEED_TOKENS.acmeMember,
      body: { status: "in_progress" },
    });
    expect(start.status).toBe(200);
    const reopen = await request("PATCH", "/api/tasks/tsk_1", {
      token: SEED_TOKENS.acmeMember,
      body: { status: "todo" },
    });
    expect(reopen.status).toBe(403);
    const adminReopen = await request("PATCH", "/api/tasks/tsk_1", {
      token: SEED_TOKENS.acmeAdmin,
      body: { status: "todo" },
    });
    expect(adminReopen.status).toBe(200);
  });

  it("notifies on reassignment", async () => {
    const transport = vi.fn(async () => undefined);
    setMailTransport(transport);
    const { request } = await createTestContext();
    const response = await request("PATCH", "/api/tasks/tsk_4", {
      token: SEED_TOKENS.acmeAdmin,
      body: { assigneeId: "usr_ada" },
    });
    expect(response.status).toBe(200);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("only lets admins delete tasks", async () => {
    const { request } = await createTestContext();
    expect(
      (
        await request("DELETE", "/api/tasks/tsk_4", {
          token: SEED_TOKENS.acmeMember,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("DELETE", "/api/tasks/tsk_4", {
          token: SEED_TOKENS.acmeAdmin,
        })
      ).status,
    ).toBe(204);
  });
});
