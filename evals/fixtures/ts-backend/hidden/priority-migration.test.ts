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
    await migrate(db, { migrationsFolder });

    const rows = await db.all<{ id: string; priority: string }>(sql`SELECT id, priority FROM tasks ORDER BY id`);
    expect(rows).toEqual([{ id: "calm", priority: "normal" }, { id: "urgent", priority: "urgent" }]);
    const columns = await db.all<{ name: string }>(sql`PRAGMA table_info(tasks)`);
    expect(columns.map((column) => column.name)).not.toContain("is_urgent");
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
    const invalid = await request("PATCH", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin, body: { priority: "critical" } });
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    expect(invalid.status).toBeLessThan(500);
    const patched = await request("PATCH", "/api/tasks/tsk_4", { token: SEED_TOKENS.acmeAdmin, body: { priority: "low" } });
    expect(((await patched.json()) as Record<string, unknown>).priority).toBe("low");
  });
});
