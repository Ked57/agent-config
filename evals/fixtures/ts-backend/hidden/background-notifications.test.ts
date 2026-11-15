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
});
