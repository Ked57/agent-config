import { and, asc, count, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { projects, tasks, users } from "../db/schema";
import { newId } from "../lib/ids";
import { authGuard } from "../plugins/auth";
import { notifyTaskAssigned } from "../services/notifications";
import { toTaskResponse } from "./serializers";

export const projectRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/projects" })
    .use(authGuard(db))
    .get(
      "/",
      async ({ user }) => {
        const rows = await db
          .select()
          .from(projects)
          .where(eq(projects.orgId, user.orgId))
          .orderBy(asc(projects.name));
        const items = [];
        for (const project of rows) {
          const counts = await db
            .select({ status: tasks.status, total: count() })
            .from(tasks)
            .where(eq(tasks.projectId, project.id))
            .groupBy(tasks.status);
          const taskCounts = { todo: 0, in_progress: 0, done: 0 };
          for (const row of counts) taskCounts[row.status] = row.total;
          items.push({
            id: project.id,
            name: project.name,
            description: project.description,
            createdAt: project.createdAt.toISOString(),
            taskCounts,
          });
        }
        return { items };
      },
      { requireAuth: true },
    )
    .post(
      "/",
      async ({ body, user, status }) => {
        const [project] = await db
          .insert(projects)
          .values({
            id: newId("prj"),
            orgId: user.orgId,
            name: body.name,
            description: body.description,
          })
          .returning();
        return status(201, project);
      },
      {
        requireAuth: true,
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 100 }),
          description: t.Optional(t.String({ maxLength: 2000 })),
        }),
      },
    )
    .get(
      "/:id",
      async ({ params, user, status }) => {
        const project = await db
          .select()
          .from(projects)
          .where(
            and(eq(projects.id, params.id), eq(projects.orgId, user.orgId)),
          )
          .get();
        if (!project) return status(404, "Project not found");
        return project;
      },
      { requireAuth: true },
    )
    .get(
      "/:id/tasks",
      async ({ params, user, status }) => {
        const project = await db
          .select()
          .from(projects)
          .where(
            and(eq(projects.id, params.id), eq(projects.orgId, user.orgId)),
          )
          .get();
        if (!project) return status(404, "Project not found");
        const rows = await db
          .select()
          .from(tasks)
          .where(eq(tasks.projectId, project.id))
          .orderBy(asc(tasks.createdAt));
        return { items: rows.map(toTaskResponse) };
      },
      { requireAuth: true },
    )
    .post(
      "/:id/tasks",
      async ({ params, body, user, status }) => {
        const project = await db
          .select()
          .from(projects)
          .where(
            and(eq(projects.id, params.id), eq(projects.orgId, user.orgId)),
          )
          .get();
        if (!project) return status(404, "Project not found");
        if (body.assigneeId) {
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
        }
        const [task] = await db
          .insert(tasks)
          .values({
            id: newId("tsk"),
            orgId: user.orgId,
            projectId: project.id,
            title: body.title,
            description: body.description,
            isUrgent: body.isUrgent ?? false,
            assigneeId: body.assigneeId,
            dueDate: body.dueDate,
          })
          .returning();
        if (!task) throw new Error("insert returned no row");
        if (task.assigneeId)
          await notifyTaskAssigned(db, task, task.assigneeId);
        return status(201, toTaskResponse(task));
      },
      {
        requireAuth: true,
        body: t.Object({
          title: t.String({ minLength: 1, maxLength: 200 }),
          description: t.Optional(t.String({ maxLength: 5000 })),
          isUrgent: t.Optional(t.Boolean()),
          assigneeId: t.Optional(t.String()),
          dueDate: t.Optional(t.String({ format: "date" })),
        }),
      },
    );
