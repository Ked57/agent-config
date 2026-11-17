import { and, asc, eq, inArray } from "drizzle-orm";

import type { Db } from "../db/client";
import {
  labels,
  projects,
  taskLabels,
  tasks,
  users,
  type Task,
  type TaskStatus,
} from "../db/schema";
import { HttpError } from "../lib/errors";
import { newId } from "../lib/ids";
import { addDays, addMonths } from "../lib/legacy/dates";
import type { AuthUser } from "../plugins/auth";
import { recordAudit } from "./audit";
import { notifyTaskAssigned } from "./notifications";

export function toTaskResponse(task: Task, labelNames: string[] = []) {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate,
    repeat: task.repeat,
    labels: labelNames,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export async function labelNamesFor(db: Db, taskIds: string[]) {
  const byTask = new Map<string, string[]>();
  if (taskIds.length === 0) return byTask;
  const rows = await db
    .select({ taskId: taskLabels.taskId, name: labels.name })
    .from(taskLabels)
    .innerJoin(labels, eq(labels.id, taskLabels.labelId))
    .where(inArray(taskLabels.taskId, taskIds))
    .orderBy(asc(labels.name));
  for (const row of rows) {
    byTask.set(row.taskId, [...(byTask.get(row.taskId) ?? []), row.name]);
  }
  return byTask;
}

export async function getTask(db: Db, id: string) {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

export async function getOrgTask(db: Db, orgId: string, id: string) {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.orgId, orgId)))
    .get();
}

async function assertAssignable(db: Db, orgId: string, assigneeId: string) {
  const assignee = await db
    .select()
    .from(users)
    .where(and(eq(users.id, assigneeId), eq(users.orgId, orgId)))
    .get();
  if (!assignee) {
    throw new HttpError(
      400,
      "invalid_assignee",
      "assignee must be a member of your organization",
    );
  }
}

export interface NewTask {
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  repeat?: Task["repeat"];
}

export async function createTask(
  db: Db,
  user: AuthUser,
  projectId: string,
  input: NewTask,
) {
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.orgId, user.orgId)))
    .get();
  if (!project) throw new HttpError(404, "not_found", "project not found");
  if (input.assigneeId)
    await assertAssignable(db, user.orgId, input.assigneeId);
  if (input.repeat && input.repeat !== "none" && !input.dueDate) {
    throw new HttpError(
      400,
      "invalid_repeat",
      "repeating tasks need a due date",
    );
  }
  const [task] = await db
    .insert(tasks)
    .values({
      id: newId("tsk"),
      orgId: user.orgId,
      projectId,
      title: input.title.trim(),
      description: input.description,
      assigneeId: input.assigneeId,
      dueDate: input.dueDate,
      repeat: input.repeat ?? "none",
    })
    .returning();
  if (!task) throw new Error("insert returned no row");
  if (task.assigneeId) await notifyTaskAssigned(db, task, task.assigneeId);
  return task;
}

const transitions: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in_progress", "done"],
  in_progress: ["todo", "done"],
  done: ["todo"],
};

/** The due date of the next occurrence of a repeating task. */
function nextDueDate(task: Task): string | null {
  if (!task.dueDate) return null;
  if (task.repeat === "weekly") return addDays(task.dueDate, 7);
  if (task.repeat === "monthly") return addMonths(task.dueDate, 1);
  return null;
}

export interface TaskChanges {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export async function updateTask(
  db: Db,
  user: AuthUser,
  id: string,
  input: TaskChanges,
) {
  const task = await getOrgTask(db, user.orgId, id);
  if (!task) throw new HttpError(404, "not_found", "task not found");
  const changes: Partial<typeof tasks.$inferInsert> = {};
  if (input.title !== undefined) {
    if (input.title.trim().length === 0)
      throw new HttpError(400, "invalid_title", "title cannot be blank");
    changes.title = input.title.trim();
  }
  if (input.description !== undefined) changes.description = input.description;
  if (input.dueDate !== undefined) changes.dueDate = input.dueDate;
  if (input.assigneeId !== undefined && input.assigneeId !== task.assigneeId) {
    if (input.assigneeId !== null)
      await assertAssignable(db, user.orgId, input.assigneeId);
    changes.assigneeId = input.assigneeId;
  }
  if (input.status !== undefined && input.status !== task.status) {
    if (!transitions[task.status].includes(input.status)) {
      throw new HttpError(
        409,
        "invalid_transition",
        `cannot move a task from ${task.status} to ${input.status}`,
      );
    }
    changes.status = input.status;
  }
  if (Object.keys(changes).length === 0) return { task, next: null };
  changes.updatedAt = new Date();
  const [updated] = await db
    .update(tasks)
    .set(changes)
    .where(eq(tasks.id, task.id))
    .returning();
  if (!updated) throw new Error("update returned no row");

  let next: Task | null = null;
  if (changes.status === "done" && updated.repeat !== "none") {
    const dueDate = nextDueDate(updated);
    if (dueDate) {
      const [created] = await db
        .insert(tasks)
        .values({
          id: newId("tsk"),
          orgId: updated.orgId,
          projectId: updated.projectId,
          title: updated.title,
          description: updated.description,
          assigneeId: updated.assigneeId,
          dueDate,
          repeat: updated.repeat,
        })
        .returning();
      next = created ?? null;
    }
  }
  if (changes.assigneeId)
    await notifyTaskAssigned(db, updated, changes.assigneeId);
  await recordAudit(db, {
    orgId: user.orgId,
    actorId: user.id,
    action: "task.updated",
    entityType: "task",
    entityId: updated.id,
    data: { fields: Object.keys(changes).filter((key) => key !== "updatedAt") },
  });
  return { task: updated, next };
}

export async function deleteTask(db: Db, user: AuthUser, id: string) {
  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.orgId, user.orgId)))
    .returning();
  if (deleted.length === 0)
    throw new HttpError(404, "not_found", "task not found");
  await recordAudit(db, {
    orgId: user.orgId,
    actorId: user.id,
    action: "task.deleted",
    entityType: "task",
    entityId: id,
  });
}

export async function setTaskLabels(
  db: Db,
  user: AuthUser,
  id: string,
  labelIds: string[],
) {
  const task = await getOrgTask(db, user.orgId, id);
  if (!task) throw new HttpError(404, "not_found", "task not found");
  const found = labelIds.length
    ? await db
        .select()
        .from(labels)
        .where(and(inArray(labels.id, labelIds), eq(labels.orgId, user.orgId)))
    : [];
  if (found.length !== new Set(labelIds).size)
    throw new HttpError(400, "invalid_label", "unknown label");
  await db.delete(taskLabels).where(eq(taskLabels.taskId, id));
  if (found.length)
    await db
      .insert(taskLabels)
      .values(found.map((label) => ({ taskId: id, labelId: label.id })));
  return task;
}
