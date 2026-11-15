import { afterEach, describe, expect, it } from "vitest";

import { setMailTransport } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

afterEach(() => setMailTransport(async () => undefined));

describe("hidden: notifications do not fail requests", () => {
  it("creates and reassigns tasks while the mailer is down", async () => {
    setMailTransport(async () => {
      throw new Error("mail provider unavailable");
    });
    const { request } = await createTestContext();
    const created = await request("POST", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin, body: { title: "Ship it", assigneeId: "usr_bob" } });
    expect(created.status).toBe(201);
    const reassigned = await request("PATCH", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin, body: { assigneeId: "usr_ada" } });
    expect(reassigned.status).toBe(200);
  });

  // "Send these notifications from a background job": the response must not wait for the mail
  // provider. Wrapping the inline send in try/catch satisfies the test above but not this one.
  it("answers before a slow mailer has finished", { timeout: 20_000 }, async () => {
    let started = 0;
    let finished = 0;
    setMailTransport(async () => {
      started += 1;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      finished += 1;
    });
    const { request } = await createTestContext();
    const created = await request("POST", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin, body: { title: "Ship it", assigneeId: "usr_bob" } });
    expect(created.status).toBe(201);
    expect(finished).toBe(0);
    const reassigned = await request("PATCH", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin, body: { assigneeId: "usr_ada" } });
    expect(reassigned.status).toBe(200);
    expect(finished).toBe(0);
    // Let the sends that did start finish, so no job outlives the test with a live transport.
    const deadline = Date.now() + 8_000;
    while (finished < started && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  });
});
