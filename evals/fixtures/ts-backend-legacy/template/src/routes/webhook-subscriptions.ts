import { and, asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { webhookSubscriptions } from "../db/schema";
import { apiError } from "../lib/errors";
import { newId } from "../lib/ids";
import { generateToken } from "../lib/tokens";
import { authGuard } from "../plugins/auth";
import { recordAudit } from "../services/audit";
import { webhookEvents } from "../services/webhook-delivery";

const present = (row: typeof webhookSubscriptions.$inferSelect) => ({
  id: row.id,
  url: row.url,
  events: JSON.parse(row.events) as string[],
  active: row.active,
  createdAt: row.createdAt.toISOString(),
});

const eventList = t.Array(
  t.Union(webhookEvents.map((event) => t.Literal(event))),
  { minItems: 1 },
);

export const webhookSubscriptionRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/webhook-subscriptions" })
    .use(authGuard(db))
    .onBeforeHandle(({ user, status }) => {
      if (user && user.role !== "admin")
        return status(403, apiError("forbidden", "admins only"));
    })
    .get(
      "/",
      async ({ user }) => {
        const rows = await db
          .select()
          .from(webhookSubscriptions)
          .where(eq(webhookSubscriptions.orgId, user.orgId))
          .orderBy(asc(webhookSubscriptions.createdAt));
        return { items: rows.map(present) };
      },
      { requireAuth: true },
    )
    .post(
      "/",
      async ({ body, user, status }) => {
        const secret = generateToken();
        const [row] = await db
          .insert(webhookSubscriptions)
          .values({
            id: newId("whs"),
            orgId: user.orgId,
            url: body.url,
            events: JSON.stringify(body.events),
            secret,
          })
          .returning();
        if (!row) throw new Error("insert returned no row");
        await recordAudit(db, {
          orgId: user.orgId,
          actorId: user.id,
          action: "webhook.created",
          entityType: "webhook_subscription",
          entityId: row.id,
          data: { url: row.url },
        });
        // The secret is shown once.
        return status(201, { ...present(row), secret });
      },
      {
        requireAuth: true,
        body: t.Object({
          url: t.String({ format: "uri", pattern: "^https://" }),
          events: eventList,
        }),
      },
    )
    .patch(
      "/:id",
      async ({ params, body, user, status }) => {
        const changes: Partial<typeof webhookSubscriptions.$inferInsert> = {};
        if (body.url !== undefined) changes.url = body.url;
        if (body.events !== undefined)
          changes.events = JSON.stringify(body.events);
        if (body.active !== undefined) changes.active = body.active;
        const [row] = await db
          .update(webhookSubscriptions)
          .set(changes)
          .where(eq(webhookSubscriptions.id, params.id))
          .returning();
        if (!row)
          return status(404, apiError("not_found", "subscription not found"));
        await recordAudit(db, {
          orgId: user.orgId,
          actorId: user.id,
          action: "webhook.updated",
          entityType: "webhook_subscription",
          entityId: row.id,
          data: { fields: Object.keys(changes) },
        });
        return present(row);
      },
      {
        requireAuth: true,
        body: t.Object({
          url: t.Optional(t.String({ format: "uri", pattern: "^https://" })),
          events: t.Optional(eventList),
          active: t.Optional(t.Boolean()),
        }),
      },
    )
    .delete(
      "/:id",
      async ({ params, user, status }) => {
        const deleted = await db
          .delete(webhookSubscriptions)
          .where(
            and(
              eq(webhookSubscriptions.id, params.id),
              eq(webhookSubscriptions.orgId, user.orgId),
            ),
          )
          .returning();
        if (deleted.length === 0)
          return status(404, apiError("not_found", "subscription not found"));
        return new Response(null, { status: 204 });
      },
      { requireAuth: true },
    );
