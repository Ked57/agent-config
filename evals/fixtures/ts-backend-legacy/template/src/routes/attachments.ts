import { createHmac } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { attachments } from "../db/schema";
import { apiError } from "../lib/errors";
import { newId } from "../lib/ids";
import { authGuard } from "../plugins/auth";
import { getOrgTask } from "../services/tasks";

const STORAGE_BASE = "https://files.example.test";

/** A short-lived signed link to the object store. */
function downloadUrl(storageKey: string, now = Date.now()) {
  const expires = Math.floor(now / 1000) + 15 * 60;
  const signature = createHmac(
    "sha256",
    process.env.WEBHOOK_SECRET ?? "dev-secret",
  )
    .update(`${storageKey}:${expires}`)
    .digest("hex")
    .slice(0, 32);
  return `${STORAGE_BASE}/${storageKey}?expires=${expires}&sig=${signature}`;
}

const present = (row: typeof attachments.$inferSelect) => ({
  id: row.id,
  taskId: row.taskId,
  filename: row.filename,
  contentType: row.contentType,
  sizeBytes: row.sizeBytes,
  uploadedBy: row.uploadedBy,
  createdAt: row.createdAt.toISOString(),
});

export const attachmentRoutes = (db: Db) =>
  new Elysia({ prefix: "/api" })
    .use(authGuard(db))
    .get(
      "/tasks/:id/attachments",
      async ({ params, user, status }) => {
        const task = await getOrgTask(db, user.orgId, params.id);
        if (!task) return status(404, apiError("not_found", "task not found"));
        const rows = await db
          .select()
          .from(attachments)
          .where(eq(attachments.taskId, task.id))
          .orderBy(asc(attachments.createdAt), asc(attachments.id));
        return { items: rows.map(present) };
      },
      { requireAuth: true },
    )
    .post(
      "/tasks/:id/attachments",
      async ({ params, body, user, status }) => {
        const task = await getOrgTask(db, user.orgId, params.id);
        if (!task) return status(404, apiError("not_found", "task not found"));
        const id = newId("att");
        const [row] = await db
          .insert(attachments)
          .values({
            id,
            orgId: user.orgId,
            taskId: task.id,
            filename: body.filename,
            contentType: body.contentType,
            sizeBytes: body.sizeBytes,
            storageKey: `${user.orgId}/${task.id}/${id}`,
            uploadedBy: user.id,
          })
          .returning();
        if (!row) throw new Error("insert returned no row");
        return status(201, {
          ...present(row),
          uploadUrl: downloadUrl(row.storageKey),
        });
      },
      {
        requireAuth: true,
        body: t.Object({
          filename: t.String({ minLength: 1, maxLength: 255 }),
          contentType: t.String({ minLength: 1 }),
          sizeBytes: t.Integer({ minimum: 1, maximum: 50 * 1024 * 1024 }),
        }),
      },
    )
    .get(
      "/attachments/:id",
      async ({ params, status }) => {
        const row = await db
          .select()
          .from(attachments)
          .where(eq(attachments.id, params.id))
          .get();
        if (!row)
          return status(404, apiError("not_found", "attachment not found"));
        return { ...present(row), downloadUrl: downloadUrl(row.storageKey) };
      },
      { requireAuth: true },
    )
    .delete(
      "/attachments/:id",
      async ({ params, user, status }) => {
        const deleted = await db
          .delete(attachments)
          .where(
            and(
              eq(attachments.id, params.id),
              eq(attachments.orgId, user.orgId),
            ),
          )
          .returning();
        if (deleted.length === 0)
          return status(404, apiError("not_found", "attachment not found"));
        return new Response(null, { status: 204 });
      },
      { requireAuth: true },
    );
