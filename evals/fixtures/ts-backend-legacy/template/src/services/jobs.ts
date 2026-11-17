import { and, asc, eq, lte } from "drizzle-orm";

import type { Db } from "../db/client";
import { jobs } from "../db/schema";
import { newId } from "../lib/ids";
import { logger } from "../lib/logger";

/**
 * A tiny database-backed job queue. `runDueJobs` is called by the worker loop in
 * src/index.ts every few seconds and directly by tests.
 */
export type JobHandler = (db: Db, payload: unknown) => Promise<void>;

const handlers = new Map<string, JobHandler>();
const MAX_ATTEMPTS = 5;

export function registerJob(kind: string, handler: JobHandler): void {
  handlers.set(kind, handler);
}

export async function enqueue(
  db: Db,
  kind: string,
  payload: unknown,
  runAt = new Date(),
): Promise<string> {
  const id = newId("job");
  await db
    .insert(jobs)
    .values({ id, kind, payload: JSON.stringify(payload), runAt });
  return id;
}

export async function runDueJobs(db: Db, now = new Date()): Promise<number> {
  const due = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "queued"), lte(jobs.runAt, now)))
    .orderBy(asc(jobs.runAt))
    .limit(20);
  for (const job of due) {
    const handler = handlers.get(job.kind);
    try {
      if (!handler) throw new Error(`no handler for ${job.kind}`);
      await handler(db, JSON.parse(job.payload));
      await db
        .update(jobs)
        .set({ status: "done", attempts: job.attempts + 1 })
        .where(eq(jobs.id, job.id));
    } catch (error) {
      const attempts = job.attempts + 1;
      logger.warn("job.failed", { id: job.id, kind: job.kind, attempts });
      await db
        .update(jobs)
        .set({
          attempts,
          lastError: String(error),
          status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
          runAt: new Date(now.getTime() + 2 ** attempts * 1000),
        })
        .where(eq(jobs.id, job.id));
    }
  }
  return due.length;
}
