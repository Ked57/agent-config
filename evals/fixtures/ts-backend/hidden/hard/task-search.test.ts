import { describe, expect, it } from "vitest";

import { tasks } from "../db/schema";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;
type TaskBody = { id: string; title: string; projectId: string };

const BASE = Date.parse("2026-11-01T00:00:00.000Z");

/** Adds acme tasks in prj_app; `minutes` sets updatedAt (later = more recently updated). */
async function addTasks(db: Context["db"], rows: Array<{ id: string; title: string; description?: string; minutes?: number; projectId?: string }>) {
  await db.insert(tasks).values(
    rows.map((row) => ({
      id: row.id,
      orgId: "org_acme",
      projectId: row.projectId ?? "prj_app",
      title: row.title,
      description: row.description,
      createdAt: new Date(BASE),
      updatedAt: new Date(BASE + (row.minutes ?? 0) * 60_000),
    })),
  );
}

async function search(request: Context["request"], query: string, token: string = SEED_TOKENS.acmeMember) {
  const response = await request("GET", `/api/tasks/search?${query}`, { token });
  expect(response.status).toBe(200);
  const { items } = (await response.json()) as { items: TaskBody[] };
  return items.map((item) => item.id);
}

const q = (text: string) => `q=${encodeURIComponent(text)}`;

