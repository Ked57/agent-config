import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Project = { id: string; name: string; taskCount: number };

describe("projects", () => {
  it("lists the org's projects by name with task counts", async () => {
    const { json } = await createTestContext();
    const { body } = await json<{ items: Project[] }>("GET", "/api/projects", {
      token: SEED_TOKENS.acmeMember,
    });
    expect(body.items.map((p) => [p.name, p.taskCount])).toEqual([
      ["Internal", 1],
      ["Mobile app", 1],
      ["Website relaunch", 3],
    ]);
  });

  it("lets admins create projects", async () => {
    const { json } = await createTestContext();
    const created = await json("POST", "/api/projects", {
      token: SEED_TOKENS.acmeAdmin,
      body: {
        name: "  Brand refresh ",
        hourlyRateCents: 9500,
        clientId: "cli_initech",
      },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: "Brand refresh",
      hourlyRateCents: 9500,
    });
  });

  it("refuses members and foreign clients", async () => {
    const { request } = await createTestContext();
    const member = await request("POST", "/api/projects", {
      token: SEED_TOKENS.acmeMember,
      body: { name: "Nope" },
    });
    expect(member.status).toBe(403);
    const foreign = await request("POST", "/api/projects", {
      token: SEED_TOKENS.acmeAdmin,
      body: { name: "Nope", clientId: "cli_umbrella" },
    });
    expect(foreign.status).toBe(400);
  });

  it("hides other organizations' projects", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/projects/prj_infra", {
      token: SEED_TOKENS.acmeAdmin,
    });
    expect(response.status).toBe(404);
    const tasks = await request("GET", "/api/projects/prj_infra/tasks", {
      token: SEED_TOKENS.acmeAdmin,
    });
    expect(tasks.status).toBe(404);
  });

  it("lists a project's tasks oldest first with labels", async () => {
    const { json } = await createTestContext();
    const { body } = await json<{ items: { id: string; labels: string[] }[] }>(
      "GET",
      "/api/projects/prj_web/tasks",
      { token: SEED_TOKENS.acmeAdmin },
    );
    expect(body.items.map((task) => task.id)).toEqual([
      "tsk_1",
      "tsk_2",
      "tsk_3",
    ]);
    expect(body.items[1]?.labels).toEqual(["Design", "frontend"]);
  });
});
