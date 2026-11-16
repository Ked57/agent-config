import { Elysia } from "elysia";

import type { Db } from "../db/client";
import { newId } from "../lib/ids";
import { asBody, requireString } from "../lib/legacy/validate";
import { authGuard } from "../plugins/auth";
import {
  deleteComment,
  findComment,
  findTaskInOrg,
  insertComment,
  listCommentsForTask,
  type CommentRow,
} from "../sql/comments.sql";

function present(row: CommentRow) {
  return {
    id: row.id,
    taskId: row.task_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export const commentsController = (db: Db) =>
  new Elysia({ prefix: "/api" })
    .use(authGuard(db))
    .get(
      "/tasks/:id/comments",
      async ({ params }) => {
        const rows = await listCommentsForTask(db, params.id);
        return { items: rows.map(present) };
      },
      { requireAuth: true },
    )
    .post(
      "/tasks/:id/comments",
      async ({ params, body, user, status }) => {
        const errors: string[] = [];
        const text = requireString(asBody(body), "body", errors, { max: 5000 });
        if (!text) return status(400, { error: errors.join(", ") });
        const task = await findTaskInOrg(db, user.orgId, params.id);
        if (!task) return status(404, { error: "task not found" });
        const id = newId("cmt");
        await insertComment(db, {
          id,
          orgId: user.orgId,
          taskId: task.id,
          authorId: user.id,
          body: text,
        });
        const rows = await listCommentsForTask(db, task.id);
        const created = rows.find((row) => row.id === id);
        return status(201, created ? present(created) : { id });
      },
      { requireAuth: true },
    )
    .delete(
      "/comments/:id",
      async ({ params, user, status }) => {
        const comment = await findComment(db, user.orgId, params.id);
        if (!comment) return status(404, { error: "comment not found" });
        if (comment.author_id !== user.id && user.role !== "admin")
          return status(403, { error: "forbidden" });
        await deleteComment(db, comment.id);
        return new Response(null, { status: 204 });
      },
      { requireAuth: true },
    );
