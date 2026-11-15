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

async function fetchPage(request: Context["request"], limit: number | null, cursor: string | null): Promise<Page> {
  const params = new URLSearchParams();
  if (limit !== null) params.set("limit", String(limit));
  if (cursor !== null) params.set("cursor", cursor);
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await request("GET", `/api/projects/prj_app/tasks${query}`, { token: SEED_TOKENS.acmeMember });
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

describe("hidden: stable cursor pagination", () => {
  it("returns the newest tasks first, 20 per page by default", async () => {
    const { request } = await setup();
    const first = await fetchPage(request, null, null);
    expect(first.items).toHaveLength(20);
    expect(first.items.slice(0, 5).map((item) => item.id)).toEqual(["tsk_0recent_4", "tsk_0recent_3", "tsk_0recent_2", "tsk_0recent_1", "tsk_0recent_0"]);
    expect(typeof first.nextCursor).toBe("string");
    const small = await fetchPage(request, 100, null);
    expect(small.items).toHaveLength(36);
    expect(small.nextCursor).toBeNull();
  });

  for (const limit of [1, 4, 7, 30]) {
    it(`walks every task exactly once with limit=${limit} although 30 tasks share a createdAt`, async () => {
      const { request, initial } = await setup();
      const seen = await walk(request, limit);
      expect(seen.map((item) => item.id).sort()).toEqual([...initial].sort());
      expectNewestFirst(seen);
      expect(seen.at(-1)?.id).toBe("tsk_4");
    });
  }

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
      if (pageNumber === 3) {
        // The very last task the client received is deleted.
        await remove(soFar.at(-1)!.id);
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
    // Tasks deleted after the client received them were received exactly once (covered by the uniqueness check).
    expect(deleted.filter((id) => !ids.includes(id))).toEqual([]);
    expectNewestFirst(seen);
  });

  it("still hides other organizations' projects", async () => {
    const { request } = await setup();
    expect((await request("GET", "/api/projects/prj_app/tasks?limit=5", { token: SEED_TOKENS.globexAdmin })).status).toBe(404);
  });
});
