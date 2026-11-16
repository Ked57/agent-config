import { describe, expect, it } from "vitest";

import { setMailTransport, type MailMessage } from "../services/mailer";
import { runDueJobs } from "../services/jobs";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

const admin = SEED_TOKENS.acmeAdmin;

describe("tasks", () => {
  it("creates a task in a project", async () => {
    const { json } = await createTestContext();
    const created = await json("POST", "/api/projects/prj_app/tasks", {
      token: SEED_TOKENS.acmeMember,
      body: { title: "Offline mode", dueDate: "2026-12-10" },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      projectId: "prj_app",
      title: "Offline mode",
      status: "todo",
      repeat: "none",
    });
  });

  it("emails a new assignee through the job queue", async () => {
    const { db, request } = await createTestContext();
    const sent: MailMessage[] = [];
    setMailTransport(async (message) => {
      sent.push(message);
    });
    await request("POST", "/api/projects/prj_app/tasks", {
      token: admin,
      body: { title: "Store listing", assigneeId: "usr_bob" },
    });
    expect(sent).toHaveLength(0);
    await runDueJobs(db);
    expect(sent.map((m) => m.to)).toEqual(["bob@acme.test"]);
  });

  it("rejects assignees from another org", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/projects/prj_app/tasks", {
      token: admin,
      body: { title: "x", assigneeId: "usr_gina" },
    });
    expect(response.status).toBe(400);
  });

  it("follows the status rules", async () => {
    const { json } = await createTestContext();
    const done = await json("PATCH", "/api/tasks/tsk_3", {
      token: admin,
      body: { status: "done" },
    });
    expect(done.body).toMatchObject({ status: "done", nextOccurrence: null });
    const back = await json("PATCH", "/api/tasks/tsk_1", {
      token: admin,
      body: { status: "in_progress" },
    });
    expect(back.status).toBe(409);
  });

  it("creates the next occurrence of a weekly task", async () => {
    const { json } = await createTestContext();
    const created = await json<{ id: string }>(
      "POST",
      "/api/projects/prj_internal/tasks",
      {
        token: admin,
        body: { title: "Timesheets", dueDate: "2026-11-13", repeat: "weekly" },
      },
    );
    const done = await json<{ nextOccurrence: { dueDate: string } }>(
      "PATCH",
      `/api/tasks/${created.body.id}`,
      { token: admin, body: { status: "done" } },
    );
    expect(done.body.nextOccurrence.dueDate).toBe("2026-11-20");
  });

  it("creates the next occurrence of a monthly task", async () => {
    const { json } = await createTestContext();
    const done = await json<{
      nextOccurrence: { dueDate: string; status: string };
    }>("PATCH", "/api/tasks/tsk_5", { token: admin, body: { status: "done" } });
    expect(done.body.nextOccurrence).toMatchObject({
      dueDate: "2026-12-15",
      status: "todo",
    });
  });

  it("sets labels", async () => {
    const { json } = await createTestContext();
    const labelled = await json("PUT", "/api/tasks/tsk_4/labels", {
      token: admin,
      body: { labelIds: ["lbl_bug", "lbl_frontend"] },
    });
    expect(labelled.body).toMatchObject({ labels: ["bug", "frontend"] });
    const foreign = await json("PUT", "/api/tasks/tsk_4/labels", {
      token: admin,
      body: { labelIds: ["lbl_ops"] },
    });
    expect(foreign.status).toBe(400);
  });

  it("only lets admins delete", async () => {
    const { request } = await createTestContext();
    expect(
      (
        await request("DELETE", "/api/tasks/tsk_4", {
          token: SEED_TOKENS.acmeMember,
        })
      ).status,
    ).toBe(403);
    expect(
      (await request("DELETE", "/api/tasks/tsk_4", { token: admin })).status,
    ).toBe(204);
    expect(
      (await request("DELETE", "/api/tasks/tsk_6", { token: admin })).status,
    ).toBe(404);
  });
});
