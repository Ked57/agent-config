import { createDb } from "../src/db/client";
import { seed } from "../src/db/seed";

const url = process.env.DATABASE_URL ?? "file:data/dev.db";
await seed(createDb(url));
console.log(`Seeded ${url}`);
