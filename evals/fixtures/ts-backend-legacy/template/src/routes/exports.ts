import { and, asc, eq, gte, lte, type SQL } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { buildTimesheetV1 } from "../controllers/reports-v1.controller";
import type { Db } from "../db/client";
import { invoices, projects, tasks, timeEntries, users } from "../db/schema";
import { dayKey, dayStart, formatDay } from "../lib/legacy/dates";
import { formatHours, fromCents } from "../lib/legacy/money";
import { authGuard } from "../plugins/auth";

/** RFC 4180 field quoting. */
function csvField(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const csvLine = (fields: unknown[]) => fields.map(csvField).join(",");

const csvResponse = (filename: string, lines: string[]) =>
  new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });

const range = t.Object({
  from: t.Optional(t.String({ format: "date" })),
  to: t.Optional(t.String({ format: "date" })),
});

export const exportRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/exports" })
    .use(authGuard(db))
    .get(
      "/invoices.csv",
      async ({ query, user }) => {
        const conditions: SQL[] = [eq(invoices.orgId, user.orgId)];
        if (query.from) conditions.push(gte(invoices.issueDate, query.from));
        if (query.to) conditions.push(lte(invoices.issueDate, query.to));
        const rows = await db
          .select()
          .from(invoices)
          .where(and(...conditions))
          .orderBy(asc(invoices.issueDate), asc(invoices.number));
        const lines = [
          csvLine([
            "number",
            "client",
            "issue_date",
            "due_date",
            "status",
            "currency",
            "total",
          ]),
          ...rows.map((invoice) =>
            csvLine([
              invoice.number,
              invoice.clientName,
              formatDay(invoice.issueDate),
              formatDay(invoice.dueDate),
              invoice.status,
              invoice.currency,
              fromCents(invoice.totalCents).toFixed(2),
            ]),
          ),
        ];
        return csvResponse("invoices.csv", lines);
      },
      { requireAuth: true, query: range },
    )
    .get(
      "/time-entries.csv",
      async ({ query, user }) => {
        const conditions: SQL[] = query.projectId
          ? [eq(timeEntries.projectId, query.projectId)]
          : [eq(timeEntries.orgId, user.orgId)];
        if (query.from)
          conditions.push(
            gte(timeEntries.startedAt, new Date(dayStart(query.from))),
          );
        if (query.to)
          conditions.push(
            lte(
              timeEntries.startedAt,
              new Date(dayStart(query.to) + 86_399_999),
            ),
          );
        const rows = await db
          .select({
            entry: timeEntries,
            userName: users.name,
            projectName: projects.name,
            taskTitle: tasks.title,
          })
          .from(timeEntries)
          .innerJoin(users, eq(users.id, timeEntries.userId))
          .innerJoin(projects, eq(projects.id, timeEntries.projectId))
          .leftJoin(tasks, eq(tasks.id, timeEntries.taskId))
          .where(and(...conditions))
          .orderBy(asc(timeEntries.startedAt), asc(timeEntries.id));
        const lines = [
          csvLine([
            "date",
            "user",
            "project",
            "task",
            "minutes",
            "hours",
            "billable",
            "note",
          ]),
          ...rows.map(({ entry, userName, projectName, taskTitle }) =>
            csvLine([
              formatDay(dayKey(entry.startedAt)),
              userName,
              projectName,
              taskTitle,
              entry.minutes,
              formatHours(entry.minutes),
              entry.billable ? "yes" : "no",
              entry.note,
            ]),
          ),
        ];
        return csvResponse("time-entries.csv", lines);
      },
      {
        requireAuth: true,
        query: t.Object({
          projectId: t.Optional(t.String()),
          from: t.Optional(t.String({ format: "date" })),
          to: t.Optional(t.String({ format: "date" })),
        }),
      },
    )
    .get(
      "/payroll.csv",
      async ({ query, user }) => {
        const report = await buildTimesheetV1(
          db,
          user.orgId,
          query.week ?? dayKey(Date.now()),
        );
        const lines = [
          csvLine([
            "week",
            "user_id",
            "name",
            "day",
            "hours",
            "billable_hours",
          ]),
          ...report.rows.map((row) =>
            csvLine([
              report.week_start,
              row.user_id,
              row.user_name,
              row.day,
              row.hours,
              row.billable_hours,
            ]),
          ),
        ];
        return csvResponse("payroll.csv", lines);
      },
      {
        requireAuth: true,
        query: t.Object({ week: t.Optional(t.String({ format: "date" })) }),
      },
    );
