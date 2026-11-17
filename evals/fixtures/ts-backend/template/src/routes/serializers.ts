import type { Task } from "../db/schema";

export function toTaskResponse(task: Task) {
  return {
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    isUrgent: task.isUrgent,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
