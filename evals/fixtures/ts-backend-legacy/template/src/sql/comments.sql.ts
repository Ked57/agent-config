import { sql } from "drizzle-orm";

import type { Db } from "../db/client";

export interface CommentRow {
  id: string;
  org_id: string;
  task_id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  created_at: number;
}

export async function listCommentsForTask(db: Db, taskId: string) {
  return db.all<CommentRow>(sql`
    SELECT c.id, c.org_id, c.task_id, c.author_id, u.name AS author_name, c.body, c.created_at
    FROM comments c LEFT JOIN users u ON u.id = c.author_id
    WHERE c.task_id = ${taskId}
    ORDER BY c.created_at, c.id`);
}

export async function findTaskInOrg(db: Db, orgId: string, taskId: string) {
  return db.get<{ id: string } | undefined>(
    sql`SELECT id FROM tasks WHERE id = ${taskId} AND org_id = ${orgId}`,
  );
}

export async function insertComment(
  db: Db,
  row: {
    id: string;
    orgId: string;
    taskId: string;
    authorId: string;
    body: string;
  },
) {
  await db.run(sql`
    INSERT INTO comments (id, org_id, task_id, author_id, body, created_at)
    VALUES (${row.id}, ${row.orgId}, ${row.taskId}, ${row.authorId}, ${row.body}, ${Date.now()})`);
}

export async function findComment(db: Db, orgId: string, id: string) {
  return db.get<CommentRow | undefined>(sql`
    SELECT c.id, c.org_id, c.task_id, c.author_id, NULL AS author_name, c.body, c.created_at
    FROM comments c WHERE c.id = ${id} AND c.org_id = ${orgId}`);
}

export async function deleteComment(db: Db, id: string) {
  await db.run(sql`DELETE FROM comments WHERE id = ${id}`);
}
