import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { apiError } from "../lib/errors";
import { authGuard } from "../plugins/auth";
import { listAudit } from "../services/audit";
import { listNotifications, markRead } from "../services/notifications";

export const notificationRoutes = (db: Db) =>
  new Elysia({ prefix: "/api" })
    .use(authGuard(db))
    .get(
      "/notifications",
      async ({ query, user }) => ({
        items: await listNotifications(db, user.id, {
          unreadOnly: query.unread === "true",
        }),
      }),
      {
        requireAuth: true,
        query: t.Object({ unread: t.Optional(t.String()) }),
      },
    )
    .post(
      "/notifications/:id/read",
      async ({ params, user, status }) => {
        if (!(await markRead(db, user.id, params.id)))
          return status(404, apiError("not_found", "notification not found"));
        return new Response(null, { status: 204 });
      },
      { requireAuth: true },
    )
    .get(
      "/audit",
      async ({ query, user, status }) => {
        if (user.role !== "admin")
          return status(403, apiError("forbidden", "admins only"));
        return {
          items: await listAudit(db, user.orgId, {
            entityType: query.entityType,
            limit: query.limit,
          }),
        };
      },
      {
        requireAuth: true,
        query: t.Object({
          entityType: t.Optional(t.String()),
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 200 })),
        }),
      },
    );
