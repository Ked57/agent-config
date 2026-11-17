import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { billingEvents, invoices } from "../db/schema";
import { logger } from "../lib/logger";
import { toCents } from "../lib/legacy/money";
import { recordInvoicePayment } from "../services/ledger";

/**
 * Billing provider webhooks, authenticated with a shared secret header. The
 * provider sends amounts as decimals and retries until it gets a 2xx.
 */
export const webhookRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/webhooks" }).post(
    "/billing",
    async ({ body, headers, status }) => {
      const secret = process.env.WEBHOOK_SECRET;
      if (!secret || headers["x-webhook-secret"] !== secret) {
        return status(401, "invalid webhook secret");
      }
      const fresh = await db
        .insert(billingEvents)
        .values({ id: body.id, type: body.type })
        .onConflictDoNothing()
        .returning();
      if (fresh.length === 0) return { received: true, duplicate: true };

      if (body.type === "payment.succeeded" && body.data.invoiceId) {
        const invoice = await db
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.id, body.data.invoiceId),
              eq(invoices.orgId, body.data.orgId),
            ),
          )
          .get();
        if (!invoice) {
          logger.warn("billing.unknown_invoice", { eventId: body.id });
          return { received: true };
        }
        const amountCents = toCents(body.data.amount ?? 0);
        await recordInvoicePayment(
          db,
          invoice,
          amountCents,
          `provider event ${body.id}`,
        );
        logger.info("billing.payment_recorded", {
          eventId: body.id,
          invoiceId: invoice.id,
          amountCents,
        });
      }
      return { received: true };
    },
    {
      body: t.Object({
        id: t.String({ minLength: 1 }),
        type: t.String(),
        data: t.Object({
          orgId: t.String(),
          invoiceId: t.Optional(t.String()),
          amount: t.Optional(t.Number({ minimum: 0 })),
        }),
      }),
    },
  );
