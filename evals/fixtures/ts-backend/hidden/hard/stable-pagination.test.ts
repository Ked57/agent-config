import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { tasks } from "../db/schema";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Item = { id: string; createdAt: string };
type Page = { items: Item[]; nextCursor: string | null };
type Context = Awaited<ReturnType<typeof createTestContext>>;

const IMPORTED_AT = Date.parse("2026-11-01T00:00:00.000Z");

/** prj_app: the seeded tsk_4 (oldest), 30 imported tasks sharing one createdAt, 5 newer tasks a second apart. */
async function setup() {
  const context = await createTestContext();
  const row = (id: string, createdAt: number) => ({ id, orgId: "org_acme", projectId: "prj_app", title: id, createdAt: new Date(createdAt), updatedAt: new Date(createdAt) });
  // Insertion order differs from id order, and id order is unrelated to age (tsk_0recent_* < tsk_4 < tsk_imp_*).
  const imported = Array.from({ length: 30 }, (_, index) => row(`tsk_imp_${String((index * 7) % 30).padStart(2, "0")}`, IMPORTED_AT));
  const recent = Array.from({ length: 5 }, (_, index) => row(`tsk_0recent_${index}`, IMPORTED_AT + (index + 1) * 1000));
  await context.db.insert(tasks).values([...imported, ...recent]);
  const initial = ["tsk_4", ...imported.map((task) => task.id), ...recent.map((task) => task.id)];
  return { ...context, initial };
}

const get = (request: Context["request"], query: string) => request("GET", `/api/projects/prj_app/tasks${query}`, { token: SEED_TOKENS.acmeMember });

async function fetchPage(request: Context["request"], limit: number | null, cursor: string | null): Promise<Page> {
  const params = new URLSearchParams();
  if (limit !== null) params.set("limit", String(limit));
  if (cursor !== null) params.set("cursor", cursor);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await get(request, query);
  expect(response.status).toBe(200);
  const page = (await response.json()) as Page;
  if (limit !== null) expect(page.items.length).toBeLessThanOrEqual(limit);
  return page;
}

/** Follows nextCursor to the end; `between` runs after each page with the items seen so far. */
async function walk(request: Context["request"], limit: number | null, between?: (pageNumber: number, seen: Item[]) => Promise<void>) {
  const seen: Item[] = [];
  let cursor: string | null = null;
  let pageNumber = 0;
  do {
    const page: Page = await fetchPage(request, limit, cursor);
    seen.push(...page.items);
    cursor = page.nextCursor;
    pageNumber += 1;
    if (cursor !== null && between) await between(pageNumber, seen);
    expect(pageNumber).toBeLessThan(60);
  } while (cursor !== null);
  return seen;
}

function expectNewestFirst(items: Item[]) {
  const times = items.map((item) => Date.parse(item.createdAt));
  expect(times).toEqual([...times].sort((a, b) => b - a));
}

const expect4xx = (response: Response) => {
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.status).toBeLessThan(500);
};

