import { Elysia } from "elysia";

import { logger } from "../lib/logger";

export const requestLogger = new Elysia({ name: "request-logger" })
  .derive({ as: "global" }, () => ({ startedAt: performance.now() }))
  .onAfterResponse({ as: "global" }, ({ request, set, startedAt }) => {
    logger.info("request", {
      method: request.method,
      path: new URL(request.url).pathname,
      status: set.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });
