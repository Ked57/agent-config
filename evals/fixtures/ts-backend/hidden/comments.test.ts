import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("hidden: task comments", () => {
  it("creates comments and lists them oldest first", async () => {
    const { request } = await createTestContext();
    const first = await request("POST", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeAdmin, body: { body: "First!" } });
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ taskId: "tsk_2", authorId: "usr_ada", body: "First!" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await request("POST", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeMember, body: { body: "Second" } });
    const list = await request("GET", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeMember });
    expect(list.status).toBe(200);
    const { items } = (await list.json()) as { items: Array<{ body: string; authorId: string; id: string; createdAt: string }> };
    expect(items.map((item) => item.body)).toEqual(["First!", "Second"]);
    expect(items[1]?.authorId).toBe("usr_bob");
    expect(typeof items[0]?.id).toBe("string");
  });

  it("validates the comment body", async () => {
    const { request } = await createTestContext();
    for (const body of ["", "   ", "x".repeat(2001)]) {
      const response = await request("POST", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeAdmin, body: { body } });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }
    const ok = await request("POST", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeAdmin, body: { body: "x".repeat(2000) } });
    expect(ok.status).toBe(201);
  });

  it("keeps comments inside the task's organization", async () => {
    const { request } = await createTestContext();
    expect((await request("POST", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.globexAdmin, body: { body: "hi" } })).status).toBe(404);
    expect((await request("GET", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.globexAdmin })).status).toBe(404);
    expect((await request("GET", "/api/tasks/nope/comments", { token: SEED_TOKENS.acmeAdmin })).status).toBe(404);
    expect((await request("GET", "/api/tasks/tsk_2/comments")).status).toBe(401);
  });
});
