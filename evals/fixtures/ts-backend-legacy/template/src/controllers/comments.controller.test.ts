import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("comments", () => {
  it("adds and lists comments on a task", async () => {
    const { json } = await createTestContext();
    const created = await json("POST", "/api/tasks/tsk_2/comments", {
      token: SEED_TOKENS.acmeMember,
      body: { body: "  Looks good  " },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      body: "Looks good",
      authorName: "Bob Builder",
    });
    const { body } = await json<{ items: unknown[] }>(
      "GET",
      "/api/tasks/tsk_2/comments",
      {
        token: SEED_TOKENS.acmeMember,
      },
    );
    expect(body.items).toHaveLength(2);
  });

  it("validates the body", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/tasks/tsk_2/comments", {
      token: SEED_TOKENS.acmeMember,
      body: { body: "   " },
    });
    expect(response.status).toBe(400);
  });
});
