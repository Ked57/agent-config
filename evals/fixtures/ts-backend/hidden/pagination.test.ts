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
    const { request, db } = await setup();
    const small = (await (await request("GET", "/api/projects/prj_app/tasks?limit=5", { token: SEED_TOKENS.acmeAdmin })).json()) as Page;
    expect(small.items).toHaveLength(5);
    expect(small.nextCursor).not.toBeNull();
    const next = (await (await request("GET", `/api/projects/prj_app/tasks?limit=5&cursor=${encodeURIComponent(small.nextCursor ?? "")}`, { token: SEED_TOKENS.acmeAdmin })).json()) as Page;
    expect([...small.items, ...next.items].map((item) => item.id)).toEqual(["tsk_4", ...Array.from({ length: 9 }, (_, index) => `tsk_bulk_0${index}`)]);
    // More than 100 tasks, so a missing cap is visible: 46 + 80 = 126.
    const base = Date.parse("2026-11-02T00:00:00Z");
    await db.insert(tasks).values(
      Array.from({ length: 80 }, (_, index) => ({ id: `tsk_more_${String(index).padStart(2, "0")}`, orgId: "org_acme", projectId: "prj_app", title: `More ${index}`, createdAt: new Date(base + index * 1000), updatedAt: new Date(base + index * 1000) })),
    );
    const max = await request("GET", "/api/projects/prj_app/tasks?limit=100", { token: SEED_TOKENS.acmeAdmin });
    expect(max.status).toBe(200);
    const maxPage = (await max.json()) as Page;
    expect(maxPage.items).toHaveLength(100);
    expect(maxPage.nextCursor).not.toBeNull();
    // Over the maximum: either clamp to 100 or reject the request, but never return more than 100.
    const huge = await request("GET", "/api/projects/prj_app/tasks?limit=500", { token: SEED_TOKENS.acmeAdmin });
    if (huge.status === 200) expect(((await huge.json()) as Page).items).toHaveLength(100);
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

  it("applies filters before paging", async () => {
    const { request } = await setup();
    const expected = Array.from({ length: 45 }, (_, index) => index).filter((index) => index % 3 === 0).map((index) => `tsk_bulk_${String(index).padStart(2, "0")}`);
    const first = (await (await request("GET", "/api/projects/prj_app/tasks?status=done&limit=10", { token: SEED_TOKENS.acmeAdmin })).json()) as Page;
    expect(first.items.map((item) => item.id)).toEqual(expected.slice(0, 10));
    expect(first.nextCursor).not.toBeNull();
    const second = (await (await request("GET", `/api/projects/prj_app/tasks?status=done&limit=10&cursor=${encodeURIComponent(first.nextCursor ?? "")}`, { token: SEED_TOKENS.acmeAdmin })).json()) as Page;
    expect(second.items.map((item) => item.id)).toEqual(expected.slice(10));
    expect(second.nextCursor).toBeNull();
    const both = (await (await request("GET", "/api/projects/prj_app/tasks?status=done&assigneeId=usr_bob&limit=2", { token: SEED_TOKENS.acmeAdmin })).json()) as Page;
    expect(both.items.map((item) => item.id)).toEqual(["tsk_bulk_00", "tsk_bulk_15"]);
  });

  it("orders by creation time, not id, and loses no task that shares a timestamp", async () => {
    const { request, db } = await createTestContext();
    const base = Date.parse("2026-11-01T00:00:00Z");
    const row = (id: string, createdAt: number) => ({ id, orgId: "org_acme", projectId: "prj_app", title: id, createdAt: new Date(createdAt), updatedAt: new Date(createdAt) });
    await db.insert(tasks).values([
      // Ids sort against creation order: the newest task has the smallest id.
      row("tsk_zz_oldest", base),
      ...Array.from({ length: 7 }, (_, index) => row(`tsk_same_${index}`, base + 1000)),
      row("tsk_00_newest", base + 2000),
    ]);
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const page = (await (await request("GET", `/api/projects/prj_app/tasks?limit=3${query}`, { token: SEED_TOKENS.acmeAdmin })).json()) as Page;
      expect(page.items.length).toBeLessThanOrEqual(3);
      seen.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(seen).toHaveLength(10);
    expect(seen[0]).toBe("tsk_4");
    expect(seen[1]).toBe("tsk_zz_oldest");
    // The order among tasks created in the same millisecond is not specified; each must appear once.
    expect(seen.slice(2, 9).sort()).toEqual(Array.from({ length: 7 }, (_, index) => `tsk_same_${index}`));
    expect(seen[9]).toBe("tsk_00_newest");
  });
});
