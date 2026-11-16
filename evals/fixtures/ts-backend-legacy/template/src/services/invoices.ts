import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import {
  clients,
  invoiceLines,
  invoices,
  organizations,
  projects,
  timeEntries,
  users,
  type Invoice,
  type PaymentTerms,
} from "../db/schema";
import { HttpError } from "../lib/errors";
import { isEnabled } from "../lib/flags";
import { newId } from "../lib/ids";
import { addDays, addMonths, dayKey } from "../lib/legacy/dates";
import { amountForMinutes, fromCents, toCents } from "../lib/legacy/money";
import type { AuthUser } from "../plugins/auth";
import { recordAudit } from "./audit";
import { paidCents } from "./ledger";

export function dueDateFor(issueDate: string, terms: PaymentTerms): string {
  return terms === "next_month" ? addMonths(issueDate, 1) : addDays(issueDate, 30);
}

interface LineInput {
  description: string;
  minutes: number | null;
  unitPriceCents: number;
  amountCents: number;
  timeEntryId: string | null;
}

export interface NewInvoice {
  clientId?: string;
  clientName?: string;
  issueDate: string;
  terms?: PaymentTerms;
  repeat?: "none" | "monthly";
  currency?: string;
  lines?: { description: string; quantity?: number; unitPriceCents: number }[];
  timeEntryIds?: string[];
}

async function nextInvoiceNumber(db: Db, orgId: string, issueDate: string) {
  const org = await db
    .update(organizations)
    .set({ invoiceSeq: sql`${organizations.invoiceSeq} + 1` })
    .where(eq(organizations.id, orgId))
    .returning()
    .get();
  if (!org) throw new HttpError(404, "not_found", "organization not found");
  if (!isEnabled(org, "newInvoiceNumbers"))
    return `${Math.floor(Math.random() * 1e8)}`;
  return `INV-${issueDate.slice(0, 4)}-${String(org.invoiceSeq).padStart(4, "0")}`;
}

/** Lines for uninvoiced, billable time entries of the org. */
async function linesFromTimeEntries(db: Db, orgId: string, ids: string[]) {
  const rows = await db
    .select({
      entry: timeEntries,
      projectName: projects.name,
      projectRate: projects.hourlyRateCents,
      userRate: users.hourlyRateCents,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .where(and(inArray(timeEntries.id, ids), eq(timeEntries.orgId, orgId)))
    .orderBy(asc(timeEntries.startedAt), asc(timeEntries.id));
  if (rows.length !== new Set(ids).size)
    throw new HttpError(400, "invalid_entries", "unknown time entry");
  const lines: LineInput[] = [];
  for (const { entry, projectName, projectRate, userRate } of rows) {
    if (entry.invoiceId)
      throw new HttpError(
        409,
        "already_invoiced",
        `time entry ${entry.id} is already invoiced`,
      );
    if (!entry.billable)
      throw new HttpError(
        409,
        "not_billable",
        `time entry ${entry.id} is not billable`,
      );
    const rate = userRate ?? projectRate;
    lines.push({
      description: `${projectName}: ${entry.note ?? "Time"} (${dayKey(entry.startedAt)})`,
      minutes: entry.minutes,
      unitPriceCents: rate,
      amountCents: amountForMinutes(entry.minutes, rate),
      timeEntryId: entry.id,
    });
  }
  return lines;
}

async function insertInvoice(
  db: Db,
  orgId: string,
  fields: {
    clientId: string | null;
    clientName: string;
    issueDate: string;
    terms: PaymentTerms;
    repeat: "none" | "monthly";
    currency: string;
  },
  lines: LineInput[],
) {
  // Totals are summed in major units like the v1 invoice PDF did.
  const totalCents = toCents(
    lines.reduce((sum, line) => sum + fromCents(line.amountCents), 0),
  );
  const id = newId("inv");
  const [invoice] = await db
    .insert(invoices)
    .values({
      id,
      orgId,
      clientId: fields.clientId,
      clientName: fields.clientName,
      number: await nextInvoiceNumber(db, orgId, fields.issueDate),
      issueDate: fields.issueDate,
      dueDate: dueDateFor(fields.issueDate, fields.terms),
      terms: fields.terms,
      repeat: fields.repeat,
      currency: fields.currency,
      totalCents,
    })
    .returning();
  if (!invoice) throw new Error("insert returned no row");
  if (lines.length) {
    await db.insert(invoiceLines).values(
      lines.map((line, position) => ({
        id: newId("inl"),
        invoiceId: id,
        position,
        ...line,
      })),
    );
    const entryIds = lines.flatMap((line) =>
      line.timeEntryId ? [line.timeEntryId] : [],
    );
    if (entryIds.length)
      await db
        .update(timeEntries)
        .set({ invoiceId: id })
        .where(inArray(timeEntries.id, entryIds));
  }
  return invoice;
}

export async function createInvoice(db: Db, user: AuthUser, input: NewInvoice) {
  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, user.orgId))
    .get();
  if (!org) throw new HttpError(404, "not_found", "organization not found");
  let client: typeof clients.$inferSelect | undefined;
  if (input.clientId) {
    client = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, input.clientId), eq(clients.orgId, user.orgId)))
      .get();
    if (!client) throw new HttpError(400, "invalid_client", "unknown client");
  }
  const clientName = client?.name ?? input.clientName;
  if (!clientName)
    throw new HttpError(400, "invalid_client", "clientId or clientName is required");

  const lines: LineInput[] = (input.lines ?? []).map((line) => ({
    description: line.description,
    minutes: null,
    unitPriceCents: line.unitPriceCents,
    amountCents: (line.quantity ?? 1) * line.unitPriceCents,
    timeEntryId: null,
  }));
  if (input.timeEntryIds?.length)
    lines.push(
      ...(await linesFromTimeEntries(db, user.orgId, input.timeEntryIds)),
    );
  if (lines.length === 0)
    throw new HttpError(400, "empty_invoice", "an invoice needs at least one line");

  const invoice = await insertInvoice(
    db,
    user.orgId,
    {
      clientId: client?.id ?? null,
      clientName,
      issueDate: input.issueDate,
      terms: input.terms ?? client?.paymentTerms ?? org.paymentTerms,
      repeat: input.repeat ?? "none",
      currency: input.currency ?? client?.currency ?? org.currency,
    },
    lines,
  );
  await recordAudit(db, {
    orgId: user.orgId,
    actorId: user.id,
    action: "invoice.created",
    entityType: "invoice",
    entityId: invoice.id,
    data: { number: invoice.number, totalCents: invoice.totalCents },
  });
  return invoice;
}

