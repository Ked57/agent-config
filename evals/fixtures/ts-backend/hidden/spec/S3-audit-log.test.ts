import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { SEED_PASSWORD } from "../db/seed";
import { setMailTransport, type MailMessage } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

// Hidden acceptance tests for spec #203 (docs/issues/203-audit-log.md).
// Seed: prj_web has tsk_1 (done), tsk_2 (in_progress, bob), tsk_3 (todo, urgent, ada); prj_app has
// tsk_4 (todo, due 2026-12-01). Globex starts with 0 credits.

afterEach(() => setMailTransport(async () => undefined));

type Context = Awaited<ReturnType<typeof createTestContext>>;
type Request = Context["request"];
type AuditEvent = {
  id: number;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string | null;
  changes: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
};

const admin = { token: SEED_TOKENS.acmeAdmin };
const member = { token: SEED_TOKENS.acmeMember };
const globex = { token: SEED_TOKENS.globexAdmin };
const webhookHeaders = { "x-webhook-secret": "test-webhook-secret" };

async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function events(request: Request, query = "", as: { token: string } = admin) {
  const response = await request("GET", `/api/audit-events${query}`, as);
  expect(response.status).toBe(200);
  return (await json<{ items: AuditEvent[] }>(response)).items;
}

describe("spec #203: audit log", () => {
  it("R8: a freshly seeded database has no events", async () => {
    const { request } = await createTestContext();
    expect(await events(request)).toEqual([]);
  });

  it("R1/R2: creating a task records task.created with every non-null tracked field", async () => {
    const { request } = await createTestContext();
    const created = await json<{ id: string }>(
      await request("POST", "/api/projects/prj_app/tasks", { ...member, body: { title: "Write release notes", assigneeId: "usr_ada" } }),
    );
    const [event] = await events(request);
    expect(event).toMatchObject({ action: "task.created", entityType: "task", entityId: created.id, actorId: "usr_bob" });
    expect(event?.changes).toEqual({
      title: { from: null, to: "Write release notes" },
      status: { from: null, to: "todo" },
      isUrgent: { from: null, to: false },
      assigneeId: { from: null, to: "usr_ada" },
      projectId: { from: null, to: "prj_app" },
    });
    expect(Number.isNaN(Date.parse(event?.createdAt ?? ""))).toBe(false);
  });

  it("R1/R2: updating a task records only the fields that changed", async () => {
    const { request } = await createTestContext();
    const response = await request("PATCH", "/api/tasks/tsk_3", {
      ...member,
      body: { status: "in_progress", isUrgent: true, dueDate: "2026-12-24", title: "Fix broken signup link" },
    });
    expect(response.status).toBe(200);
    const items = await events(request);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ action: "task.updated", entityId: "tsk_3", actorId: "usr_bob" });
    expect(items[0]?.changes).toEqual({
      status: { from: "todo", to: "in_progress" },
      dueDate: { from: null, to: "2026-12-24" },
    });
  });

  it("R2: clearing a value records to: null", async () => {
    const { request } = await createTestContext();
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...admin, body: { dueDate: null, assigneeId: "usr_bob" } })).status).toBe(200);
    const [event] = await events(request);
    expect(event?.changes).toEqual({
      dueDate: { from: "2026-12-01", to: null },
      assigneeId: { from: null, to: "usr_bob" },
    });
  });

  it("R1/R2: deleting a task records its old non-null values", async () => {
    const { request } = await createTestContext();
    expect((await request("DELETE", "/api/tasks/tsk_3", admin)).status).toBe(204);
    const [event] = await events(request);
    expect(event).toMatchObject({ action: "task.deleted", entityType: "task", entityId: "tsk_3", actorId: "usr_ada" });
    expect(event?.changes).toEqual({
      title: { from: "Fix broken signup link", to: null },
      status: { from: "todo", to: null },
      isUrgent: { from: true, to: null },
      assigneeId: { from: "usr_ada", to: null },
      projectId: { from: "prj_web", to: null },
    });
  });

  it("R1/R2: creating a project records project.created", async () => {
    const { request } = await createTestContext();
    const project = await json<{ id: string }>(await request("POST", "/api/projects", { ...admin, body: { name: "Docs" } }));
    const [event] = await events(request);
    expect(event).toMatchObject({ action: "project.created", entityType: "project", entityId: project.id, actorId: "usr_ada" });
    expect(event?.changes).toEqual({ name: { from: null, to: "Docs" } });
  });

  it("R8: events come newest first", async () => {
    const { request } = await createTestContext();
    const created = await json<{ id: string }>(await request("POST", "/api/projects/prj_app/tasks", { ...admin, body: { title: "One" } }));
    expect((await request("PATCH", `/api/tasks/${created.id}`, { ...admin, body: { title: "Two" } })).status).toBe(200);
    expect((await request("DELETE", `/api/tasks/${created.id}`, admin)).status).toBe(204);
    const items = await events(request);
    expect(items.map((event) => event.action)).toEqual(["task.deleted", "task.updated", "task.created"]);
    expect(items[0]!.id).toBeGreaterThan(items[1]!.id);
    expect(items[1]!.id).toBeGreaterThan(items[2]!.id);
  });

  it("R3: a PATCH that changes nothing writes no event", async () => {
    const { request } = await createTestContext();
    expect((await request("PATCH", "/api/tasks/tsk_3", { ...member, body: {} })).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { title: "Fix broken signup link", isUrgent: true } })).status).toBe(200);
    expect(await events(request)).toEqual([]);
  });

  it("R4: refused requests write no event", async () => {
    const { request } = await createTestContext();
    expect((await request("DELETE", "/api/tasks/tsk_4", member)).status).toBe(403);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...member, body: { status: "done" } })).status).toBe(409);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...admin, body: { assigneeId: "usr_gina" } })).status).toBe(400);
    expect((await request("POST", "/api/projects/prj_app/tasks", { ...admin, body: { title: "x", assigneeId: "usr_gina" } })).status).toBe(400);
    expect((await request("POST", "/api/auth/token", { body: { email: "ada@acme.test", password: "wrong" } })).status).toBe(401);
    expect(await events(request)).toEqual([]);
  });

  it("R1/R2/R7: a login records auth.token_issued with no changes and the token appears nowhere", async () => {
    const { request } = await createTestContext();
    const login = await request("POST", "/api/auth/token", { body: { email: "bob@acme.test", password: SEED_PASSWORD } });
    expect(login.status).toBe(200);
    const { token } = await json<{ token: string }>(login);
    const response = await request("GET", "/api/audit-events", admin);
    const text = await response.text();
    expect(text).not.toContain(token);
    expect(text).not.toMatch(/scrypt\$|token_?hash|password/i);
    const items = (JSON.parse(text) as { items: AuditEvent[] }).items;
    expect(items).toEqual([expect.objectContaining({ action: "auth.token_issued", entityType: "user", entityId: "usr_bob", actorId: "usr_bob", changes: {} })]);
  });

  it("R7: stored events hold no token, token hash or password hash", async () => {
    const { request, db } = await createTestContext();
    const { token } = await json<{ token: string }>(
      await request("POST", "/api/auth/token", { body: { email: "ada@acme.test", password: SEED_PASSWORD } }),
    );
    const hashes = await db.all<{ token_hash: string }>(sql`SELECT token_hash FROM api_tokens`);
    const rows = JSON.stringify(await db.all(sql`SELECT * FROM audit_events`));
    expect(rows).toContain("auth.token_issued");
    expect(rows).not.toContain(token);
    for (const { token_hash } of hashes) expect(rows).not.toContain(token_hash);
    expect(rows).not.toContain("scrypt$");
  });

  it("R5: the billing webhook records org.credits_added for that organization only, with no actor", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/webhooks/billing", {
      headers: webhookHeaders,
      body: { id: "evt_1", type: "payment.succeeded", data: { orgId: "org_globex", credits: 50 } },
    });
    expect(response.status).toBe(200);
    expect(await events(request, "", globex)).toEqual([
      expect.objectContaining({
        action: "org.credits_added",
        entityType: "organization",
        entityId: "org_globex",
        actorId: null,
        changes: { credits: { from: 0, to: 50 } },
      }),
    ]);
    expect(await events(request)).toEqual([]);
  });

  it("R5: webhooks that change nothing write no event", async () => {
    const { request, db } = await createTestContext();
    for (const data of [{ orgId: "org_missing", credits: 10 }, { orgId: "org_acme", credits: 0 }]) {
      expect((await request("POST", "/api/webhooks/billing", { headers: webhookHeaders, body: { id: `evt_${data.orgId}`, type: "payment.succeeded", data } })).status).toBe(200);
    }
    const rows = await db.all<{ n: number }>(sql`SELECT count(*) AS n FROM audit_events`);
    expect(rows[0]?.n).toBe(0);
  });

  it("R6: when the event cannot be written, the update fails with 500 and is not kept", async () => {
    const { request, db } = await createTestContext();
    await db.run(sql`DROP TABLE audit_events`);
    const response = await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { title: "Should not stick" } });
    expect(response.status).toBe(500);
    const rows = await db.all<{ title: string }>(sql`SELECT title FROM tasks WHERE id = 'tsk_3'`);
    expect(rows[0]?.title).toBe("Fix broken signup link");
  });

  it("R6: when the event cannot be written, nothing is created, deleted or emailed", async () => {
    const sent: MailMessage[] = [];
    setMailTransport(async (message) => {
      sent.push(message);
    });
    const { request, db } = await createTestContext();
    await db.run(sql`DROP TABLE audit_events`);
    expect((await request("POST", "/api/projects/prj_app/tasks", { ...admin, body: { title: "Ghost", assigneeId: "usr_bob" } })).status).toBe(500);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...admin, body: { assigneeId: "usr_bob" } })).status).toBe(500);
    expect((await request("DELETE", "/api/tasks/tsk_5", admin)).status).toBe(500);
    const tasks = await db.all<{ id: string; assignee_id: string | null }>(sql`SELECT id, assignee_id FROM tasks WHERE project_id IN ('prj_app', 'prj_billing') ORDER BY id`);
    expect(tasks).toEqual([
      { id: "tsk_4", assignee_id: null },
      { id: "tsk_5", assignee_id: null },
    ]);
    expect(sent).toEqual([]);
  });

  it("R8: members cannot read the log", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/audit-events", member);
    expect(response.status).toBe(403);
    expect(await json(response)).toMatchObject({ code: "forbidden" });
  });

  it("R8: admins see only their own organization's events", async () => {
    const { request } = await createTestContext();
    expect((await request("PATCH", "/api/tasks/tsk_6", { ...globex, body: { title: "Rotate secrets" } })).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...admin, body: { title: "Push" } })).status).toBe(200);
    expect((await events(request)).map((event) => event.entityId)).toEqual(["tsk_4"]);
    expect((await events(request, "", globex)).map((event) => event.entityId)).toEqual(["tsk_6"]);
  });

  it("R9: action, entityType, entityId and actorId filters combine with AND", async () => {
    const { request } = await createTestContext();
    expect((await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { title: "A" } })).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...admin, body: { title: "B" } })).status).toBe(200);
    expect((await request("POST", "/api/projects", { ...admin, body: { name: "Docs" } })).status).toBe(201);
    expect((await events(request, "?action=task.updated")).map((event) => event.entityId)).toEqual(["tsk_4", "tsk_3"]);
    expect((await events(request, "?entityType=project")).map((event) => event.action)).toEqual(["project.created"]);
    expect((await events(request, "?entityId=tsk_3")).map((event) => event.actorId)).toEqual(["usr_bob"]);
    expect((await events(request, "?actorId=usr_ada&action=task.updated")).map((event) => event.entityId)).toEqual(["tsk_4"]);
    expect(await events(request, "?actorId=usr_bob&entityType=project")).toEqual([]);
  });

  it("R9: since is inclusive and until exclusive", async () => {
    const { request } = await createTestContext();
    expect((await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { title: "A" } })).status).toBe(200);
    const [event] = await events(request);
    const at = encodeURIComponent(event!.createdAt);
    expect(await events(request, `?since=${at}`)).toHaveLength(1);
    expect(await events(request, `?until=${at}`)).toHaveLength(0);
    const later = encodeURIComponent(new Date(Date.parse(event!.createdAt) + 1).toISOString());
    expect(await events(request, `?since=${later}`)).toHaveLength(0);
    expect(await events(request, `?until=${later}`)).toHaveLength(1);
  });

  it("R9: since or until that are not date-times are 422", async () => {
    const { request } = await createTestContext();
    expect((await request("GET", "/api/audit-events?since=yesterday", admin)).status).toBe(422);
    expect((await request("GET", "/api/audit-events?until=2026-13-45T99:00:00Z", admin)).status).toBe(422);
  });

  it("R10: limit keeps the newest events and is bounded to 1..200", async () => {
    const { request } = await createTestContext();
    for (const title of ["A", "B", "C"]) {
      expect((await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { title } })).status).toBe(200);
    }
    const two = await events(request, "?limit=2");
    expect(two.map((event) => event.changes.title?.to)).toEqual(["C", "B"]);
    for (const limit of ["0", "201", "abc"]) {
      expect((await request("GET", `/api/audit-events?limit=${limit}`, admin)).status).toBe(422);
    }
  });

  it("R10: the default limit is 50", async () => {
    const { request } = await createTestContext();
    for (let index = 0; index < 52; index += 1) {
      expect((await request("PATCH", "/api/tasks/tsk_3", { ...member, body: { title: `Title ${index}` } })).status).toBe(200);
    }
    const items = await events(request);
    expect(items).toHaveLength(50);
    expect(items[0]?.changes.title?.to).toBe("Title 51");
  });
});
