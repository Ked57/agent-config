import { describe, expect, it } from "vitest";

import { projects } from "../db/schema";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

// K1: free organizations own at most 2 projects, pro at most 50; 403 { code: "plan_limit" } past
// the limit; GET /api/organization returns { plan, projectLimit, projectCount }.
const create = (
  request: Awaited<ReturnType<typeof createTestContext>>["request"],
  token: string,
  name: string,
) => request("POST", "/api/projects", { token, body: { name } });

describe("hidden: plan limits", () => {
  it("reports the organization's plan usage", async () => {
    const { request } = await createTestContext();
    const globex = await request("GET", "/api/organization", { token: SEED_TOKENS.globexAdmin });
    expect(globex.status).toBe(200);
    expect(await globex.json()).toEqual({ plan: "free", projectLimit: 2, projectCount: 1 });
    const acme = await request("GET", "/api/organization", { token: SEED_TOKENS.acmeMember });
    expect(await acme.json()).toEqual({ plan: "pro", projectLimit: 50, projectCount: 3 });
    expect((await request("GET", "/api/organization")).status).toBe(401);
  });

  it("lets a free organization reach its limit and refuses the next project", async () => {
    const { request } = await createTestContext();
    const token = SEED_TOKENS.globexAdmin;
    expect((await create(request, token, "Second")).status).toBe(201);
    const refused = await create(request, token, "Third");
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "plan_limit", message: expect.any(String) });
    const listed = await request("GET", "/api/projects", { token });
    expect(((await listed.json()) as { items: unknown[] }).items).toHaveLength(2);
    const usage = await request("GET", "/api/organization", { token });
    expect(await usage.json()).toEqual({ plan: "free", projectLimit: 2, projectCount: 2 });
  });

  it("counts each organization's projects separately", async () => {
    const { request } = await createTestContext();
    expect((await create(request, SEED_TOKENS.globexAdmin, "Second")).status).toBe(201);
    expect((await create(request, SEED_TOKENS.globexAdmin, "Third")).status).toBe(403);
    for (const name of ["Docs", "Ops", "Legal"]) {
      expect((await create(request, SEED_TOKENS.acmeAdmin, name)).status).toBe(201);
    }
  });

  it("stops a pro organization at 50 projects", async () => {
    const { db, request } = await createTestContext();
    const token = SEED_TOKENS.acmeAdmin;
    const extra = Array.from({ length: 46 }, (_, index) => ({
      id: `prj_extra_${index}`,
      orgId: "org_acme",
      name: `Project ${index + 4}`,
    }));
    await db.insert(projects).values(extra);
    expect((await create(request, token, "Project 50")).status).toBe(201);
    const refused = await create(request, token, "Project 51");
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "plan_limit" });
  });
});
