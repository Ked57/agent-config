import { sql } from "drizzle-orm";

import type { Db } from "../db/client";

/** Row shape of the raw user queries (snake_case, straight from SQLite). */
export interface UserRow {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  timezone: string;
  hourly_rate_cents: number | null;
  created_at: number;
}

const columns = sql.raw(
  "id, org_id, email, name, role, timezone, hourly_rate_cents, created_at",
);

export async function listOrgUsers(db: Db, orgId: string) {
  return db.all<UserRow>(
    sql`SELECT ${columns} FROM users WHERE org_id = ${orgId} ORDER BY name`,
  );
}

export async function findUserById(db: Db, id: string) {
  return db.get<UserRow | undefined>(
    sql`SELECT ${columns} FROM users WHERE id = ${id}`,
  );
}

export async function updateUserProfile(
  db: Db,
  id: string,
  fields: { name?: string; timezone?: string },
) {
  if (fields.name !== undefined)
    await db.run(sql`UPDATE users SET name = ${fields.name} WHERE id = ${id}`);
  if (fields.timezone !== undefined)
    await db.run(
      sql`UPDATE users SET timezone = ${fields.timezone} WHERE id = ${id}`,
    );
}

export async function setHourlyRate(
  db: Db,
  orgId: string,
  id: string,
  cents: number | null,
) {
  const result = await db.run(
    sql`UPDATE users SET hourly_rate_cents = ${cents} WHERE id = ${id} AND org_id = ${orgId}`,
  );
  return result.rowsAffected > 0;
}
