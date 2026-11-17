import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("projects", () => {
  it("lists the organization's projects with task counts", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/projects", {
      token: SEED_TOKENS.acmeAdmin,
    });
    expect(response.status).toBe(200);
    const { items } = (await response.json()) as {
      items: Array<{ id: string; taskCounts: Record<string, number> }>;
    };
    expect(items.map((item) => item.id)).toEqual([
      "prj_billing",
      "prj_app",
      "prj_web",
    ]);
    expect(items.find((item) => item.id === "prj_web")?.taskCounts).toEqual({
      todo: 1,
      in_progress: 1,
      done: 1,
    });
  });

  it("creates a project and validates the name", async () => {
    const { request } = await createTestContext();
    const created = await request("POST", "/api/projects", {
      token: SEED_TOKENS.acmeAdmin,
      body: { name: "Docs" },
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      name: "Docs",
      orgId: "org_acme",
    });
    const invalid = await request("POST", "/api/projects", {
      token: SEED_TOKENS.acmeAdmin,
      body: { name: "" },
    });
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    expect(invalid.status).toBeLessThan(500);
  });

  it("hides other organizations' projects", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/projects/prj_web", {
      token: SEED_TOKENS.globexAdmin,
    });
    expect(response.status).toBe(404);
  });

  it("lists a project's tasks in creation order", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/projects/prj_web/tasks", {
      token: SEED_TOKENS.acmeMember,
    });
    const { items } = (await response.json()) as {
      items: Array<{ id: string }>;
    };
    expect(items.map((item) => item.id)).toEqual(["tsk_1", "tsk_2", "tsk_3"]);
  });
});
