import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { hashPassword } from "../lib/passwords";
import { hashToken } from "../lib/tokens";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;

const VIEWER_TOKEN = "hidden-acme-viewer-token";
const viewer = { token: VIEWER_TOKEN };
const admin = { token: SEED_TOKENS.acmeAdmin };
const member = { token: SEED_TOKENS.acmeMember };

/** Seed plus usr_vic, a viewer in org_acme with a long-lived token and the password "viewer-pass". */
async function setup() {
  const context = await createTestContext();
  const now = Date.now();
  await context.db.run(sql`INSERT INTO users (id, org_id, email, name, password_hash, role, created_at) VALUES ('usr_vic', 'org_acme', 'vic@acme.test', 'Vic Viewer', ${hashPassword("viewer-pass")}, 'viewer', ${now})`);
  await context.db.run(sql`INSERT INTO api_tokens (id, user_id, token_hash, expires_at, created_at) VALUES ('tok_vic', 'usr_vic', ${hashToken(VIEWER_TOKEN)}, ${now + 86_400_000}, ${now})`);
  return context;
}

async function addAdmin(db: Context["db"], id: string, token: string) {
  const now = Date.now();
  await db.run(sql`INSERT INTO users (id, org_id, email, name, password_hash, role, created_at) VALUES (${id}, 'org_acme', ${`${id}@acme.test`}, ${id}, 'x', 'admin', ${now})`);
  await db.run(sql`INSERT INTO api_tokens (id, user_id, token_hash, expires_at, created_at) VALUES (${`tok_${id}`}, ${id}, ${hashToken(token)}, ${now + 86_400_000}, ${now})`);
}

const row = async (db: Context["db"], query: ReturnType<typeof sql>) => (await db.all<Record<string, unknown>>(query))[0];
const roleOf = async (db: Context["db"], id: string) => (await row(db, sql`SELECT role FROM users WHERE id = ${id}`))?.role;
const adminCount = async (db: Context["db"]) => Number((await row(db, sql`SELECT count(*) AS n FROM users WHERE org_id = 'org_acme' AND role = 'admin'`))?.n);
const setRole = (request: Context["request"], token: string, id: string, role: string) => request("PATCH", `/api/users/${id}`, { token, body: { role } });

