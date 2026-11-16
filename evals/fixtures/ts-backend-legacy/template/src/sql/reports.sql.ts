import { sql } from "drizzle-orm";

import type { Db } from "../db/client";

// Queries behind the v1 reports. Do not add new callers: use src/services/reports.ts.

export interface TimesheetRow {
  user_id: string;
  user_name: string;
  started_at: number;
  minutes: number;
  billable: number;
}

export async function timesheetRows(
  db: Db,
  orgId: string,
  fromMs: number,
  toMs: number,
) {
  return db.all<TimesheetRow>(sql`
    SELECT u.id AS user_id, u.name AS user_name, te.started_at, te.minutes, te.billable
    FROM time_entries te JOIN users u ON u.id = te.user_id
    WHERE te.org_id = ${orgId} AND te.started_at >= ${fromMs} AND te.started_at < ${toMs}
    ORDER BY u.name, te.started_at`);
}

export interface ProjectSummaryRow {
  id: string;
  name: string;
  total_minutes: number | null;
  billable_minutes: number | null;
  amount_cents: number | null;
  entries: number;
}

export async function projectSummary(db: Db, projectId: string) {
  return db.get<ProjectSummaryRow | undefined>(sql`
    SELECT p.id, p.name,
      SUM(te.minutes) AS total_minutes,
      SUM(CASE WHEN te.billable = 1 THEN te.minutes ELSE 0 END) AS billable_minutes,
      SUM(CASE WHEN te.billable = 1
        THEN te.minutes * COALESCE(u.hourly_rate_cents, p.hourly_rate_cents) / 60.0
        ELSE 0 END) AS amount_cents,
      COUNT(te.id) AS entries
    FROM projects p
    LEFT JOIN time_entries te ON te.project_id = p.id
    LEFT JOIN users u ON u.id = te.user_id
    WHERE p.id = ${projectId}
    GROUP BY p.id`);
}

export interface InvoiceAgingRow {
  number: string;
  client_name: string;
  status: string;
  issue_date: string;
  due_date: string;
  total_cents: number;
  paid_cents: number;
}

export async function invoiceAgingRows(db: Db, orgId: string) {
  return db.all<InvoiceAgingRow>(sql`
    SELECT i.number, i.client_name, i.status, i.issue_date, i.due_date, i.total_cents,
      COALESCE((SELECT SUM(l.amount_cents) FROM ledger_entries l
        WHERE l.invoice_id = i.id AND l.kind = 'payment'), 0) AS paid_cents
    FROM invoices i
    WHERE i.org_id = ${orgId} AND i.status IN ('issued', 'paid')
    ORDER BY i.due_date, i.number`);
}
