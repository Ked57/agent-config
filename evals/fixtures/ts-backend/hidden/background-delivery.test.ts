import { afterEach, describe, expect, it } from "vitest";

import { setMailTransport, type MailMessage } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

afterEach(() => setMailTransport(async () => undefined));

describe("hidden: notifications are retried in the background", () => {
  it("delivers after a transient failure without a separate worker process", { timeout: 20_000 }, async () => {
    let calls = 0;
    const delivered: MailMessage[] = [];
    setMailTransport(async (message) => {
      calls += 1;
      if (calls === 1) throw new Error("transient");
      delivered.push(message);
    });
    const { request } = await createTestContext();
    const created = await request("POST", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin, body: { title: "Retry me", assigneeId: "usr_bob" } });
    expect(created.status).toBe(201);
    const deadline = Date.now() + 15_000;
    while (delivered.length === 0 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 200));
    expect(delivered).toEqual([expect.objectContaining({ to: "bob@acme.test" })]);
  });
});
