import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";

import type { Db } from "../db/client";
import {
  labels,
  projects,
  taskLabels,
  tasks,
  timeEntries,
  users,
} from "../db/schema";
import { addDays, dayKey, dayStart, weekStart } from "../lib/legacy/dates";
import { amountForMinutes } from "../lib/legacy/money";

const byName = (a: string, b: string) => a.localeCompare(b);

export interface TimesheetUser {
  userId: string;
  name: string;
  days: Record<string, number>;
  totalMinutes: number;
  billableMinutes: number;
}

/** Minutes per person per day for the Monday-to-Sunday week containing `day`. */
export async function weeklyTimesheet(db: Db, orgId: string, day: string) {
  const start = weekStart(day);
  const end = addDays(start, 7);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const rows = await db
    .select({ entry: timeEntries, name: users.name })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .where(
      and(
        eq(timeEntries.orgId, orgId),
        gte(timeEntries.startedAt, new Date(dayStart(start))),
        lt(timeEntries.startedAt, new Date(dayStart(end))),
      ),
    )
    .orderBy(asc(timeEntries.startedAt));
  const people = new Map<string, TimesheetUser>();
  for (const { entry, name } of rows) {
    let person = people.get(entry.userId);
    if (!person) {
      person = {
        userId: entry.userId,
        name,
        days: Object.fromEntries(days.map((d) => [d, 0])),
        totalMinutes: 0,
        billableMinutes: 0,
      };
      people.set(entry.userId, person);
    }
    const key = dayKey(entry.startedAt);
    person.days[key] = (person.days[key] ?? 0) + entry.minutes;
    person.totalMinutes += entry.minutes;
    if (entry.billable) person.billableMinutes += entry.minutes;
  }
  const list = [...people.values()].sort((a, b) => byName(a.name, b.name));
  return {
    weekStart: start,
    days,
    users: list,
    totalMinutes: list.reduce((sum, person) => sum + person.totalMinutes, 0),
  };
}

interface ReportLine {
  minutes: number;
  billableMinutes: number;
  amountCents: number;
}

/**
 * Time and money per task and per person for one project.
 * Amounts use the person's own rate when set, else the project rate.
 */
export async function projectReport(db: Db, orgId: string, projectId: string) {
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
    .get();
  if (!project) return null;

  const people = new Map<
    string,
    { userId: string; name: string } & Omit<ReportLine, "billableMinutes">
  >();
  const totals = { minutes: 0, billableMinutes: 0, amountCents: 0, entries: 0 };

  const tally = async (entries: (typeof timeEntries.$inferSelect)[]) => {
    const line: ReportLine = { minutes: 0, billableMinutes: 0, amountCents: 0 };
    let last: Date | null = null;
    for (const entry of entries) {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, entry.userId))
        .get();
      const rate = user?.hourlyRateCents ?? project.hourlyRateCents;
      const amount = entry.billable ? amountForMinutes(entry.minutes, rate) : 0;
      line.minutes += entry.minutes;
      if (entry.billable) line.billableMinutes += entry.minutes;
      line.amountCents += amount;
      if (!last || entry.startedAt > last) last = entry.startedAt;
      const person = people.get(entry.userId) ?? {
        userId: entry.userId,
        name: user?.name ?? "Unknown",
        minutes: 0,
        amountCents: 0,
      };
      person.minutes += entry.minutes;
      person.amountCents += amount;
      people.set(entry.userId, person);
    }
    totals.minutes += line.minutes;
    totals.billableMinutes += line.billableMinutes;
    totals.amountCents += line.amountCents;
    totals.entries += entries.length;
    return { ...line, lastLoggedAt: last ? last.toISOString() : null };
  };

  const taskRows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, project.id));
  const taskReports = [];
  for (const task of taskRows) {
    const entries = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.taskId, task.id));
    const labelRows = await db
      .select({ name: labels.name })
      .from(taskLabels)
      .innerJoin(labels, eq(labels.id, taskLabels.labelId))
      .where(eq(taskLabels.taskId, task.id));
    taskReports.push({
      id: task.id,
      title: task.title,
      status: task.status,
      labels: labelRows.map((row) => row.name).sort(byName),
      ...(await tally(entries)),
    });
  }
  taskReports.sort(
    (a, b) => byName(a.title, b.title) || (a.id < b.id ? -1 : 1),
  );

  const unassigned = await tally(
    await db
      .select()
      .from(timeEntries)
      .where(
        and(eq(timeEntries.projectId, project.id), isNull(timeEntries.taskId)),
      ),
  );

  return {
    project: {
      id: project.id,
      name: project.name,
      hourlyRateCents: project.hourlyRateCents,
    },
    totals,
    tasks: taskReports,
    unassignedMinutes: unassigned.minutes,
    people: [...people.values()].sort(
      (a, b) => b.minutes - a.minutes || byName(a.name, b.name),
    ),
  };
}
