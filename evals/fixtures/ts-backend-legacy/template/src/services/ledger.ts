import { and, asc, eq, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import { invoices, ledgerEntries } from "../db/schema";
import { newId } from "../lib/ids";

/** Cents paid on an invoice so far (payment entries only). */
export async function paidCents(db: Db, invoiceId: string): Promise<number> {
  const row = await db
    .select({
      total: sql<number>`coalesce(sum(${ledgerEntries.amountCents}), 0)`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.invoiceId, invoiceId),
        eq(ledgerEntries.kind, "payment"),
      ),
    )
    .get();
  return Number(row?.total ?? 0);
}

/** Records money received against an invoice and marks it paid once covered. */
export async function recordInvoicePayment(
  db: Db,
  invoice: { id: string; orgId: string; totalCents: number },
  amountCents: number,
  memo: string,
) {
  const id = newId("led");
  await db.insert(ledgerEntries).values({
    id,
    orgId: invoice.orgId,
    invoiceId: invoice.id,
    kind: "payment",
    amountCents,
    memo,
  });
  const paid = await paidCents(db, invoice.id);
  if (paid >= invoice.totalCents) {
    await db
      .update(invoices)
      .set({ status: "paid" })
      .where(eq(invoices.id, invoice.id));
  }
  return { ledgerEntryId: id, paidCents: paid };
}

export async function listLedger(
  db: Db,
  orgId: string,
  { invoiceId }: { invoiceId?: string } = {},
) {
  const rows = await db
    .select()
    .from(ledgerEntries)
    .where(
      invoiceId
        ? and(
            eq(ledgerEntries.orgId, orgId),
            eq(ledgerEntries.invoiceId, invoiceId),
          )
        : eq(ledgerEntries.orgId, orgId),
    )
    .orderBy(asc(ledgerEntries.createdAt), asc(ledgerEntries.id));
  const entries = rows.map((row) => ({
    id: row.id,
    invoiceId: row.invoiceId,
    kind: row.kind,
    amountCents: row.amountCents,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
  }));
  const balanceCents = entries.reduce((sum, row) => sum + row.amountCents, 0);
  return { entries, balanceCents };
}
