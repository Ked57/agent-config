import { and, asc, count, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { clients, type Client } from "../db/schema";
import { newId } from "../lib/ids";
import { authGuard } from "../plugins/auth";

// Written before docs/openapi.yaml existed; the web app reads `terms`.
function present(row: Client) {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    ...(row.email ? { email: row.email } : {}),
    currency: row.currency,
    terms: row.paymentTerms.replace("_", "").toUpperCase(),
    status: row.status,
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.archivedAt ? { archivedAt: row.archivedAt.getTime() } : {}),
    createdAt: row.createdAt.getTime(),
  };
}

const findClient = (db: Db, orgId: string, id: string) =>
  db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.orgId, orgId)))
    .get();

export const clientRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/clients" })
    .use(authGuard(db))
    .get(
      "/",
      async ({ query, user }) => {
        const where = query.status
          ? and(eq(clients.orgId, user.orgId), eq(clients.status, query.status))
          : eq(clients.orgId, user.orgId);
        const rows = await db
          .select()
          .from(clients)
          .where(where)
          .orderBy(asc(clients.name));
        const [total] = await db
          .select({ value: count() })
          .from(clients)
          .where(where);
        return { items: rows.map(present), total: total?.value ?? 0 };
      },
      {
        requireAuth: true,
        query: t.Object({
          status: t.Optional(
            t.Union([t.Literal("active"), t.Literal("archived")]),
          ),
        }),
      },
    )
    .post(
      "/",
      async ({ body, user }) => {
        const [row] = await db
          .insert(clients)
          .values({
            id: newId("cli"),
            orgId: user.orgId,
            name: body.name,
            email: body.email,
            currency: body.currency.toUpperCase(),
            paymentTerms: body.paymentTerms ?? "net_30",
            notes: body.notes,
          })
          .returning();
        if (!row) throw new Error("insert returned no row");
        return present(row);
      },
      {
        requireAuth: true,
        body: t.Object({
          name: t.String({ minLength: 1 }),
          email: t.Optional(t.String()),
          currency: t.String({ minLength: 3, maxLength: 3 }),
          paymentTerms: t.Optional(
            t.Union([t.Literal("net_30"), t.Literal("next_month")]),
          ),
          notes: t.Optional(t.String()),
        }),
      },
    )
    .get(
      "/:id",
      async ({ params, user, status }) => {
        const row = await findClient(db, user.orgId, params.id);
        if (!row) return status(404, "Client not found");
        return present(row);
      },
      { requireAuth: true },
    )
    .patch(
      "/:id",
      async ({ params, body, user, status }) => {
        const row = await findClient(db, user.orgId, params.id);
        if (!row) return status(404, "Client not found");
        const [updated] = await db
          .update(clients)
          .set({
            name: body.name,
            email: body.email,
            currency: body.currency?.toUpperCase(),
            paymentTerms: body.paymentTerms,
            status: body.status,
            notes: body.notes,
          })
          .where(eq(clients.id, row.id))
          .returning();
        if (!updated) throw new Error("update returned no row");
        return present(updated);
      },
      {
        requireAuth: true,
        body: t.Object({
          name: t.Optional(t.String({ minLength: 1 })),
          email: t.Optional(t.String()),
          currency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
          paymentTerms: t.Optional(
            t.Union([t.Literal("net_30"), t.Literal("next_month")]),
          ),
          status: t.Optional(
            t.Union([t.Literal("active"), t.Literal("archived")]),
          ),
          notes: t.Optional(t.String()),
        }),
      },
    )
    .delete(
      "/:id",
      async ({ params, user, status }) => {
        const row = await findClient(db, user.orgId, params.id);
        if (!row) return status(404, "Client not found");
        await db.delete(clients).where(eq(clients.id, row.id));
        return { deleted: true };
      },
      { requireAuth: true },
    );
