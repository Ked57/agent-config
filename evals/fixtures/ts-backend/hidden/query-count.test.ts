import { describe, expect, it } from "vitest";

import { projects, tasks } from "../db/schema";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("hidden: project list query count", () => {
  it("uses a constant number of queries and keeps the response", async () => {
    let queries = 0;
    const context = await createTestContext({ logger: { logQuery: () => { queries += 1; } } });
    await context.db.insert(projects).values(
      Array.from({ length: 40 }, (_, index) => ({ id: `prj_bulk_${index}`, orgId: "org_acme", name: `Bulk ${String(index).padStart(2, "0")}` })),
    );
    await context.db.insert(tasks).values(
      Array.from({ length: 40 }, (_, index) => ({ id: `tsk_q_${index}`, orgId: "org_acme", projectId: `prj_bulk_${index}`, title: "t", status: index % 2 ? ("done" as const) : ("in_progress" as const) })),
    );
    queries = 0;
    const response = await context.request("GET", "/api/projects", { token: SEED_TOKENS.acmeAdmin });
    expect(response.status).toBe(200);
    expect(queries).toBeLessThanOrEqual(4);
    const { items } = (await response.json()) as { items: Array<{ id: string; name: string; taskCounts: Record<string, number> }> };
    expect(items).toHaveLength(43);
    expect(items.map((item) => item.name)).toEqual([...items.map((item) => item.name)].sort());
    expect(items.find((item) => item.id === "prj_web")?.taskCounts).toEqual({ todo: 1, in_progress: 1, done: 1 });
    expect(items.find((item) => item.id === "prj_bulk_1")?.taskCounts).toEqual({ todo: 0, in_progress: 0, done: 1 });
    expect(items.find((item) => item.id === "prj_bulk_2")?.taskCounts).toEqual({ todo: 0, in_progress: 1, done: 0 });
    expect(items.find((item) => item.id === "prj_app")?.taskCounts).toEqual({ todo: 1, in_progress: 0, done: 0 });
  });
});
