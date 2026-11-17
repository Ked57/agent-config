import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { tasks, users, type TaskStatus } from "../db/schema";
import { authGuard } from "../plugins/auth";
import { notifyTaskAssigned } from "../services/notifications";
import { toTaskResponse } from "./serializers";

export const taskRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/tasks" })
    .use(authGuard(db))
    .get(
      "/:id",
      async ({ params, status }) => {
        const task = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, params.id))
          .get();
        if (!task) return status(404, { error: "task not found" });
        return toTaskResponse(task);
      },
      { requireAuth: true },
    )
    .patch(
      "/:id",
      async ({ params, body, user, status }) => {
        const task = await db
          .select()
          .from(tasks)
          .where(and(eq(tasks.id, params.id), eq(tasks.orgId, user.orgId)))
          .get();
        if (!task) return status(404, { error: "task not found" });

        const changes: Partial<typeof tasks.$inferInsert> = {};

        if (body.title !== undefined) {
          const title = body.title.trim();
          if (title.length === 0)
            return status(400, { error: "title cannot be blank" });
          changes.title = title;
        }
        if (body.description !== undefined)
          changes.description = body.description;
        if (body.isUrgent !== undefined) changes.isUrgent = body.isUrgent;

        if (body.status !== undefined && body.status !== task.status) {
          const allowed: Record<TaskStatus, TaskStatus[]> = {
            todo: ["in_progress"],
            in_progress: ["todo", "done"],
            done: ["todo"],
          };
          if (!allowed[task.status].includes(body.status)) {
            return status(409, {
              error: `cannot move a task from ${task.status} to ${body.status}`,
            });
          }
          if (task.status === "done" && user.role !== "admin") {
            return status(403, {
              error: "only admins can reopen finished tasks",
            });
          }
          if (body.status === "done" && !(body.assigneeId ?? task.assigneeId)) {
            return status(409, {
              error: "assign the task before marking it done",
            });
          }
          changes.status = body.status;
        }

        let newAssignee: string | null = null;
        if (
          body.assigneeId !== undefined &&
          body.assigneeId !== task.assigneeId
        ) {
          if (body.assigneeId !== null) {
            const assignee = await db
              .select()
              .from(users)
              .where(
                and(eq(users.id, body.assigneeId), eq(users.orgId, user.orgId)),
              )
              .get();
            if (!assignee)
              return status(400, {
                error: "assignee must be a member of your organization",
              });
            newAssignee = assignee.id;
          }
          changes.assigneeId = body.assigneeId;
        }

        if (body.dueDate !== undefined) {
          if (body.dueDate !== null && task.status === "done") {
            return status(409, {
              error: "finished tasks cannot get a new due date",
            });
          }
          changes.dueDate = body.dueDate;
        }

        if (Object.keys(changes).length === 0) return toTaskResponse(task);
        changes.updatedAt = new Date();

        const [updated] = await db
          .update(tasks)
          .set(changes)
          .where(eq(tasks.id, task.id))
          .returning();
        if (!updated) throw new Error("update returned no row");
        if (newAssignee) await notifyTaskAssigned(db, updated, newAssignee);
        return toTaskResponse(updated);
      },
      {
        requireAuth: true,
        body: t.Object({
          title: t.Optional(t.String({ maxLength: 200 })),
          description: t.Optional(
            t.Union([t.String({ maxLength: 5000 }), t.Null()]),
          ),
          status: t.Optional(
            t.Union([
              t.Literal("todo"),
              t.Literal("in_progress"),
              t.Literal("done"),
            ]),
          ),
          isUrgent: t.Optional(t.Boolean()),
          assigneeId: t.Optional(t.Union([t.String(), t.Null()])),
          dueDate: t.Optional(
            t.Union([t.String({ format: "date" }), t.Null()]),
          ),
        }),
      },
    )
    .delete(
      "/:id",
      async ({ params, user, status }) => {
        if (user.role !== "admin") return status(403, "Forbidden");
        const deleted = await db
          .delete(tasks)
          .where(and(eq(tasks.id, params.id), eq(tasks.orgId, user.orgId)))
          .returning();
        if (deleted.length === 0)
          return status(404, { error: "task not found" });
        return new Response(null, { status: 204 });
      },
      { requireAuth: true },
    );
