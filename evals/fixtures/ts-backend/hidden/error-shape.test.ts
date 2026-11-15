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

describe("hidden: structured error responses", () => {
  it("uses one error shape for every failure class", async () => {
    const { request } = await createTestContext();
    await expectError(await request("POST", "/api/projects", { token: SEED_TOKENS.acmeAdmin, body: { name: "" } }), 400, "validation_error");
    await expectError(await request("GET", "/api/me"), 401);
    await expectError(await request("GET", "/api/me", { token: "bogus" }), 401);
    await expectError(await request("GET", "/api/projects/nope", { token: SEED_TOKENS.acmeAdmin }), 404);
    await expectError(await request("GET", "/api/definitely-not-a-route"), 404);
    await expectError(await request("DELETE", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeMember }), 403);
    await expectError(await request("PATCH", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeMember, body: { status: "done" } }), 409);
    await expectError(await request("POST", "/api/webhooks/billing", { body: { id: "e", type: "x", data: { orgId: "o" } }, headers: { "x-webhook-secret": "wrong" } }), 401);
  });

  it("rejects malformed JSON as a validation error", async () => {
    const { app } = await createTestContext();
    const response = await app.handle(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { authorization: `Bearer ${SEED_TOKENS.acmeAdmin}`, "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(typeof body.error?.code).toBe("string");
  });

  it("returns 500 without leaking internal error messages", async () => {
    setMailTransport(async () => {
      throw new Error("SMTP relay secret-hostname-42 refused connection");
    });
    const { request } = await createTestContext();
    const response = await request("POST", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin, body: { title: "x", assigneeId: "usr_bob" } });
    const body = await expectError(response, 500);
    expect(JSON.stringify(body)).not.toContain("secret-hostname-42");
  });
});
