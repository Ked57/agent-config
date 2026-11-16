import { and, asc, count, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { clients, projects, tasks } from "../db/schema";
import { apiError } from "../lib/errors";
import { newId } from "../lib/ids";
import { authGuard } from "../plugins/auth";
import { recordAudit } from "../services/audit";
import { createTask, labelNamesFor, toTaskResponse } from "../services/tasks";

const toProjectResponse = (project: typeof projects.$inferSelect) => ({
  id: project.id,
  clientId: project.clientId,
  name: project.name,
  description: project.description,
  hourlyRateCents: project.hourlyRateCents,
  createdAt: project.createdAt.toISOString(),
});

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
        const counts = await db
          .select({ projectId: tasks.projectId, total: count() })
          .from(tasks)
          .where(eq(tasks.orgId, user.orgId))
          .groupBy(tasks.projectId);
        const byProject = new Map(counts.map((row) => [row.projectId, row]));
        return {
          items: rows.map((project) => ({
            ...toProjectResponse(project),
            taskCount: byProject.get(project.id)?.total ?? 0,
          })),
        };
      },
      { requireAuth: true },
    )
    .post(
      "/",
      async ({ body, user, status }) => {
        if (user.role !== "admin")
          return status(403, apiError("forbidden", "admins only"));
        if (body.clientId) {
          const client = await db
            .select()
            .from(clients)
            .where(
              and(eq(clients.id, body.clientId), eq(clients.orgId, user.orgId)),
            )
            .get();
          if (!client)
            return status(400, apiError("invalid_client", "unknown client"));
        }
        const [project] = await db
          .insert(projects)
          .values({
            id: newId("prj"),
            orgId: user.orgId,
            clientId: body.clientId,
            name: body.name.trim(),
            description: body.description,
            hourlyRateCents: body.hourlyRateCents ?? 0,
          })
          .returning();
        if (!project) throw new Error("insert returned no row");
        await recordAudit(db, {
          orgId: user.orgId,
          actorId: user.id,
          action: "project.created",
          entityType: "project",
          entityId: project.id,
        });
        return status(201, toProjectResponse(project));
      },
      {
        requireAuth: true,
        body: t.Object({
          name: t.String({ minLength: 1, maxLength: 100 }),
          description: t.Optional(t.String({ maxLength: 2000 })),
          clientId: t.Optional(t.String()),
          hourlyRateCents: t.Optional(t.Integer({ minimum: 0 })),
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
        if (!project)
          return status(404, apiError("not_found", "project not found"));
        return toProjectResponse(project);
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
        if (!project)
          return status(404, apiError("not_found", "project not found"));
        const rows = await db
          .select()
          .from(tasks)
          .where(eq(tasks.projectId, project.id))
          .orderBy(asc(tasks.createdAt), asc(tasks.id));
        const labels = await labelNamesFor(
          db,
          rows.map((row) => row.id),
        );
        return {
          items: rows.map((row) => toTaskResponse(row, labels.get(row.id))),
        };
      },
      { requireAuth: true },
    )
    .post(
      "/:id/tasks",
      async ({ params, body, user, status }) => {
        const task = await createTask(db, user, params.id, body);
        return status(201, toTaskResponse(task));
      },
      {
        requireAuth: true,
        body: t.Object({
          title: t.String({ minLength: 1, maxLength: 200 }),
          description: t.Optional(t.String({ maxLength: 5000 })),
          assigneeId: t.Optional(t.String()),
          dueDate: t.Optional(t.String({ format: "date" })),
          repeat: t.Optional(
            t.Union([
              t.Literal("none"),
              t.Literal("weekly"),
              t.Literal("monthly"),
            ]),
          ),
        }),
      },
    );
