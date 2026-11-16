import { and, asc, eq } from "drizzle-orm";
import { Elysia } from "elysia";

import type { Db } from "../db/client";
import { invoices, payments } from "../db/schema";
import { newId } from "../lib/ids";
import {
  findStoredResponse,
  storeResponse,
} from "../lib/legacy/idempotency";
import { toCents } from "../lib/legacy/money";
import { asBody, optionalString, requireNumber } from "../lib/legacy/validate";
import { authGuard } from "../plugins/auth";
import { recordAudit } from "../services/audit";
import { recordInvoicePayment } from "../services/ledger";

const METHODS = ["card", "bank", "cash"];

/**
 * Payments against invoices. The finance tool retries failed calls with the
 * same Idempotency-Key header; a retry gets the first response back.
 * Amounts are decimals in the invoice currency (v1 API contract).
 */
export const paymentsController = (db: Db) =>
  new Elysia({ prefix: "/api/invoices" })
    .use(authGuard(db))
    .get(
      "/:id/payments",
      async ({ params, user, status }) => {
        const invoice = await db
          .select()
          .from(invoices)
          .where(and(eq(invoices.id, params.id), eq(invoices.orgId, user.orgId)))
          .get();
        if (!invoice) return status(404, { error: "invoice not found" });
        const rows = await db
          .select()
          .from(payments)
          .where(eq(payments.invoiceId, invoice.id))
          .orderBy(asc(payments.receivedAt));
        return {
          items: rows.map((row) => ({
            id: row.id,
            amount: row.amount,
            method: row.method,
            reference: row.reference,
            receivedAt: row.receivedAt.toISOString(),
          })),
        };
      },
      { requireAuth: true },
    )
    .post(
      "/:id/payments",
      async ({ params, body, headers, user, status }) => {
        if (user.role !== "admin") return status(403, { error: "forbidden" });
        const key = headers["idempotency-key"];
        if (key) {
          const stored = await findStoredResponse(db, user.orgId, "payment", key);
          if (stored) return status(stored.statusCode, stored.body);
        }

        const input = asBody(body);
        const errors: string[] = [];
        const amount = requireNumber(input, "amount", errors);
        const method = optionalString(input, "method", errors) ?? "bank";
        const reference = optionalString(input, "reference", errors);
        if (amount !== undefined && amount <= 0)
          errors.push("amount must be positive");
        if (!METHODS.includes(method)) errors.push("unknown payment method");
        if (errors.length || amount === undefined)
          return status(400, { error: errors.join(", ") });

        const invoice = await db
          .select()
          .from(invoices)
          .where(and(eq(invoices.id, params.id), eq(invoices.orgId, user.orgId)))
          .get();
        if (!invoice) return status(404, { error: "invoice not found" });
        if (invoice.status !== "issued")
          return status(409, { error: `invoice is ${invoice.status}` });

        const id = newId("pay");
        const receivedAt = new Date();
        await db.insert(payments).values({
          id,
          orgId: user.orgId,
          invoiceId: invoice.id,
          amount,
          method,
          reference,
          receivedAt,
        });
        const amountCents = toCents(amount);
        const { paidCents } = await recordInvoicePayment(
          db,
          invoice,
          amountCents,
          `payment ${id} (${method})`,
        );
        await recordAudit(db, {
          orgId: user.orgId,
          actorId: user.id,
          action: "payment.recorded",
          entityType: "invoice",
          entityId: invoice.id,
          data: { paymentId: id, amountCents },
        });
        const response = {
          id,
          invoiceId: invoice.id,
          amount,
          amountCents,
          method,
          reference: reference ?? null,
          receivedAt: receivedAt.toISOString(),
          invoicePaidCents: paidCents,
        };
        if (key)
          await storeResponse(db, user.orgId, "payment", key, {
            statusCode: 201,
            body: response,
          });
        return status(201, response);
      },
      { requireAuth: true },
    );
