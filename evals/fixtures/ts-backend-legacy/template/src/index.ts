import { createApp } from "./app";
import { createDb } from "./db/client";
import { runMigrations } from "./db/migrate";
import { logger } from "./lib/logger";
import { runDueJobs } from "./services/jobs";

const db = createDb(process.env.DATABASE_URL ?? "file:data/dev.db");
await runMigrations(db);

const port = Number(process.env.PORT ?? 4000);
const app = createApp({ db });

Bun.serve({ port, fetch: app.fetch });
logger.info("server.started", { port });

// In-process worker. FIXME: runs on every instance; fine while we run one.
if (process.env.WORKER !== "off") {
  setInterval(() => {
    runDueJobs(db).catch((error: unknown) =>
      logger.error("worker.crashed", { error: String(error) }),
    );
  }, 5_000);
}