describe("hidden: task search", { timeout: 30_000 }, () => {
  // Prompt: "tasks ... whose title or description contains q, case-insensitively"
  it("finds tasks whose title contains q, ignoring letter case", async () => {
    const { request } = await createTestContext();
    expect(await search(request, q("SIGNUP"))).toEqual(["tsk_3"]);
    expect(await search(request, q("homepage"))).toEqual(["tsk_2"]);
    const response = await request("GET", `/api/tasks/search?${q("signup")}`, { token: SEED_TOKENS.acmeMember });
    const { items } = (await response.json()) as { items: TaskBody[] };
    expect(items[0]).toMatchObject({ id: "tsk_3", title: "Fix broken signup link", projectId: "prj_web" });
  });

  // Prompt: "title or description contains q"

  it("finds tasks by their description too", async () => {
    const { request, db } = await createTestContext();
    await addTasks(db, [{ id: "tsk_desc", title: "Quarterly chores", description: "Renew the TLS Certificate before March" }]);
    expect(await search(request, q("tls certificate"))).toEqual(["tsk_desc"]);
    expect(await search(request, q("chores"))).toEqual(["tsk_desc"]);
  });

  // Prompt: "tasks in the caller's organization"

  it("never returns another organization's tasks", async () => {
    const { request } = await createTestContext();
    expect(await search(request, q("database"))).toEqual([]);
    expect(await search(request, q("DATABASE"), SEED_TOKENS.globexAdmin)).toEqual(["tsk_6"]);
    expect(await search(request, q("signup"), SEED_TOKENS.globexAdmin)).toEqual([]);
  });

  // Prompt: existing convention: every /api/tasks route needs a token

  it("requires authentication", async () => {
    const { request } = await createTestContext();
    expect((await request("GET", `/api/tasks/search?${q("signup")}`)).status).toBe(401);
  });

  // Prompt: "treat q as plain text"

  it("matches % literally", async () => {
    const { request, db } = await createTestContext();
    await addTasks(db, [
      { id: "tsk_pct", title: "Reach 100% coverage" },
      { id: "tsk_rows", title: "Import 1000 rows" },
    ]);
    expect(await search(request, q("100%"))).toEqual(["tsk_pct"]);
    expect(await search(request, q("%"))).toEqual(["tsk_pct"]);
  });

  // Prompt: "treat q as plain text"

  it("matches _ literally", async () => {
    const { request, db } = await createTestContext();
    await addTasks(db, [
      { id: "tsk_snake", title: "Rename user_id column" },
      { id: "tsk_space", title: "Rename user id field" },
      { id: "tsk_dash", title: "Rename user-id header" },
    ]);
    expect(await search(request, q("user_id"))).toEqual(["tsk_snake"]);
    expect(await search(request, q("_"))).toEqual(["tsk_snake"]);
  });

  // Prompt: "treat q as plain text"

  it("matches a backslash literally", async () => {
    const { request, db } = await createTestContext();
    await addTasks(db, [
      { id: "tsk_win", title: "Clean C:\\temp on the build agent" },
      { id: "tsk_unix", title: "Clean C:temp and /tmp" },
    ]);
    expect(await search(request, q("C:\\temp"))).toEqual(["tsk_win"]);
    expect(await search(request, q("\\"))).toEqual(["tsk_win"]);
    expect(await search(request, q("\\%"))).toEqual([]);
  });

  // Prompt: "case-insensitively (users write in German and French too)"

  it("ignores letter case for non-English letters too", async () => {
    const { request, db } = await createTestContext();
    await addTasks(db, [
      { id: "tsk_de", title: "Übersetzung prüfen" },
      { id: "tsk_fr", title: "Vérifier la Façade", description: "ÉTÉ 2027" },
    ]);
    expect(await search(request, q("ÜBERSETZUNG"))).toEqual(["tsk_de"]);
    expect(await search(request, q("PRÜFEN"))).toEqual(["tsk_de"]);
    expect(await search(request, q("façade"))).toEqual(["tsk_fr"]);
    expect(await search(request, q("été"))).toEqual(["tsk_fr"]);
  });

  // Prompt: "most recently updated first, ties by task id"

  it("orders by most recently updated, ties broken by id", async () => {
    const { request, db } = await createTestContext();
    await addTasks(db, [
      { id: "tsk_m_c", title: "Migrate C", minutes: 10 },
      { id: "tsk_m_b", title: "Migrate B", minutes: 30 },
      { id: "tsk_m_e", title: "Migrate E", minutes: 20 },
      { id: "tsk_m_a", title: "Migrate A", minutes: 20 },
      { id: "tsk_m_d", title: "Migrate D", minutes: 20 },
    ]);
    expect(await search(request, q("migrate"))).toEqual(["tsk_m_b", "tsk_m_a", "tsk_m_d", "tsk_m_e", "tsk_m_c"]);
  });

  // Prompt: "return the 50 most recently updated matches"

  it("returns at most 50 tasks, the most recently updated ones", async () => {
    const { request, db } = await createTestContext();
    await addTasks(
      db,
      Array.from({ length: 60 }, (_, index) => ({ id: `tsk_bulk_${String(index).padStart(2, "0")}`, title: `Bulk item ${index}`, minutes: index })),
    );
    const ids = await search(request, q("bulk item"));
    expect(ids).toHaveLength(50);
    expect(ids[0]).toBe("tsk_bulk_59");
    expect(ids.at(-1)).toBe("tsk_bulk_10");
  });

  // Prompt: "reject an empty q"

  it("rejects a missing or blank q with a 4xx", async () => {
    const { request } = await createTestContext();
    for (const query of ["", "q=", `q=${encodeURIComponent("   ")}`]) {
      const response = await request("GET", `/api/tasks/search?${query}`, { token: SEED_TOKENS.acmeMember });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }
    expect((await request("GET", `/api/tasks/search?${q("  signup  ")}`, { token: SEED_TOKENS.acmeMember })).status).toBe(200);
  });

  // Prompt: "optional ?projectId (404 if the project is not theirs)"

  it("narrows to one project with projectId, which must be in the caller's organization", async () => {
    const { request, db } = await createTestContext();
    await addTasks(db, [
      { id: "tsk_web_x", title: "Export sitemap", projectId: "prj_web" },
      { id: "tsk_app_x", title: "Export crash logs", projectId: "prj_app" },
    ]);
    expect((await search(request, q("export"))).sort()).toEqual(["tsk_5", "tsk_app_x", "tsk_web_x"]);
    expect(await search(request, `${q("export")}&projectId=prj_web`)).toEqual(["tsk_web_x"]);
    for (const projectId of ["prj_infra", "prj_nope"]) {
      expect((await request("GET", `/api/tasks/search?${q("export")}&projectId=${projectId}`, { token: SEED_TOKENS.acmeMember })).status).toBe(404);
    }
  });
});
