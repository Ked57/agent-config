import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { setMailTransport } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

// Hidden acceptance tests for spec #205 (docs/issues/205-api-keys.md).
// Seed: Ada (usr_ada) is an Acme admin, Bob (usr_bob) an Acme member, Gina a Globex admin.
// prj_app has tsk_4; prj_web has tsk_1..tsk_3.

afterEach(() => setMailTransport(async () => undefined));

type Context = Awaited<ReturnType<typeof createTestContext>>;
type Request = Context["request"];
type ApiKeyJson = {
  id: string;
  name: string;
  scopes: string[];
  prefix: string;
  key?: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

const admin = { token: SEED_TOKENS.acmeAdmin };
const member = { token: SEED_TOKENS.acmeMember };
const globex = { token: SEED_TOKENS.globexAdmin };

async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function createKey(request: Request, scopes: string[], extra: Record<string, unknown> = {}, as: { token: string } = admin) {
  const response = await request("POST", "/api/api-keys", { ...as, body: { name: `Key ${scopes.join("+")}`, scopes, ...extra } });
  expect(response.status).toBe(201);
  const body = await json<ApiKeyJson>(response);
  return { ...body, token: { token: body.key as string } };
}

async function listKeys(request: Request, as: { token: string } = admin) {
  const response = await request("GET", "/api/api-keys", as);
  expect(response.status).toBe(200);
  return (await json<{ items: ApiKeyJson[] }>(response)).items;
}

async function expectScopeError(response: Response, required: string) {
  expect(response.status).toBe(403);
  expect(await json(response)).toMatchObject({ code: "insufficient_scope", required });
}

describe("spec #205: API keys with scopes", () => {
  it("R1: an admin creates a key and sees it once, with its prefix and nullable timestamps", async () => {
    const { request } = await createTestContext();
    const created = await createKey(request, ["tasks:read"]);
    expect(created.key).toMatch(/^tk_[A-Za-z0-9_-]{32,}$/);
    expect(created.prefix).toBe(created.key?.slice(0, 11));
    expect(created).toMatchObject({ name: "Key tasks:read", scopes: ["tasks:read"], createdBy: "usr_ada", expiresAt: null, lastUsedAt: null, revokedAt: null });
    expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
  });

  it("R1: expiresInDays sets expiresAt that many days ahead", async () => {
    const { request } = await createTestContext();
    const created = await createKey(request, ["tasks:read"], { expiresInDays: 30 });
    const expected = Date.now() + 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(Date.parse(created.expiresAt ?? "") - expected)).toBeLessThan(60_000);
  });

  it("R1: invalid names, scopes and expiries are 422", async () => {
    const { request } = await createTestContext();
    for (const body of [
      { name: "x", scopes: ["tasks:delete"] },
      { name: "x", scopes: [] },
      { name: "x", scopes: ["tasks:read", "tasks:read"] },
      { name: "", scopes: ["tasks:read"] },
      { name: "x", scopes: ["tasks:read"], expiresInDays: 0 },
      { name: "x", scopes: ["tasks:read"], expiresInDays: 366 },
    ]) {
      expect((await request("POST", "/api/api-keys", { ...admin, body })).status).toBe(422);
    }
  });

  it("R2: only the SHA-256 hash of the key is stored", async () => {
    const { request, db } = await createTestContext();
    const created = await createKey(request, ["tasks:read"]);
    const rows = await db.all<Record<string, unknown>>(sql`SELECT * FROM api_keys`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key_hash).toBe(createHash("sha256").update(created.key as string).digest("hex"));
    expect(JSON.stringify(rows)).not.toContain(created.key as string);
  });

  it("R3: the list shows the organization's keys by name, without key or hash", async () => {
    const { request } = await createTestContext();
    const zulu = await request("POST", "/api/api-keys", { ...admin, body: { name: "Zulu", scopes: ["tasks:read"] } });
    const alpha = await request("POST", "/api/api-keys", { ...admin, body: { name: "Alpha", scopes: ["projects:read"] } });
    const theirs = await request("POST", "/api/api-keys", { ...globex, body: { name: "Globex", scopes: ["tasks:read"] } });
    const keys = [await json<ApiKeyJson>(zulu), await json<ApiKeyJson>(alpha), await json<ApiKeyJson>(theirs)].map((item) => item.key as string);
    const response = await request("GET", "/api/api-keys", admin);
    expect(response.status).toBe(200);
    const text = await response.text();
    const items = (JSON.parse(text) as { items: ApiKeyJson[] }).items;
    expect(items.map((item) => item.name)).toEqual(["Alpha", "Zulu"]);
    for (const item of items) expect(item).not.toHaveProperty("key");
    for (const key of keys) {
      expect(text).not.toContain(key);
      expect(text).not.toContain(createHash("sha256").update(key).digest("hex"));
    }
    expect(text).not.toMatch(/hash/i);
  });

  it("R4: members cannot create, list or revoke keys", async () => {
    const { request } = await createTestContext();
    const created = await createKey(request, ["tasks:read"]);
    for (const response of [
      await request("POST", "/api/api-keys", { ...member, body: { name: "Mine", scopes: ["tasks:read"] } }),
      await request("GET", "/api/api-keys", member),
      await request("DELETE", `/api/api-keys/${created.id}`, member),
    ]) {
      expect(response.status).toBe(403);
      expect(await json(response)).toMatchObject({ code: "forbidden" });
    }
    expect((await request("GET", "/api/tasks/tsk_4", created.token)).status).toBe(200);
  });

  it("R5/R6: a revoked key gets 401 and stays in the list with revokedAt", async () => {
    const { request } = await createTestContext();
    const created = await createKey(request, ["tasks:read"]);
    expect((await request("GET", "/api/tasks/tsk_4", created.token)).status).toBe(200);
    expect((await request("DELETE", `/api/api-keys/${created.id}`, admin)).status).toBe(204);
    expect((await request("GET", "/api/tasks/tsk_4", created.token)).status).toBe(401);
    const [listed] = await listKeys(request);
    expect(listed?.id).toBe(created.id);
    expect(typeof listed?.revokedAt).toBe("string");
  });

  it("R5: revoking twice is 409, and other organizations' or unknown keys are 404", async () => {
    const { request } = await createTestContext();
    const created = await createKey(request, ["tasks:read"]);
    const foreign = await request("DELETE", `/api/api-keys/${created.id}`, globex);
    expect(foreign.status).toBe(404);
    expect(await json(foreign)).toMatchObject({ code: "api_key_not_found" });
    expect((await request("GET", "/api/tasks/tsk_4", created.token)).status).toBe(200);
    const unknown = await request("DELETE", "/api/api-keys/key_nope", admin);
    expect(unknown.status).toBe(404);
    expect((await request("DELETE", `/api/api-keys/${created.id}`, admin)).status).toBe(204);
    const again = await request("DELETE", `/api/api-keys/${created.id}`, admin);
    expect(again.status).toBe(409);
    expect(await json(again)).toMatchObject({ code: "already_revoked" });
  });

  it("R6: a key acts in its creator's organization", async () => {
    const { request } = await createTestContext();
    const acme = await createKey(request, ["projects:read", "tasks:read"]);
    const projects = await json<{ items: Array<{ id: string }> }>(await request("GET", "/api/projects", acme.token));
    expect(projects.items.map((item) => item.id).sort()).toEqual(["prj_app", "prj_billing", "prj_web"]);
    const gina = await createKey(request, ["projects:read"], {}, globex);
    expect((await request("GET", "/api/projects/prj_web", gina.token)).status).toBe(404);
  });

  it("R6: unknown and expired keys get 401", async () => {
    const { request, db } = await createTestContext();
    expect((await request("GET", "/api/tasks/tsk_4", { token: "tk_doesnotexistdoesnotexistdoesnotexist" })).status).toBe(401);
    const created = await createKey(request, ["tasks:read"], { expiresInDays: 1 });
    expect((await request("GET", "/api/tasks/tsk_4", created.token)).status).toBe(200);
    await db.run(sql`UPDATE api_keys SET expires_at = ${Date.now() - 1000}`);
    expect((await request("GET", "/api/tasks/tsk_4", created.token)).status).toBe(401);
  });

  it("R7: a tasks:read key reads tasks but cannot write them or read projects", async () => {
    const { request } = await createTestContext();
    const { token } = await createKey(request, ["tasks:read"]);
    expect((await request("GET", "/api/tasks/tsk_4", token)).status).toBe(200);
    expect((await request("GET", "/api/projects/prj_app/tasks", token)).status).toBe(200);
    await expectScopeError(await request("PATCH", "/api/tasks/tsk_4", { ...token, body: { title: "Nope" } }), "tasks:write");
    await expectScopeError(await request("POST", "/api/projects/prj_app/tasks", { ...token, body: { title: "Nope" } }), "tasks:write");
    await expectScopeError(await request("GET", "/api/projects", token), "projects:read");
    await expectScopeError(await request("GET", "/api/projects/prj_app", token), "projects:read");
  });

  it("R7: tasks:write includes tasks:read", async () => {
    const { request } = await createTestContext();
    const { token } = await createKey(request, ["tasks:write"]);
    expect((await request("GET", "/api/tasks/tsk_4", token)).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...token, body: { title: "Push it" } })).status).toBe(200);
    expect((await request("POST", "/api/projects/prj_app/tasks", { ...token, body: { title: "From a script" } })).status).toBe(201);
    await expectScopeError(await request("POST", "/api/projects", { ...token, body: { name: "Nope" } }), "projects:write");
  });

  it("R7: projects:write includes projects:read but not tasks:read", async () => {
    const { request } = await createTestContext();
    const { token } = await createKey(request, ["projects:write"]);
    expect((await request("POST", "/api/projects", { ...token, body: { name: "Scripted" } })).status).toBe(201);
    expect((await request("GET", "/api/projects", token)).status).toBe(200);
    await expectScopeError(await request("GET", "/api/projects/prj_app/tasks", token), "tasks:read");
    await expectScopeError(await request("GET", "/api/tasks/tsk_4", token), "tasks:read");
  });

  it("R7: the scope is checked before the route looks anything up", async () => {
    const { request } = await createTestContext();
    const { token } = await createKey(request, ["projects:read"]);
    await expectScopeError(await request("GET", "/api/tasks/tsk_nope", token), "tasks:read");
    await expectScopeError(await request("DELETE", "/api/tasks/tsk_nope", token), "tasks:write");
  });

  it("R8: keys cannot manage keys, whatever their scopes", async () => {
    const { request } = await createTestContext();
    const created = await createKey(request, ["projects:read", "projects:write", "tasks:read", "tasks:write"]);
    for (const response of [
      await request("POST", "/api/api-keys", { ...created.token, body: { name: "Child", scopes: ["tasks:read"] } }),
      await request("GET", "/api/api-keys", created.token),
      await request("DELETE", `/api/api-keys/${created.id}`, created.token),
    ]) {
      expect(response.status).toBe(403);
      expect(await json(response)).toMatchObject({ code: "api_key_not_allowed" });
    }
    expect(await listKeys(request)).toHaveLength(1);
  });

  it("R9: /api/me reports the key, or null for a login token", async () => {
    const { request } = await createTestContext();
    const created = await createKey(request, ["tasks:read"]);
    const viaKey = await request("GET", "/api/me", created.token);
    expect(viaKey.status).toBe(200);
    expect(await json(viaKey)).toMatchObject({ id: "usr_ada", orgId: "org_acme", apiKey: { id: created.id, name: "Key tasks:read", scopes: ["tasks:read"] } });
    expect(await json(await request("GET", "/api/me", admin))).toMatchObject({ id: "usr_ada", apiKey: null });
  });

  it("R10: lastUsedAt is set on use, including requests refused for a scope", async () => {
    const { request, db } = await createTestContext();
    const created = await createKey(request, ["tasks:read"]);
    expect((await listKeys(request))[0]?.lastUsedAt).toBeNull();
    const before = Date.now();
    await expectScopeError(await request("GET", "/api/projects", created.token), "projects:read");
    const first = (await listKeys(request))[0]?.lastUsedAt;
    expect(Date.parse(first ?? "")).toBeGreaterThanOrEqual(before - 1000);
    await db.run(sql`UPDATE api_keys SET last_used_at = 1000`);
    expect((await request("GET", "/api/tasks/tsk_4", created.token)).status).toBe(200);
    expect(Date.parse((await listKeys(request))[0]?.lastUsedAt ?? "")).toBeGreaterThanOrEqual(before - 1000);
  });

  it("R11: deleting a task needs tasks:write and a creator who is an admin now", async () => {
    const { request, db } = await createTestContext();
    const { token } = await createKey(request, ["tasks:write"]);
    expect((await request("DELETE", "/api/tasks/tsk_5", token)).status).toBe(204);
    await db.run(sql`UPDATE users SET role = 'member' WHERE id = 'usr_ada'`);
    expect((await request("DELETE", "/api/tasks/tsk_4", token)).status).toBe(403);
    expect((await request("GET", "/api/tasks/tsk_4", token)).status).toBe(200);
  });

  it("R6/Decision 1: a deleted creator's keys stop working", async () => {
    const { request, db } = await createTestContext();
    const { token } = await createKey(request, ["tasks:read"]);
    await db.run(sql`DELETE FROM users WHERE id = 'usr_ada'`);
    expect((await request("GET", "/api/tasks/tsk_4", token)).status).toBe(401);
  });

  it("R12: login tokens are never scope-checked", async () => {
    const { request } = await createTestContext();
    expect((await request("GET", "/api/projects", member)).status).toBe(200);
    expect((await request("PATCH", "/api/tasks/tsk_4", { ...member, body: { title: "Still fine" } })).status).toBe(200);
    expect((await request("POST", "/api/projects", { ...admin, body: { name: "Still fine" } })).status).toBe(201);
    expect((await request("DELETE", "/api/tasks/tsk_4", admin)).status).toBe(204);
  });
});
