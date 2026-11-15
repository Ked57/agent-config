import { afterEach, describe, expect, it } from "vitest";

import { setMailTransport, type MailMessage } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

afterEach(() => setMailTransport(async () => undefined));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    while (delivered.length === 0 && Date.now() < deadline) await sleep(200);
    expect(delivered).toEqual([expect.objectContaining({ to: "bob@acme.test" })]);
  });

  it("sends exactly one email per assignment when the mailer works", { timeout: 20_000 }, async () => {
    const delivered: MailMessage[] = [];
    setMailTransport(async (message) => {
      delivered.push(message);
    });
    const { request } = await createTestContext();
    const created = await request("POST", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin, body: { title: "Once", assigneeId: "usr_bob" } });
    expect(created.status).toBe(201);
    const reassigned = await request("PATCH", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin, body: { assigneeId: "usr_ada" } });
    expect(reassigned.status).toBe(200);
    const deadline = Date.now() + 10_000;
    while (delivered.length < 2 && Date.now() < deadline) await sleep(200);
    // Long enough for a duplicate (an immediate send plus a queued one, or a needless retry) to show up.
    await sleep(3_000);
    expect(delivered.map((message) => message.to).sort()).toEqual(["ada@acme.test", "bob@acme.test"]);
  });

  // "retried with exponential backoff starting at about a second (up to 5 attempts)": with a
  // mailer that never recovers there are exactly 5 attempts, the first retry comes about a
  // second after the first attempt, and every wait is clearly longer than the one before.
  it("backs off exponentially from about a second and gives up after 5 attempts", { timeout: 90_000 }, async () => {
    const attempts: number[] = [];
    setMailTransport(async () => {
      attempts.push(Date.now());
      throw new Error("mail provider unavailable");
    });
    const { request } = await createTestContext();
    const created = await request("POST", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin, body: { title: "Never delivered", assigneeId: "usr_bob" } });
    expect(created.status).toBe(201);
    const deadline = Date.now() + 40_000;
    while (attempts.length < 5 && Date.now() < deadline) await sleep(200);
    expect(attempts.length).toBe(5);
    const waits = attempts.slice(1).map((time, index) => time - (attempts[index] ?? time));
    expect(waits[0]).toBeGreaterThanOrEqual(500);
    expect(waits[0]).toBeLessThanOrEqual(3_000);
    for (let index = 1; index < waits.length; index += 1) expect(waits[index]).toBeGreaterThan((waits[index - 1] ?? 0) * 1.15);
    // A sixth attempt would come after roughly twice the last wait.
    await sleep((waits[3] ?? 8_000) * 2 + 3_000);
    expect(attempts.length).toBe(5);
  });
});
