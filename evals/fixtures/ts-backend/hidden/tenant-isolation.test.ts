import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("hidden: tenant isolation on tasks", () => {
  it("hides other organizations' tasks on every task endpoint", async () => {
    const { request } = await createTestContext();
    expect((await request("GET", "/api/tasks/tsk_1", { token: SEED_TOKENS.globexAdmin })).status).toBe(404);
    expect((await request("PATCH", "/api/tasks/tsk_1", { token: SEED_TOKENS.globexAdmin, body: { title: "pwned" } })).status).toBe(404);
    expect((await request("DELETE", "/api/tasks/tsk_1", { token: SEED_TOKENS.globexAdmin })).status).toBe(404);
    const own = await request("GET", "/api/tasks/tsk_1", { token: SEED_TOKENS.acmeMember });
    expect(own.status).toBe(200);
    expect(((await own.json()) as { title: string }).title).toBe("Pick a CMS");
  });
});
