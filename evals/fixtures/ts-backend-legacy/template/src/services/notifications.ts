import { and, desc, eq, isNull } from "drizzle-orm";

import type { Db } from "../db/client";
import { notifications, users } from "../db/schema";
import { newId } from "../lib/ids";
import { enqueue, registerJob } from "./jobs";
import { sendMail } from "./mailer";

export async function notify(
  db: Db,
  {
    orgId,
    userId,
    kind,
    payload = {},
    email,
  }: {
    orgId: string;
    userId: string;
    kind: string;
    payload?: Record<string, unknown>;
    email?: { subject: string; text: string };
  },
): Promise<void> {
  await db.insert(notifications).values({
    id: newId("ntf"),
    orgId,
    userId,
    kind,
    payload: JSON.stringify(payload),
  });
  if (email) await enqueue(db, "notification.email", { userId, ...email });
}

registerJob("notification.email", async (db, payload) => {
  const { userId, subject, text } = payload as {
    userId: string;
    subject: string;
    text: string;
  };
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return;
  await sendMail({ to: user.email, subject, text });
});

export async function notifyTaskAssigned(
  db: Db,
  task: { id: string; orgId: string; title: string },
  assigneeId: string,
): Promise<void> {
  await notify(db, {
    orgId: task.orgId,
    userId: assigneeId,
    kind: "task.assigned",
    payload: { taskId: task.id, title: task.title },
    email: {
      subject: `You were assigned: ${task.title}`,
      text: `You are now responsible for "${task.title}" (${task.id}).`,
    },
  });
}

export async function listNotifications(
  db: Db,
  userId: string,
  { unreadOnly = false }: { unreadOnly?: boolean } = {},
) {
  const rows = await db
    .select()
    .from(notifications)
    .where(
      unreadOnly
        ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
        : eq(notifications.userId, userId),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function markRead(db: Db, userId: string, id: string) {
  const updated = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  return updated.length > 0;
}