export async function getOrgInvoice(db: Db, orgId: string, id: string) {
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.orgId, orgId)))
    .get();
}

export async function invoiceDetail(db: Db, invoice: Invoice) {
  const lines = await db
    .select()
    .from(invoiceLines)
    .where(eq(invoiceLines.invoiceId, invoice.id))
    .orderBy(asc(invoiceLines.position));
  const paid = await paidCents(db, invoice.id);
  return {
    ...toInvoiceSummary(invoice),
    lines: lines.map((line) => ({
      id: line.id,
      description: line.description,
      minutes: line.minutes,
      unitPriceCents: line.unitPriceCents,
      amountCents: line.amountCents,
      timeEntryId: line.timeEntryId,
    })),
    paidCents: paid,
    balanceCents: invoice.totalCents - paid,
  };
}

export function toInvoiceSummary(invoice: Invoice) {
  return {
    id: invoice.id,
    number: invoice.number,
    clientId: invoice.clientId,
    clientName: invoice.clientName,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    terms: invoice.terms,
    repeat: invoice.repeat,
    currency: invoice.currency,
    totalCents: invoice.totalCents,
    createdAt: invoice.createdAt.toISOString(),
  };
}

export async function listInvoices(
  db: Db,
  orgId: string,
  { status }: { status?: Invoice["status"] } = {},
) {
  return db
    .select()
    .from(invoices)
    .where(
      status
        ? and(eq(invoices.orgId, orgId), eq(invoices.status, status))
        : eq(invoices.orgId, orgId),
    )
    .orderBy(desc(invoices.issueDate), desc(invoices.number));
}

/** Issues a draft. A monthly invoice gets its next draft, one month later. */
export async function issueInvoice(db: Db, user: AuthUser, id: string) {
  const invoice = await getOrgInvoice(db, user.orgId, id);
  if (!invoice) throw new HttpError(404, "not_found", "invoice not found");
  if (invoice.status !== "draft")
    throw new HttpError(409, "invalid_status", `invoice is ${invoice.status}`);
  const [issued] = await db
    .update(invoices)
    .set({ status: "issued" })
    .where(eq(invoices.id, invoice.id))
    .returning();
  if (!issued) throw new Error("update returned no row");

  let next: Invoice | null = null;
  if (issued.repeat === "monthly") {
    const lines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, issued.id))
      .orderBy(asc(invoiceLines.position));
    next = await insertInvoice(
      db,
      user.orgId,
      {
        clientId: issued.clientId,
        clientName: issued.clientName,
        issueDate: addMonths(issued.issueDate, 1),
        terms: issued.terms,
        repeat: "monthly",
        currency: issued.currency,
      },
      // Time is billed once: only fixed-price lines repeat.
      lines
        .filter((line) => !line.timeEntryId)
        .map((line) => ({
          description: line.description,
          minutes: line.minutes,
          unitPriceCents: line.unitPriceCents,
          amountCents: line.amountCents,
          timeEntryId: null,
        })),
    );
  }
  await recordAudit(db, {
    orgId: user.orgId,
    actorId: user.id,
    action: "invoice.issued",
    entityType: "invoice",
    entityId: issued.id,
    data: { nextInvoiceId: next?.id ?? null },
  });
  return { invoice: issued, next };
}

export async function voidInvoice(db: Db, user: AuthUser, id: string) {
  const invoice = await getOrgInvoice(db, user.orgId, id);
  if (!invoice) throw new HttpError(404, "not_found", "invoice not found");
  if (invoice.status === "paid" || invoice.status === "void")
    throw new HttpError(409, "invalid_status", `invoice is ${invoice.status}`);
  const [voided] = await db
    .update(invoices)
    .set({ status: "void" })
    .where(eq(invoices.id, invoice.id))
    .returning();
  await db
    .update(timeEntries)
    .set({ invoiceId: null })
    .where(eq(timeEntries.invoiceId, invoice.id));
  await recordAudit(db, {
    orgId: user.orgId,
    actorId: user.id,
    action: "invoice.voided",
    entityType: "invoice",
    entityId: invoice.id,
  });
  return voided;
}
