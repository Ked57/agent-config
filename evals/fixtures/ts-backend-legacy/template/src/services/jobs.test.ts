import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { jobs } from "../db/schema";
import { createTestContext } from "../test/helpers";
import { enqueue, registerJob, runDueJobs } from "./jobs";

describe("job queue", () => {
  it("runs due jobs once", async () => {
    const { db } = await createTestContext();
    const seen: unknown[] = [];
    registerJob("test.echo", async (_db, payload) => {
      seen.push(payload);
    });
    await enqueue(db, "test.echo", { n: 1 });
    await enqueue(db, "test.echo", { n: 2 }, new Date(Date.now() + 60_000));
    expect(await runDueJobs(db)).toBe(1);
    expect(await runDueJobs(db)).toBe(0);
    expect(seen).toEqual([{ n: 1 }]);
  });

  it("retries failures with backoff and gives up after five attempts", async () => {
    const { db } = await createTestContext();
    registerJob("test.fail", async () => {
      throw new Error("boom");
    });
    const id = await enqueue(db, "test.fail", {});
    let now = Date.now();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      now += 60_000;
      await runDueJobs(db, new Date(now));
    }
    const job = await db.select().from(jobs).where(eq(jobs.id, id)).get();
    expect(job).toMatchObject({ status: "failed", attempts: 5 });
  });
});