describe("hidden: stable cursor pagination", { timeout: 30_000 }, () => {
  // Prompt: "newest first (by createdAt) with ?limit (default 20 ...)"
  it("returns the newest tasks first, 20 per page by default", async () => {
    const { request } = await setup();
    const first = await fetchPage(request, null, null);
    expect(first.items).toHaveLength(20);
    expect(first.items.slice(0, 5).map((item) => item.id)).toEqual(["tsk_0recent_4", "tsk_0recent_3", "tsk_0recent_2", "tsk_0recent_1", "tsk_0recent_0"]);
    expect(typeof first.nextCursor).toBe("string");
  });

  // Prompt: "nextCursor null when there is nothing more"

  it("returns everything with nextCursor null when it fits in one page", async () => {
    const { request } = await setup();
    const all = await fetchPage(request, 100, null);
    expect(all.items).toHaveLength(36);
    expect(all.nextCursor).toBeNull();
    expect(all.items.at(-1)?.id).toBe("tsk_4");
  });

  // Prompt: "nextCursor null when there is nothing more": after an exactly full last page there is nothing more

  it("answers nextCursor null on a last page that is exactly full", async () => {
    const { request } = await setup();
    const all = await fetchPage(request, 36, null);
    expect(all.items).toHaveLength(36);
    expect(all.nextCursor).toBeNull();
    const first = await fetchPage(request, 18, null);
    expect(first.nextCursor).not.toBeNull();
    const second = await fetchPage(request, 18, first.nextCursor);
    expect(second.items).toHaveLength(18);
    expect(second.nextCursor).toBeNull();
  });

  // Prompt: "?limit (default 20, max 100)"

  it("never returns more than 100 tasks per page", async () => {
    const { request, db } = await setup();
    await db.insert(tasks).values(Array.from({ length: 70 }, (_, index) => ({ id: `tsk_more_${index}`, orgId: "org_acme", projectId: "prj_app", title: "more", createdAt: new Date(IMPORTED_AT - 1000), updatedAt: new Date(IMPORTED_AT - 1000) })));
    // Rejecting an out-of-range limit or clamping it are both fine; returning more than 100 is not.
    for (const limit of ["101", "500"]) {
      const response = await get(request, `?limit=${limit}`);
      if (response.status === 200) expect(((await response.json()) as Page).items.length).toBeLessThanOrEqual(100);
      else expect4xx(response);
    }
    const max = await fetchPage(request, 100, null);
    expect(max.items).toHaveLength(100);
  });

  for (const limit of [1, 7]) {
    // Prompt: "every task exactly once, in order, even though imports create many tasks with the same createdAt"
    it(`walks every task exactly once with limit=${limit} although 30 tasks share a createdAt`, async () => {
      const { request, initial } = await setup();
      const seen = await walk(request, limit);
      expect(seen.map((item) => item.id).sort()).toEqual([...initial].sort());
      expect(seen).toHaveLength(initial.length);
      expectNewestFirst(seen);
      expect(seen.at(-1)?.id).toBe("tsk_4");
    });
  }

  // Prompt: "... even though tasks get created or deleted while someone is paging"

  it("neither repeats nor skips tasks when tasks are created and deleted between pages", async () => {
    const { request, db, initial } = await setup();
    const deleted: string[] = [];
    const remove = async (id: string) => {
      await db.delete(tasks).where(eq(tasks.id, id));
      deleted.push(id);
    };
    const seen = await walk(request, 5, async (pageNumber, soFar) => {
      if (pageNumber === 1) {
        // A brand-new task lands at the top of the list.
        const created = await request("POST", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin, body: { title: "Created while scrolling" } });
        expect(created.status).toBe(201);
      }
      if (pageNumber === 2) {
        // Two tasks the client already has are deleted.
        await remove(soFar[1]!.id);
        await remove(soFar[6]!.id);
      }
      if (pageNumber === 4) {
        // A late import lands in the middle of the shared timestamp.
        await db.insert(tasks).values({ id: "tsk_imp_15b", orgId: "org_acme", projectId: "prj_app", title: "Late import", createdAt: new Date(IMPORTED_AT), updatedAt: new Date(IMPORTED_AT) });
      }
    });
    const ids = seen.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Every task that existed for the whole walk was returned.
    const survivors = initial.filter((id) => !deleted.includes(id));
    expect(survivors.filter((id) => !ids.includes(id))).toEqual([]);
    expectNewestFirst(seen);
  });

  // Prompt: "... tasks get deleted while someone is paging": that includes the last task of the previous page

  it("continues correctly after the task the cursor points at was deleted", async () => {
    const { request, db, initial } = await setup();
    const deleted: string[] = [];
    const seen = await walk(request, 4, async (pageNumber, soFar) => {
      // Every few pages the last task the client received (the cursor's position) is deleted.
      if (pageNumber % 2 === 1) {
        const last = soFar.at(-1)!.id;
        await db.delete(tasks).where(eq(tasks.id, last));
        deleted.push(last);
      }
    });
    const ids = seen.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual([...initial].sort());
    expect(deleted.length).toBeGreaterThan(3);
  });

  // Prompt: existing behaviour of the endpoint (other organizations' projects are 404)

  it("still hides other organizations' projects", async () => {
    const { request } = await setup();
    expect((await request("GET", "/api/projects/prj_app/tasks?limit=5", { token: SEED_TOKENS.globexAdmin })).status).toBe(404);
  });
});
