import { eq } from "drizzle-orm";

import type { Db } from "../db/client";
import { users } from "../db/schema";
import { sendMail } from "./mailer";

export async function notifyTaskAssigned(
  db: Db,
  task: { id: string; title: string },
  assigneeId: string,
): Promise<void> {
  const assignee = await db
    .select()
    .from(users)
    .where(eq(users.id, assigneeId))
    .get();
  if (!assignee) return;
  await sendMail({
    to: assignee.email,
    subject: `You were assigned: ${task.title}`,
    text: `Hi ${assignee.name}, you are now responsible for "${task.title}" (${task.id}).`,
  });
}
