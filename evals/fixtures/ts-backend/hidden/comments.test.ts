import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

/** The prompt asks for createdAt without fixing its format: accept an ISO string or epoch milliseconds. */
const isTimestamp = (value: unknown) =>
  (typeof value === "string" || typeof value === "number") && value !== "" && !Number.isNaN(new Date(value).getTime());

describe("hidden: task comments", { timeout: 30_000 }, () => {
  it("creates comments and lists them oldest first", async () => {
    const { request } = await createTestContext();
    const first = await request("POST", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeAdmin, body: { body: "First!" } });
    expect(first.status).toBe(201);
    const created = (await first.json()) as Record<string, unknown>;
    expect(created).toMatchObject({ taskId: "tsk_2", authorId: "usr_ada", body: "First!" });
    expect(typeof created.id).toBe("string");
    expect(isTimestamp(created.createdAt)).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await request("POST", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeMember, body: { body: "Second" } });
    // A comment on another task of the same organization must not show up in this task's list.
    expect((await request("POST", "/api/tasks/tsk_3/comments", { token: SEED_TOKENS.acmeAdmin, body: { body: "Elsewhere" } })).status).toBe(201);
    const list = await request("GET", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeMember });
    expect(list.status).toBe(200);
    const { items } = (await list.json()) as { items: Array<{ body: string; authorId: string; id: string; taskId: string; createdAt: unknown }> };
    expect(items.map((item) => item.body)).toEqual(["First!", "Second"]);
    expect(items[1]?.authorId).toBe("usr_bob");
    expect(items[0]?.id).toBe(created.id);
    expect(items.every((item) => item.taskId === "tsk_2" && isTimestamp(item.createdAt))).toBe(true);
    const other = (await (await request("GET", "/api/tasks/tsk_3/comments", { token: SEED_TOKENS.acmeAdmin })).json()) as { items: Array<{ body: string }> };
    expect(other.items.map((item) => item.body)).toEqual(["Elsewhere"]);
    const none = (await (await request("GET", "/api/tasks/tsk_1/comments", { token: SEED_TOKENS.acmeAdmin })).json()) as { items: unknown[] };
    expect(none.items).toEqual([]);
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
    // The limit applies after trimming, so surrounding whitespace does not count.
    const padded = await request("POST", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeAdmin, body: { body: `  ${"x".repeat(2000)}  ` } });
    expect(padded.status).toBe(201);
    const list = (await (await request("GET", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeAdmin })).json()) as { items: unknown[] };
    expect(list.items).toHaveLength(2);
  });

  it("keeps comments inside the task's organization", async () => {
    const { request } = await createTestContext();
    expect((await request("POST", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.globexAdmin, body: { body: "hi" } })).status).toBe(404);
    expect((await request("GET", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.globexAdmin })).status).toBe(404);
    expect((await request("GET", "/api/tasks/nope/comments", { token: SEED_TOKENS.acmeAdmin })).status).toBe(404);
    expect((await request("GET", "/api/tasks/tsk_2/comments")).status).toBe(401);
    expect((await request("POST", "/api/tasks/tsk_2/comments", { body: { body: "hi" } })).status).toBe(401);
    // The rejected cross-organization comment was not stored.
    const list = (await (await request("GET", "/api/tasks/tsk_2/comments", { token: SEED_TOKENS.acmeAdmin })).json()) as { items: unknown[] };
    expect(list.items).toEqual([]);
  });
});
