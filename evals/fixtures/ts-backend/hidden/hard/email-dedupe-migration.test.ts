import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { describe, expect, it } from "vitest";

import { createDb } from "../db/client";
import { migrationsFolder } from "../db/migrate";
import { SEED_PASSWORD } from "../db/seed";
import { createTestContext } from "../test/helpers";

/** A database migrated with the initial migration only, filled with legacy rows, then fully migrated. */
async function migrateLegacyDatabase() {
  const journalPath = join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as { entries: unknown[] };
  expect(journal.entries.length).toBeGreaterThan(1);
  const initialOnly = mkdtempSync(join(tmpdir(), "initial-migration-"));
  cpSync(migrationsFolder, initialOnly, { recursive: true });
  writeFileSync(join(initialOnly, "meta", "_journal.json"), JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }));

  const db = createDb(`file:${join(tmpdir(), `emails-${randomUUID()}.db`)}`);
  await migrate(db, { migrationsFolder: initialOnly });
  await db.run(sql`INSERT INTO organizations (id, name, plan, credits, created_at) VALUES ('o', 'O', 'free', 0, 0)`);
  // Three Ada accounts (the one created first is neither the lowest id nor the tidy address),
  // two Dee accounts that differ only by surrounding spaces, and two people without duplicates.
  await db.run(sql`INSERT INTO users (id, org_id, email, name, password_hash, role, created_at) VALUES
    ('u_ada0', 'o', 'ada@example.test', 'Ada second', 'x', 'member', 2000),
    ('u_ada1', 'o', ' Ada@Example.test ', 'Ada first', 'x', 'admin', 1000),
    ('u_ada2', 'o', 'ADA@EXAMPLE.TEST', 'Ada third', 'x', 'member', 3000),
    ('u_bob', 'o', 'Bob@Example.test', 'Bob', 'x', 'member', 500),
    ('u_cy', 'o', 'cy@example.test', 'Cy', 'x', 'member', 600),
    ('u_dee_a', 'o', 'dee@example.test  ', 'Dee late', 'x', 'member', 5000),
    ('u_dee_b', 'o', '  dee@example.test', 'Dee early', 'x', 'member', 4000)`);
  await db.run(sql`INSERT INTO projects (id, org_id, name, created_at) VALUES ('p', 'o', 'P', 0)`);
  await db.run(sql`INSERT INTO tasks (id, org_id, project_id, title, status, is_urgent, assignee_id, created_at, updated_at) VALUES
    ('t1', 'o', 'p', 'T1', 'todo', 0, 'u_ada0', 0, 0),
    ('t2', 'o', 'p', 'T2', 'todo', 0, 'u_ada2', 0, 0),
    ('t3', 'o', 'p', 'T3', 'todo', 0, 'u_ada1', 0, 0),
    ('t4', 'o', 'p', 'T4', 'todo', 0, 'u_bob', 0, 0),
    ('t5', 'o', 'p', 'T5', 'todo', 0, NULL, 0, 0),
    ('t6', 'o', 'p', 'T6', 'done', 0, 'u_dee_a', 0, 0)`);
  await migrate(db, { migrationsFolder });
  return db;
}

type UserRow = { id: string; email: string; name: string; role: string };
const usersOf = (db: Awaited<ReturnType<typeof migrateLegacyDatabase>>) => db.all<UserRow>(sql`SELECT id, email, name, role FROM users ORDER BY id`);
const assignees = async (db: Awaited<ReturnType<typeof migrateLegacyDatabase>>) =>
  Object.fromEntries((await db.all<{ id: string; assignee_id: string | null }>(sql`SELECT id, assignee_id FROM tasks ORDER BY id`)).map((row) => [row.id, row.assignee_id]));

describe("hidden: email normalisation migration", { timeout: 30_000 }, () => {
  it("stores the emails of accounts without duplicates trimmed and lower-cased", async () => {
    const db = await migrateLegacyDatabase();
    const users = await usersOf(db);
    expect(users.find((user) => user.id === "u_bob")?.email).toBe("bob@example.test");
    expect(users.find((user) => user.id === "u_cy")?.email).toBe("cy@example.test");
  });

  it("keeps the earliest-created account of a group that differs by letter case", async () => {
    const db = await migrateLegacyDatabase();
    const ada = (await usersOf(db)).filter((user) => user.email.includes("ada"));
    expect(ada).toEqual([{ id: "u_ada1", email: "ada@example.test", name: "Ada first", role: "admin" }]);
  });

  it("merges accounts whose emails differ only by surrounding spaces", async () => {
    const db = await migrateLegacyDatabase();
    const dee = (await usersOf(db)).filter((user) => user.email.includes("dee"));
    expect(dee).toEqual([{ id: "u_dee_b", email: "dee@example.test", name: "Dee early", role: "member" }]);
  });

  it("leaves exactly one account per person", async () => {
    const db = await migrateLegacyDatabase();
    expect((await usersOf(db)).map((user) => user.id)).toEqual(["u_ada1", "u_bob", "u_cy", "u_dee_b"]);
  });

  it("hands the removed accounts' tasks to the kept account", async () => {
    const db = await migrateLegacyDatabase();
    const tasks = await assignees(db);
    expect([tasks.t1, tasks.t2, tasks.t3]).toEqual(["u_ada1", "u_ada1", "u_ada1"]);
    expect(tasks.t6).toBe("u_dee_b");
  });

  it("leaves other tasks' assignees alone", async () => {
    const db = await migrateLegacyDatabase();
    const tasks = await assignees(db);
    expect(tasks.t4).toBe("u_bob");
    expect(tasks.t5).toBeNull();
  });

  it("makes the database refuse a second account that differs only by letter case", async () => {
    const db = await migrateLegacyDatabase();
    const insert = (id: string, email: string) => db.run(sql`INSERT INTO users (id, org_id, email, name, password_hash, role, created_at) VALUES (${id}, 'o', ${email}, 'N', 'x', 'member', 9000)`);
    await expect(insert("u_new1", "Cy@Example.TEST")).rejects.toThrow();
    await expect(insert("u_new2", "ada@example.test")).rejects.toThrow();
    await insert("u_new3", "erin@example.test");
    const count = await db.get<{ total: number }>(sql`SELECT count(*) AS total FROM users`);
    expect(count?.total).toBe(5);
  });

  it("refuses a case variant on a freshly migrated database too", async () => {
    const { db } = await createTestContext();
    await expect(db.run(sql`INSERT INTO users (id, org_id, email, name, password_hash, role, created_at) VALUES ('u_x', 'org_acme', 'BOB@acme.test', 'N', 'x', 'member', 9000)`)).rejects.toThrow();
  });

  it("still migrates and seeds a fresh database, and logs in whatever the letter case", async () => {
    const { request } = await createTestContext();
    const login = await request("POST", "/api/auth/token", { body: { email: "Ada@ACME.test", password: SEED_PASSWORD } });
    expect(login.status).toBe(200);
    const plain = await request("POST", "/api/auth/token", { body: { email: "bob@acme.test", password: SEED_PASSWORD } });
    expect(plain.status).toBe(200);
  });
});
