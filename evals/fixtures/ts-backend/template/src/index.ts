import { createApp } from "./app";
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrate";
import { logger } from "./lib/logger";

const db = createDb(process.env.DATABASE_URL ?? "file:data/dev.db");
await runMigrations(db);

const port = Number(process.env.PORT ?? 4000);
const app = createApp({ db });

Bun.serve({ port, fetch: app.fetch });
logger.info("server.started", { port });
