import { afterEach, describe, expect, it } from "vitest";

import { setMailTransport } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

afterEach(() => setMailTransport(async () => undefined));

async function expectError(response: Response, status: number, code?: string) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type") ?? "").toContain("application/json");
  const body = (await response.json()) as { error?: { code?: unknown; message?: unknown } };
  expect(typeof body.error?.code).toBe("string");
  expect(typeof body.error?.message).toBe("string");
  if (code) expect(body.error?.code).toBe(code);
  return body;
}

const admin = { token: SEED_TOKENS.acmeAdmin };
const member = { token: SEED_TOKENS.acmeMember };

describe("hidden: structured error responses", { timeout: 30_000 }, () => {
  it("400 validation_error for a schema violation", async () => {
    const { request } = await createTestContext();
    await expectError(await request("POST", "/api/projects", { ...admin, body: { name: "" } }), 400, "validation_error");
  });

  it("400 validation_error for malformed JSON", async () => {
    const { app } = await createTestContext();
    const response = await app.handle(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { authorization: `Bearer ${SEED_TOKENS.acmeAdmin}`, "content-type": "application/json" },
        body: "{",
      }),
    );
    await expectError(response, 400, "validation_error");
  });

  it("400 validation_error for a rule checked in the handler (blank title)", async () => {
    const { request } = await createTestContext();
    await expectError(await request("PATCH", "/api/tasks/tsk_3", { ...admin, body: { title: "   " } }), 400, "validation_error");
  });

  it("401 without a token and with an unknown token", async () => {
    const { request } = await createTestContext();
    await expectError(await request("GET", "/api/me"), 401);
    await expectError(await request("GET", "/api/me", { token: "bogus" }), 401);
  });

  it("401 for a wrong password", async () => {
    const { request } = await createTestContext();
    await expectError(await request("POST", "/api/auth/token", { body: { email: "ada@acme.test", password: "wrong" } }), 401);
  });

  it("401 for a wrong webhook secret", async () => {
    const { request } = await createTestContext();
    const body = { id: "e", type: "x", data: { orgId: "o" } };
    await expectError(await request("POST", "/api/webhooks/billing", { body, headers: { "x-webhook-secret": "wrong" } }), 401);
  });

  it("403 when a member deletes a task", async () => {
    const { request } = await createTestContext();
    await expectError(await request("DELETE", "/api/tasks/tsk_4", member), 403);
  });

  it("403 when a member reopens a finished task", async () => {
    const { request } = await createTestContext();
    await expectError(await request("PATCH", "/api/tasks/tsk_1", { ...member, body: { status: "todo" } }), 403);
  });

  it("404 for an unknown project", async () => {
    const { request } = await createTestContext();
    await expectError(await request("GET", "/api/projects/nope", admin), 404);
    await expectError(await request("GET", "/api/projects/nope/tasks", admin), 404);
    await expectError(await request("POST", "/api/projects/nope/tasks", { ...admin, body: { title: "x" } }), 404);
  });

  it("404 for an unknown task", async () => {
    const { request } = await createTestContext();
    await expectError(await request("GET", "/api/tasks/nope", admin), 404);
    await expectError(await request("PATCH", "/api/tasks/nope", { ...admin, body: { title: "x" } }), 404);
    await expectError(await request("DELETE", "/api/tasks/nope", admin), 404);
  });

  it("404 for an unknown route", async () => {
    const { request } = await createTestContext();
    await expectError(await request("GET", "/api/definitely-not-a-route"), 404);
  });

  it("409 for a conflicting update", async () => {
    const { request } = await createTestContext();
    await expectError(await request("PATCH", "/api/tasks/tsk_4", { ...member, body: { status: "done" } }), 409);
  });

  it("500 without leaking internal error messages", async () => {
    setMailTransport(async () => {
      throw new Error("SMTP relay secret-hostname-42 refused connection");
    });
    const { request } = await createTestContext();
    const response = await request("POST", "/api/projects/prj_app/tasks", { ...admin, body: { title: "x", assigneeId: "usr_bob" } });
    const body = await expectError(response, 500);
    expect(JSON.stringify(body)).not.toContain("secret-hostname-42");
  });
});
