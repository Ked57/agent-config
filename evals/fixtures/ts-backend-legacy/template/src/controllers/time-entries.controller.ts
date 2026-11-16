import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";

import type { Db } from "../db/client";
import { projects, tasks } from "../db/schema";
import { newId } from "../lib/ids";
import { dayKey, isValidDay } from "../lib/legacy/dates";
import {
  asBody,
  optionalString,
  requirePositiveInt,
  requireString,
} from "../lib/legacy/validate";
import { authGuard } from "../plugins/auth";
import {
  deleteEntry,
  findEntries,
  findEntry,
  insertEntry,
  updateEntry,
  type TimeEntryRow,
} from "../sql/time-entries.sql";

const MAX_MINUTES = 24 * 60;

export function presentEntry(row: TimeEntryRow) {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    taskId: row.task_id,
    startedAt: new Date(row.started_at).toISOString(),
    day: dayKey(row.started_at),
    minutes: row.minutes,
    note: row.note,
    billable: row.billable === 1,
    invoiceId: row.invoice_id,
  };
}

export const timeEntriesController = (db: Db) =>
  new Elysia({ prefix: "/api/time-entries" })
    .use(authGuard(db))
    .get(
      "/",
      async ({ query, user, status }) => {
        if (query.date !== undefined && !isValidDay(query.date))
          return status(400, { error: "date must be YYYY-MM-DD" });
        const rows = await findEntries(db, {
          orgId: user.orgId,
          userId: query.userId,
          projectId: query.projectId,
          date: query.date,
        });
        return { items: rows.map(presentEntry) };
      },
      { requireAuth: true },
    )
    .post(
      "/",
      async ({ body, user, status }) => {
        const input = asBody(body);
        const errors: string[] = [];
        const projectId = requireString(input, "projectId", errors);
        const startedAtRaw = requireString(input, "startedAt", errors);
        const minutes = requirePositiveInt(input, "minutes", errors);
        const note = optionalString(input, "note", errors);
        const taskId = optionalString(input, "taskId", errors);
        const startedAt = startedAtRaw ? Date.parse(startedAtRaw) : NaN;
        if (startedAtRaw && Number.isNaN(startedAt))
          errors.push("startedAt must be an ISO timestamp");
        if (minutes !== undefined && minutes > MAX_MINUTES)
          errors.push("minutes cannot exceed 24 hours");
        if (input.billable !== undefined && typeof input.billable !== "boolean")
          errors.push("billable must be a boolean");
        if (errors.length || !projectId || minutes === undefined)
          return status(400, { error: errors.join(", ") });

        const project = await db
          .select()
          .from(projects)
          .where(
            and(eq(projects.id, projectId), eq(projects.orgId, user.orgId)),
          )
          .get();
        if (!project) return status(404, { error: "project not found" });
        if (taskId) {
          const task = await db
            .select()
            .from(tasks)
            .where(and(eq(tasks.id, taskId), eq(tasks.projectId, project.id)))
            .get();
          if (!task) return status(400, { error: "task not in project" });
        }
        const row: TimeEntryRow = {
          id: newId("te"),
          org_id: user.orgId,
          user_id: user.id,
          project_id: project.id,
          task_id: taskId ?? null,
          started_at: startedAt,
          minutes,
          note: note ?? null,
          billable: input.billable === false ? 0 : 1,
          invoice_id: null,
        };
        await insertEntry(db, { ...row, billable: row.billable === 1 });
        return status(201, presentEntry(row));
      },
      { requireAuth: true },
    )
    .patch(
      "/:id",
      async ({ params, body, user, status }) => {
        const entry = await findEntry(db, user.orgId, params.id);
        if (!entry) return status(404, { error: "time entry not found" });
        if (entry.user_id !== user.id && user.role !== "admin")
          return status(403, { error: "forbidden" });
        if (entry.invoice_id)
          return status(409, { error: "entry is already invoiced" });
        const input = asBody(body);
        const errors: string[] = [];
        let minutes: number | undefined;
        if (input.minutes !== undefined) {
          minutes = requirePositiveInt(input, "minutes", errors);
          if (minutes !== undefined && minutes > MAX_MINUTES)
            errors.push("minutes cannot exceed 24 hours");
        }
        const note =
          input.note === null ? null : optionalString(input, "note", errors);
        if (input.billable !== undefined && typeof input.billable !== "boolean")
          errors.push("billable must be a boolean");
        if (errors.length) return status(400, { error: errors.join(", ") });
        await updateEntry(db, entry.id, {
          minutes,
          note,
          billable: input.billable as boolean | undefined,
        });
        const updated = await findEntry(db, user.orgId, entry.id);
        return updated ? presentEntry(updated) : status(404, {});
      },
      { requireAuth: true },
    )
    .delete(
      "/:id",
      async ({ params, user, status }) => {
        const entry = await findEntry(db, user.orgId, params.id);
        if (!entry) return status(404, { error: "time entry not found" });
        if (entry.user_id !== user.id && user.role !== "admin")
          return status(403, { error: "forbidden" });
        if (entry.invoice_id)
          return status(409, { error: "entry is already invoiced" });
        await deleteEntry(db, entry.id);
        return new Response(null, { status: 204 });
      },
      { requireAuth: true },
    );
