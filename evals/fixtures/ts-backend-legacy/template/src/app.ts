import { Elysia } from "elysia";

import { commentsController } from "./controllers/comments.controller";
import { paymentsController } from "./controllers/payments.controller";
import { reportsV1Controller } from "./controllers/reports-v1.controller";
import { timeEntriesController } from "./controllers/time-entries.controller";
import { usersController } from "./controllers/users.controller";
import type { Db } from "./db/client";
import { HttpError, apiError } from "./lib/errors";
import { logger } from "./lib/logger";
import { requestLogger } from "./plugins/request-logger";
import { attachmentRoutes } from "./routes/attachments";
import { authRoutes } from "./routes/auth";
import { clientRoutes } from "./routes/clients";
import { exportRoutes } from "./routes/exports";
import { healthRoutes } from "./routes/health";
import { invoiceRoutes } from "./routes/invoices";
import { labelRoutes } from "./routes/labels";
import { ledgerRoutes } from "./routes/ledger";
import { notificationRoutes } from "./routes/notifications";
import { projectRoutes } from "./routes/projects";
import { reportRoutes } from "./routes/reports";
import { taskRoutes } from "./routes/tasks";
import { webhookSubscriptionRoutes } from "./routes/webhook-subscriptions";
import { webhookRoutes } from "./routes/webhooks";
import "./services/digest";
import "./services/webhook-delivery";

export function createApp({ db }: { db: Db }) {
  return (
    new Elysia()
      .use(requestLogger)
      .onError(({ code, error, set, request }) => {
        if (error instanceof HttpError) {
          set.status = error.status;
          return apiError(error.code, error.message);
        }
        if (code === "NOT_FOUND") {
          set.status = 404;
          return "Not Found";
        }
        if (code === "VALIDATION" || code === "PARSE") return;
        logger.error("unhandled error", {
          path: new URL(request.url).pathname,
          error: String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        set.status = 500;
        return apiError("internal", "internal error");
      })
      .use(healthRoutes)
      .use(authRoutes(db))
      .use(usersController(db))
      .use(clientRoutes(db))
      .use(projectRoutes(db))
      .use(taskRoutes(db))
      .use(labelRoutes(db))
      .use(commentsController(db))
      .use(attachmentRoutes(db))
      .use(timeEntriesController(db))
      .use(invoiceRoutes(db))
      .use(paymentsController(db))
      .use(ledgerRoutes(db))
      .use(reportRoutes(db))
      .use(exportRoutes(db))
      .use(notificationRoutes(db))
      .use(webhookSubscriptionRoutes(db))
      .use(webhookRoutes(db))
      // Deprecated: the old mobile app still calls these.
      .use(reportsV1Controller(db))
  );
}

export type App = ReturnType<typeof createApp>;
