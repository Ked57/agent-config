import { Elysia } from "elysia";

import type { Db } from "../db/client";
import {
  addDays,
  dayKey,
  dayStart,
  formatDay,
  isValidDay,
  weekStart,
} from "../lib/legacy/dates";
import { formatHours, fromCents } from "../lib/legacy/money";
import { authGuard } from "../plugins/auth";
import { recordAudit } from "../services/audit";
import {
  invoiceAgingRows,
  projectSummary,
  timesheetRows,
} from "../sql/reports.sql";

/**
 * @deprecated v1 reports, kept for the old mobile app and the payroll export.
 * Responses are snake_case with DD/MM/YYYY days and hours as strings.
 */

export interface TimesheetV1 {
  week_start: string;
  rows: {
    user_id: string;
    user_name: string;
    day: string;
    hours: string;
    billable_hours: string;
  }[];
  total_hours: string;
}

export async function buildTimesheetV1(
  db: Db,
  orgId: string,
  day: string,
): Promise<TimesheetV1> {
  const start = weekStart(day);
  const rows = await timesheetRows(
    db,
    orgId,
    dayStart(start),
    dayStart(addDays(start, 7)),
  );
  const grouped = new Map<string, TimesheetV1["rows"][number] & { m: number; b: number }>();
  let total = 0;
  for (const row of rows) {
    const key = `${row.user_id}|${dayKey(row.started_at)}`;
    const current = grouped.get(key) ?? {
      user_id: row.user_id,
      user_name: row.user_name,
      day: formatDay(dayKey(row.started_at)),
      hours: "",
      billable_hours: "",
      m: 0,
      b: 0,
    };
    current.m += row.minutes;
    if (row.billable === 1) current.b += row.minutes;
    grouped.set(key, current);
    total += row.minutes;
  }
  return {
    week_start: formatDay(start),
    rows: [...grouped.values()].map(({ m, b, ...row }) => ({
      ...row,
      hours: formatHours(m),
      billable_hours: formatHours(b),
    })),
    total_hours: formatHours(total),
  };
}

const auditView = (
  db: Db,
  user: { id: string; orgId: string },
  report: string,
  entityId: string,
) =>
  recordAudit(db, {
    orgId: user.orgId,
    actorId: user.id,
    action: "report.v1_viewed",
    entityType: "report",
    entityId,
    data: { report },
  });

export const reportsV1Controller = (db: Db) =>
  new Elysia({ prefix: "/api/v1/reports" })
    .use(authGuard(db))
    .get(
      "/timesheet",
      async ({ query, user, status }) => {
        const week = query.week ?? dayKey(Date.now());
        if (!isValidDay(week)) return status(400, { error: "bad week" });
        const report = await buildTimesheetV1(db, user.orgId, week);
        await auditView(db, user, "timesheet", weekStart(week));
        return report;
      },
      { requireAuth: true },
    )
    .get(
      "/projects/:id/summary",
      async ({ params, user, status }) => {
        const row = await projectSummary(db, params.id);
        if (!row) return status(404, { error: "project not found" });
        await auditView(db, user, "project_summary", row.id);
        return {
          project_id: row.id,
          project_name: row.name,
          total_hours: formatHours(row.total_minutes ?? 0),
          billable_hours: formatHours(row.billable_minutes ?? 0),
          amount: Math.round(row.amount_cents ?? 0) / 100,
          entries: row.entries,
        };
      },
      { requireAuth: true },
    )
    .get(
      "/invoices",
      async ({ user }) => {
        const rows = await invoiceAgingRows(db, user.orgId);
        const today = dayKey(Date.now());
        await auditView(db, user, "invoice_aging", user.orgId);
        return {
          invoices: rows.map((row) => ({
            number: row.number,
            client: row.client_name,
            status: row.status,
            issued: formatDay(row.issue_date),
            due: formatDay(row.due_date),
            total: fromCents(row.total_cents),
            paid: fromCents(row.paid_cents),
            days_overdue:
              row.status === "paid" || row.due_date >= today
                ? 0
                : Math.round(
                    (dayStart(today) - dayStart(row.due_date)) / 86_400_000,
                  ),
          })),
        };
      },
      { requireAuth: true },
    );
