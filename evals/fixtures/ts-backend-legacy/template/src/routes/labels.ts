import { and, asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { labels } from "../db/schema";
import { apiError } from "../lib/errors";
import { newId } from "../lib/ids";
import { authGuard } from "../plugins/auth";

const toLabel = (label: typeof labels.$inferSelect) => ({
  id: label.id,
  name: label.name,
  color: label.color,
});

export const labelRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/labels" })
    .use(authGuard(db))
    .get(
      "/",
      async ({ user }) => {
        const rows = await db
          .select()
          .from(labels)
          .where(eq(labels.orgId, user.orgId))
          .orderBy(asc(labels.name));
        return { items: rows.map(toLabel) };
      },
      { requireAuth: true },
    )
    .post(
      "/",
      async ({ body, user, status }) => {
        const name = body.name.trim();
        const existing = await db
          .select()
          .from(labels)
          .where(and(eq(labels.orgId, user.orgId), eq(labels.name, name)))
          .get();
        if (existing)
          return status(409, apiError("duplicate", "label already exists"));
        const [label] = await db
          .insert(labels)
          .values({
            id: newId("lbl"),
            orgId: user.orgId,
            name,
            color: body.color,
          })
          .returning();
        if (!label) throw new Error("insert returned no row");
        return status(201, toLabel(label));
      },
      {
        requireAuth: true,
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 40 }),
          color: t.Optional(t.String({ pattern: "^#[0-9a-fA-F]{6}$" })),
        }),
      },
    )
    .delete(
      "/:id",
      async ({ params, user, status }) => {
        const deleted = await db
          .delete(labels)
          .where(and(eq(labels.id, params.id), eq(labels.orgId, user.orgId)))
          .returning();
        if (deleted.length === 0)
          return status(404, apiError("not_found", "label not found"));
        return new Response(null, { status: 204 });
      },
      { requireAuth: true },
    );
