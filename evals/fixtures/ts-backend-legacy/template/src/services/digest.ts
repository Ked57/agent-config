import { eq } from "drizzle-orm";

import { buildTimesheetV1 } from "../controllers/reports-v1.controller";
import type { Db } from "../db/client";
import { users } from "../db/schema";
import { registerJob } from "./jobs";
import { notify } from "./notifications";

/**
 * Monday digest: "you logged N hours last week". Enqueued by the scheduler
 * (ops cron) as `digest.weekly` with the org and any day of the week to sum.
 */
export async function sendWeeklyDigest(db: Db, orgId: string, day: string) {
  const report = await buildTimesheetV1(db, orgId, day);
  const people = await db.select().from(users).where(eq(users.orgId, orgId));
  let sent = 0;
  for (const person of people) {
    const rows = report.rows.filter((row) => row.user_id === person.id);
    if (rows.length === 0) continue;
    const hours = rows
      .reduce((sum, row) => sum + Number(row.hours), 0)
      .toFixed(2);
    await notify(db, {
      orgId,
      userId: person.id,
      kind: "digest.weekly",
      payload: { weekStart: report.week_start, hours, days: rows.length },
      email: {
        subject: `Your week of ${report.week_start}`,
        text: `You logged ${hours} hours on ${rows.length} day(s).`,
      },
    });
    sent += 1;
  }
  return sent;
}

registerJob("digest.weekly", async (db, payload) => {
  const { orgId, day } = payload as { orgId: string; day: string };
  await sendWeeklyDigest(db, orgId, day);
});
