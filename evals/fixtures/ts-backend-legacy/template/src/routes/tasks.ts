import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { apiError } from "../lib/errors";
import { authGuard } from "../plugins/auth";
import {
  deleteTask,
  getTask,
  labelNamesFor,
  setTaskLabels,
  toTaskResponse,
  updateTask,
} from "../services/tasks";

const day = t.String({ format: "date" });

export const taskRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/tasks" })
    .use(authGuard(db))
    .get(
      "/:id",
      async ({ params, status }) => {
        const task = await getTask(db, params.id);
        if (!task) return status(404, apiError("not_found", "task not found"));
        const labels = await labelNamesFor(db, [task.id]);
        return toTaskResponse(task, labels.get(task.id));
      },
      { requireAuth: true },
    )
    .patch(
      "/:id",
      async ({ params, body, user }) => {
        const { task, next } = await updateTask(db, user, params.id, body);
        const labels = await labelNamesFor(db, [task.id]);
        return {
          ...toTaskResponse(task, labels.get(task.id)),
          nextOccurrence: next ? toTaskResponse(next) : null,
        };
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
          assigneeId: t.Optional(t.Union([t.String(), t.Null()])),
          dueDate: t.Optional(t.Union([day, t.Null()])),
        }),
      },
    )
    .put(
      "/:id/labels",
      async ({ params, body, user }) => {
        const task = await setTaskLabels(db, user, params.id, body.labelIds);
        const labels = await labelNamesFor(db, [task.id]);
        return toTaskResponse(task, labels.get(task.id));
      },
      {
        requireAuth: true,
        body: t.Object({ labelIds: t.Array(t.String(), { maxItems: 20 }) }),
      },
    )
    .delete(
      "/:id",
      async ({ params, user, status }) => {
        if (user.role !== "admin")
          return status(403, apiError("forbidden", "admins only"));
        await deleteTask(db, user, params.id);
        return new Response(null, { status: 204 });
      },
      { requireAuth: true },
    );
