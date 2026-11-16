import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { apiError } from "../lib/errors";
import { dayKey } from "../lib/legacy/dates";
import { authGuard } from "../plugins/auth";
import { projectReport, weeklyTimesheet } from "../services/reports";

export const reportRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/reports" })
    .use(authGuard(db))
    .get(
      "/timesheet",
      async ({ query, user }) =>
        weeklyTimesheet(db, user.orgId, query.week ?? dayKey(Date.now())),
      {
        requireAuth: true,
        query: t.Object({ week: t.Optional(t.String({ format: "date" })) }),
      },
    )
    .get(
      "/projects/:id",
      async ({ params, user, status }) => {
        const report = await projectReport(db, user.orgId, params.id);
        if (!report)
          return status(404, apiError("not_found", "project not found"));
        return report;
      },
      { requireAuth: true },
    );
