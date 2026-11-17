import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("attachments", () => {
  it("registers an upload and returns a signed URL", async () => {
    const { json } = await createTestContext();
    const created = await json<{ id: string; uploadUrl: string }>(
      "POST",
      "/api/tasks/tsk_3/attachments",
      {
        token: SEED_TOKENS.acmeMember,
        body: {
          filename: "trace.har",
          contentType: "application/json",
          sizeBytes: 1200,
        },
      },
    );
    expect(created.status).toBe(201);
    expect(created.body.uploadUrl).toMatch(/sig=[0-9a-f]{32}$/);
    const detail = await json("GET", `/api/attachments/${created.body.id}`, {
      token: SEED_TOKENS.acmeMember,
    });
    expect(detail.body).toMatchObject({
      filename: "trace.har",
      taskId: "tsk_3",
    });
  });

  it("lists a task's attachments", async () => {
    const { json } = await createTestContext();
    const { body } = await json<{ items: { id: string }[] }>(
      "GET",
      "/api/tasks/tsk_2/attachments",
      { token: SEED_TOKENS.acmeAdmin },
    );
    expect(body.items.map((item) => item.id)).toEqual(["att_acme"]);
  });
});
