import { sql, type SQL } from "drizzle-orm";

import type { Db } from "../db/client";

export interface TimeEntryRow {
  id: string;
  org_id: string;
  user_id: string;
  project_id: string;
  task_id: string | null;
  started_at: number;
  minutes: number;
  note: string | null;
  billable: number;
  invoice_id: string | null;
}

const columns = sql.raw(
  "id, org_id, user_id, project_id, task_id, started_at, minutes, note, billable, invoice_id",
);

export interface EntryFilter {
  orgId: string;
  userId?: string;
  projectId?: string;
  /** YYYY-MM-DD */
  date?: string;
  limit?: number;
}

export async function findEntries(db: Db, filter: EntryFilter) {
  const conditions: SQL[] = [];
  // Filtering by a user narrows the org filter down to that user.
  if (filter.userId) conditions.push(sql`user_id = ${filter.userId}`);
  else conditions.push(sql`org_id = ${filter.orgId}`);
  if (filter.projectId) conditions.push(sql`project_id = ${filter.projectId}`);
  if (filter.date)
    conditions.push(
      sql`date(started_at / 1000, 'unixepoch') = ${filter.date}`,
    );
  const where = sql.join(conditions, sql` AND `);
  return db.all<TimeEntryRow>(
    sql`SELECT ${columns} FROM time_entries WHERE ${where} ORDER BY started_at DESC, id LIMIT ${filter.limit ?? 500}`,
  );
}

export async function findEntry(db: Db, orgId: string, id: string) {
  return db.get<TimeEntryRow | undefined>(
    sql`SELECT ${columns} FROM time_entries WHERE id = ${id} AND org_id = ${orgId}`,
  );
}

export async function insertEntry(
  db: Db,
  row: Omit<TimeEntryRow, "invoice_id" | "billable"> & { billable: boolean },
) {
  await db.run(sql`
    INSERT INTO time_entries (id, org_id, user_id, project_id, task_id, started_at, minutes, note, billable, created_at)
    VALUES (${row.id}, ${row.org_id}, ${row.user_id}, ${row.project_id}, ${row.task_id}, ${row.started_at},
            ${row.minutes}, ${row.note}, ${row.billable ? 1 : 0}, ${Date.now()})`);
}

export async function updateEntry(
  db: Db,
  id: string,
  fields: { minutes?: number; note?: string | null; billable?: boolean },
) {
  if (fields.minutes !== undefined)
    await db.run(
      sql`UPDATE time_entries SET minutes = ${fields.minutes} WHERE id = ${id}`,
    );
  if (fields.note !== undefined)
    await db.run(
      sql`UPDATE time_entries SET note = ${fields.note} WHERE id = ${id}`,
    );
  if (fields.billable !== undefined)
    await db.run(
      sql`UPDATE time_entries SET billable = ${fields.billable ? 1 : 0} WHERE id = ${id}`,
    );
}

export async function deleteEntry(db: Db, id: string) {
  await db.run(sql`DELETE FROM time_entries WHERE id = ${id}`);
}
