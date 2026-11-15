import { describe, expect, it } from "vitest";

import { tasks } from "../db/schema";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Page = { items: Array<{ id: string; status: string; assigneeId: string | null }>; nextCursor: string | null };

async function setup() {
  const context = await createTestContext();
  const base = Date.parse("2026-11-01T00:00:00Z");
  await context.db.insert(tasks).values(
    Array.from({ length: 45 }, (_, index) => ({
      id: `tsk_bulk_${String(index).padStart(2, "0")}`,
      orgId: "org_acme",
      projectId: "prj_app",
      title: `Bulk ${index}`,
      status: index % 3 === 0 ? ("done" as const) : ("todo" as const),
      assigneeId: index % 5 === 0 ? "usr_bob" : null,
      createdAt: new Date(base + index * 1000),
      updatedAt: new Date(base + index * 1000),
    })),
  );
  return context;
}

describe("hidden: task pagination and filters", () => {
  it("pages through every task exactly once in creation order", async () => {
    const { request } = await setup();
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query: string = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      const response = await request("GET", `/api/projects/prj_app/tasks${query}`, { token: SEED_TOKENS.acmeAdmin });
      expect(response.status).toBe(200);
      const page = (await response.json()) as Page;
      expect(page.items.length).toBeLessThanOrEqual(20);
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(seen).toHaveLength(46);
    expect(new Set(seen).size).toBe(46);
    expect(seen[0]).toBe("tsk_4");
    expect(seen.slice(1)).toEqual(Array.from({ length: 45 }, (_, index) => `tsk_bulk_${String(index).padStart(2, "0")}`));
  });

  it("honours limit and caps it", async () => {
    const { request } = await setup();
    const small = (await (await request("GET", "/api/projects/prj_app/tasks?limit=5", { token: SEED_TOKENS.acmeAdmin })).json()) as Page;
    expect(small.items).toHaveLength(5);
    expect(small.nextCursor).not.toBeNull();
    const huge = await request("GET", "/api/projects/prj_app/tasks?limit=500", { token: SEED_TOKENS.acmeAdmin });
    if (huge.status === 200) expect(((await huge.json()) as Page).items.length).toBeLessThanOrEqual(100);
    else {
      expect(huge.status).toBeGreaterThanOrEqual(400);
      expect(huge.status).toBeLessThan(500);
    }
  });

  it("filters by status and assignee", async () => {
    const { request } = await setup();
    const done = (await (await request("GET", "/api/projects/prj_app/tasks?status=done&limit=100", { token: SEED_TOKENS.acmeAdmin })).json()) as Page;
    expect(done.items).toHaveLength(15);
    expect(done.items.every((item) => item.status === "done")).toBe(true);
    const bob = (await (await request("GET", "/api/projects/prj_app/tasks?assigneeId=usr_bob&limit=100", { token: SEED_TOKENS.acmeAdmin })).json()) as Page;
    expect(bob.items).toHaveLength(9);
    expect(bob.nextCursor).toBeNull();
  });
});