describe("hidden: read-only viewer role", { timeout: 30_000 }, () => {
  it("lets viewers read projects, tasks and their own profile", async () => {
    const { request } = await setup();
    expect((await request("GET", "/api/projects", viewer)).status).toBe(200);
    expect((await request("GET", "/api/projects/prj_web", viewer)).status).toBe(200);
    expect((await request("GET", "/api/projects/prj_web/tasks", viewer)).status).toBe(200);
    expect((await request("GET", "/api/tasks/tsk_1", viewer)).status).toBe(200);
    const me = await request("GET", "/api/me", viewer);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ id: "usr_vic", role: "viewer" });
  });

  it("lets viewers log in with their password", async () => {
    const { request } = await setup();
    const login = await request("POST", "/api/auth/token", { body: { email: "vic@acme.test", password: "viewer-pass" } });
    expect(login.status).toBe(200);
    const { token } = (await login.json()) as { token: string };
    expect((await request("GET", "/api/projects", { token })).status).toBe(200);
  });

  it("refuses to let viewers create projects", async () => {
    const { request, db } = await setup();
    expect((await request("POST", "/api/projects", { ...viewer, body: { name: "Viewer project" } })).status).toBe(403);
    expect(await row(db, sql`SELECT count(*) AS n FROM projects`)).toEqual({ n: 4 });
  });

  it("refuses to let viewers create tasks", async () => {
    const { request, db } = await setup();
    expect((await request("POST", "/api/projects/prj_web/tasks", { ...viewer, body: { title: "Viewer task" } })).status).toBe(403);
    expect(await row(db, sql`SELECT count(*) AS n FROM tasks`)).toEqual({ n: 6 });
  });

  it("refuses every kind of task edit from a viewer and changes nothing", async () => {
    const { request, db } = await setup();
    const before = await row(db, sql`SELECT * FROM tasks WHERE id = 'tsk_3'`);
    for (const body of [{ title: "Viewer edit" }, { status: "in_progress" }, { isUrgent: false }, { assigneeId: "usr_bob" }, { dueDate: "2027-01-01" }, { description: "x" }]) {
      expect((await request("PATCH", "/api/tasks/tsk_3", { ...viewer, body })).status).toBe(403);
    }
    expect(await row(db, sql`SELECT * FROM tasks WHERE id = 'tsk_3'`)).toEqual(before);
  });

  it("refuses to let viewers delete tasks", async () => {
    const { request, db } = await setup();
    expect((await request("DELETE", "/api/tasks/tsk_3", viewer)).status).toBe(403);
    expect(await row(db, sql`SELECT count(*) AS n FROM tasks`)).toEqual({ n: 6 });
  });

  it("refuses to let viewers change roles", async () => {
    const { request, db } = await setup();
    expect((await setRole(request, VIEWER_TOKEN, "usr_bob", "viewer")).status).toBe(403);
    expect((await setRole(request, VIEWER_TOKEN, "usr_vic", "admin")).status).toBe(403);
    expect(await roleOf(db, "usr_bob")).toBe("member");
    expect(await roleOf(db, "usr_vic")).toBe("viewer");
  });

  it("rejects assigning a new task to a viewer with 400", async () => {
    const { request, db } = await setup();
    expect((await request("POST", "/api/projects/prj_web/tasks", { ...admin, body: { title: "For Vic", assigneeId: "usr_vic" } })).status).toBe(400);
    expect(await row(db, sql`SELECT count(*) AS n FROM tasks`)).toEqual({ n: 6 });
    expect((await request("POST", "/api/projects/prj_web/tasks", { ...admin, body: { title: "For Bob", assigneeId: "usr_bob" } })).status).toBe(201);
  });

  it("rejects reassigning a task to a viewer with 400", async () => {
    const { request, db } = await setup();
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...admin, body: { assigneeId: "usr_vic" } })).status).toBe(400);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...member, body: { assigneeId: "usr_vic", title: "Renamed" } })).status).toBe(400);
    expect(await row(db, sql`SELECT assignee_id, title FROM tasks WHERE id = 'tsk_4'`)).toEqual({ assignee_id: null, title: "Push notifications" });
  });

  it("lets admins change roles in their organization only", async () => {
    const { request, db } = await setup();
    const changed = await setRole(request, SEED_TOKENS.acmeAdmin, "usr_bob", "viewer");
    expect(changed.status).toBe(200);
    expect(await changed.json()).toEqual({ id: "usr_bob", role: "viewer" });
    expect(await roleOf(db, "usr_bob")).toBe("viewer");
    expect((await setRole(request, SEED_TOKENS.acmeAdmin, "usr_vic", "member")).status).toBe(200);
    expect((await setRole(request, SEED_TOKENS.acmeAdmin, "usr_gina", "member")).status).toBe(404);
    expect(await roleOf(db, "usr_gina")).toBe("admin");
    expect((await setRole(request, SEED_TOKENS.globexAdmin, "usr_bob", "admin")).status).toBe(404);
    const invalid = await setRole(request, SEED_TOKENS.acmeAdmin, "usr_vic", "owner");
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    expect(invalid.status).toBeLessThan(500);
  });

  it("refuses role changes from members", async () => {
    const { request, db } = await setup();
    expect((await setRole(request, SEED_TOKENS.acmeMember, "usr_bob", "admin")).status).toBe(403);
    expect((await setRole(request, SEED_TOKENS.acmeMember, "usr_vic", "member")).status).toBe(403);
    expect(await roleOf(db, "usr_bob")).toBe("member");
    expect(await roleOf(db, "usr_vic")).toBe("viewer");
  });

  it("applies a role change to the user's existing tokens immediately", async () => {
    const { request } = await setup();
    expect((await setRole(request, SEED_TOKENS.acmeAdmin, "usr_bob", "viewer")).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...member, body: { title: "Bob edits" } })).status).toBe(403);
    expect((await request("GET", "/api/tasks/tsk_4", member)).status).toBe(200);
    expect((await setRole(request, SEED_TOKENS.acmeAdmin, "usr_vic", "member")).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...viewer, body: { title: "Vic edits" } })).status).toBe(200);
  });

  it("answers 409 to a change that would leave the organization without an admin", async () => {
    const { request, db } = await setup();
    expect((await setRole(request, SEED_TOKENS.acmeAdmin, "usr_ada", "member")).status).toBe(409);
    expect((await setRole(request, SEED_TOKENS.acmeAdmin, "usr_ada", "viewer")).status).toBe(409);
    expect(await roleOf(db, "usr_ada")).toBe("admin");
    // With a second admin, stepping down is fine; then the remaining admin is protected.
    expect((await setRole(request, SEED_TOKENS.acmeAdmin, "usr_bob", "admin")).status).toBe(200);
    expect((await setRole(request, SEED_TOKENS.acmeAdmin, "usr_ada", "member")).status).toBe(200);
    expect((await setRole(request, SEED_TOKENS.acmeMember, "usr_bob", "viewer")).status).toBe(409);
    expect(await adminCount(db)).toBe(1);
  });

  it("keeps an admin when admins demote each other at the same time", async () => {
    for (let round = 0; round < 5; round += 1) {
      const { request, db } = await setup();
      await addAdmin(db, "usr_cleo", "hidden-cleo-token");
      expect(await adminCount(db)).toBe(2);
      const responses = await Promise.all([setRole(request, SEED_TOKENS.acmeAdmin, "usr_cleo", "member"), setRole(request, "hidden-cleo-token", "usr_ada", "member")]);
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses[0]).toBe(200);
      // The loser is refused: 409 as stated, or 403 if it noticed it had just lost admin rights.
      expect([403, 409]).toContain(statuses[1]);
      expect(await adminCount(db)).toBe(1);
    }
  });
});
