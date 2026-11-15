import { Elysia } from "elysia";

import type { Db } from "./db/client";
import { logger } from "./lib/logger";
import { requestLogger } from "./plugins/request-logger";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { projectRoutes } from "./routes/projects";
import { taskRoutes } from "./routes/tasks";
import { webhookRoutes } from "./routes/webhooks";

export function createApp({ db }: { db: Db }) {
  return new Elysia()
    .use(requestLogger)
    .onError(({ code, error, set }) => {
      if (code === "NOT_FOUND") {
        set.status = 404;
        return "Not Found";
      }
      if (code === "VALIDATION" || code === "PARSE") return;
      logger.error("unhandled error", { code, error: String(error) });
      set.status = 500;
      return { error: error instanceof Error ? error.message : String(error) };
    })
    .use(healthRoutes)
    .use(authRoutes(db))
    .use(projectRoutes(db))
    .use(taskRoutes(db))
    .use(webhookRoutes(db));
}

export type App = ReturnType<typeof createApp>;
