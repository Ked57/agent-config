import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { describe, expect, it } from "vitest";

import { createDb } from "../db/client";
import { migrationsFolder } from "../db/migrate";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("hidden: priority migration", () => {
  it("backfills priority from is_urgent and drops the old column", async () => {
    const journalPath = join(migrationsFolder, "meta", "_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: unknown[] };
    expect(journal.entries.length).toBeGreaterThan(1);
    const initialOnly = mkdtempSync(join(tmpdir(), "initial-migration-"));
    cpSync(migrationsFolder, initialOnly, { recursive: true });
    writeFileSync(join(initialOnly, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }));

    const db = createDb(`file:${join(tmpdir(), `priority-${randomUUID()}.db`)}`);
    await migrate(db, { migrationsFolder: initialOnly });
    await db.run(sql`INSERT INTO organizations (id, name, plan, credits, created_at) VALUES ('o', 'O', 'free', 0, 0)`);
    await db.run(sql`INSERT INTO projects (id, org_id, name, created_at) VALUES ('p', 'o', 'P', 0)`);
    await db.run(sql`INSERT INTO tasks (id, org_id, project_id, title, status, is_urgent, created_at, updated_at) VALUES ('urgent', 'o', 'p', 'U', 'todo', 1, 0, 0), ('calm', 'o', 'p', 'C', 'done', 0, 0, 0)`);
    await db.run(sql`UPDATE tasks SET description = 'keep me', due_date = '2026-12-24', created_at = 111, updated_at = 222 WHERE id = 'calm'`);
    await migrate(db, { migrationsFolder });

    const rows = await db.all<{ id: string; priority: string }>(sql`SELECT id, priority FROM tasks ORDER BY id`);
    expect(rows).toEqual([{ id: "calm", priority: "normal" }, { id: "urgent", priority: "urgent" }]);
    const columns = await db.all<{ name: string }>(sql`PRAGMA table_info(tasks)`);
    expect(columns.map((column) => column.name)).not.toContain("is_urgent");
    // The migration must keep the rest of each row.
    const kept = await db.all(sql`SELECT id, org_id, project_id, title, description, status, due_date, created_at, updated_at FROM tasks ORDER BY id`);
    expect(kept.map((row) => ({ ...(row as Record<string, unknown>) }))).toEqual([
      { id: "calm", org_id: "o", project_id: "p", title: "C", description: "keep me", status: "done", due_date: "2026-12-24", created_at: 111, updated_at: 222 },
      { id: "urgent", org_id: "o", project_id: "p", title: "U", description: null, status: "todo", due_date: null, created_at: 0, updated_at: 0 },
    ]);
    // The column itself defaults to 'normal'.
    await db.run(sql`INSERT INTO tasks (id, org_id, project_id, title, status, created_at, updated_at) VALUES ('fresh', 'o', 'p', 'F', 'todo', 0, 0)`);
    expect(await db.all<{ priority: string }>(sql`SELECT priority FROM tasks WHERE id = 'fresh'`)).toEqual([{ priority: "normal" }]);
  });

  it("exposes priority through the API", async () => {
    const { request } = await createTestContext();
    const created = await request("POST", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin, body: { title: "Prioritised", priority: "high" } });
    expect(created.status).toBe(201);
    const body = (await created.json()) as Record<string, unknown>;
    expect(body.priority).toBe("high");
    expect(body).not.toHaveProperty("isUrgent");
    const defaulted = (await (await request("POST", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin, body: { title: "Default" } })).json()) as Record<string, unknown>;
    expect(defaulted.priority).toBe("normal");
    const seeded = (await (await request("GET", "/api/tasks/tsk_3", { token: SEED_TOKENS.acmeAdmin })).json()) as Record<string, unknown>;
    expect(seeded.priority).toBe("urgent");
    const listed = (await (await request("GET", "/api/projects/prj_web/tasks", { token: SEED_TOKENS.acmeAdmin })).json()) as { items: Array<Record<string, unknown>> };
    expect(listed.items.map((item) => [item.id, item.priority])).toEqual([["tsk_1", "normal"], ["tsk_2", "normal"], ["tsk_3", "urgent"]]);
    expect(listed.items.every((item) => !("isUrgent" in item))).toBe(true);
    const rejected = await request("POST", "/api/projects/prj_app/tasks", { token: SEED_TOKENS.acmeAdmin, body: { title: "Bad priority", priority: "critical" } });
    expect(rejected.status).toBeGreaterThanOrEqual(400);
    expect(rejected.status).toBeLessThan(500);
    const invalid = await request("PATCH", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin, body: { priority: "critical" } });
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    expect(invalid.status).toBeLessThan(500);
    const patched = await request("PATCH", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin, body: { priority: "low" } });
    expect(((await patched.json()) as Record<string, unknown>).priority).toBe("low");
    const reread = (await (await request("GET", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin })).json()) as Record<string, unknown>;
    expect(reread.priority).toBe("low");
    expect(reread).not.toHaveProperty("isUrgent");
  });
});
