import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/libsql/migrator";

import type { Db } from "./client";

export const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder });
}
