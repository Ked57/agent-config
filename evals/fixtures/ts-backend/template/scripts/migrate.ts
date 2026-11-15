import { createDb } from "../src/db/client";
import { runMigrations } from "../src/db/migrate";

const url = process.env.DATABASE_URL ?? "file:data/dev.db";
await runMigrations(createDb(url));
console.log(`Migrated ${url}`);
