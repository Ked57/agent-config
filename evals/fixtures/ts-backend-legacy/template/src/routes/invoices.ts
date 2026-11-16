import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { apiError } from "../lib/errors";
import { authGuard } from "../plugins/auth";
import {
  createInvoice,
  getOrgInvoice,
  invoiceDetail,
  issueInvoice,
  listInvoices,
  toInvoiceSummary,
  voidInvoice,
} from "../services/invoices";

const terms = t.Union([t.Literal("net_30"), t.Literal("next_month")]);

export const invoiceRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/invoices" })
    .use(authGuard(db))
    .get(
      "/",
      async ({ query, user }) => {
        const rows = await listInvoices(db, user.orgId, query);
        return { items: rows.map(toInvoiceSummary) };
      },
      {
        requireAuth: true,
        query: t.Object({
          status: t.Optional(
            t.Union([
              t.Literal("draft"),
              t.Literal("issued"),
              t.Literal("paid"),
              t.Literal("void"),
            ]),
          ),
        }),
      },
    )
    .post(
      "/",
      async ({ body, user, status }) => {
        if (user.role !== "admin")
          return status(403, apiError("forbidden", "admins only"));
        const invoice = await createInvoice(db, user, body);
        return status(201, await invoiceDetail(db, invoice));
      },
      {
        requireAuth: true,
        body: t.Object({
          clientId: t.Optional(t.String()),
          clientName: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
          issueDate: t.String({ format: "date" }),
          terms: t.Optional(terms),
          repeat: t.Optional(
            t.Union([t.Literal("none"), t.Literal("monthly")]),
          ),
          currency: t.Optional(t.String({ minLength: 3, maxLength: 3 })),
          lines: t.Optional(
            t.Array(
              t.Object({
                description: t.String({ minLength: 1, maxLength: 500 }),
                quantity: t.Optional(t.Integer({ minimum: 1 })),
                unitPriceCents: t.Integer({ minimum: 0 }),
              }),
              { maxItems: 200 },
            ),
          ),
          timeEntryIds: t.Optional(t.Array(t.String(), { maxItems: 500 })),
        }),
      },
    )
    .get(
      "/:id",
      async ({ params, user, status }) => {
        const invoice = await getOrgInvoice(db, user.orgId, params.id);
        if (!invoice)
          return status(404, apiError("not_found", "invoice not found"));
        return invoiceDetail(db, invoice);
      },
      { requireAuth: true },
    )
    .post(
      "/:id/issue",
      async ({ params, user, status }) => {
        if (user.role !== "admin")
          return status(403, apiError("forbidden", "admins only"));
        const { invoice, next } = await issueInvoice(db, user, params.id);
        return {
          ...(await invoiceDetail(db, invoice)),
          nextInvoice: next ? toInvoiceSummary(next) : null,
        };
      },
      { requireAuth: true },
    )
    .post(
      "/:id/void",
      async ({ params, user, status }) => {
        if (user.role !== "admin")
          return status(403, apiError("forbidden", "admins only"));
        const invoice = await voidInvoice(db, user, params.id);
        if (!invoice)
          return status(404, apiError("not_found", "invoice not found"));
        return toInvoiceSummary(invoice);
      },
      { requireAuth: true },
    );
