import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Timesheet = {
  weekStart: string;
  users: {
    userId: string;
    days: Record<string, number>;
    totalMinutes: number;
    billableMinutes: number;
  }[];
  totalMinutes: number;
};

describe("reports v2", () => {
  it("builds the weekly timesheet from any day of the week", async () => {
    const { json } = await createTestContext();
    const { body } = await json<Timesheet>(
      "GET",
      "/api/reports/timesheet?week=2026-11-12",
      {
        token: SEED_TOKENS.acmeAdmin,
      },
    );
    expect(body.weekStart).toBe("2026-11-09");
    const ada = body.users.find((user) => user.userId === "usr_ada");
    expect(ada).toMatchObject({ totalMinutes: 90, billableMinutes: 60 });
    expect(ada?.days["2026-11-10"]).toBe(60);
  });

  it("reports a project's time and money", async () => {
    const { json } = await createTestContext();
    const { body } = await json<{
      totals: { minutes: number; amountCents: number };
      tasks: { id: string }[];
      people: { userId: string }[];
    }>("GET", "/api/reports/projects/prj_web", {
      token: SEED_TOKENS.acmeAdmin,
    });
    expect(body.totals).toMatchObject({ minutes: 495, amountCents: 74625 });
    expect(body.tasks.map((task) => task.id)).toEqual([
      "tsk_2",
      "tsk_3",
      "tsk_1",
    ]);
    expect(body.people.map((person) => person.userId)).toEqual([
      "usr_bob",
      "usr_ada",
      "usr_sam",
    ]);
  });

  it("is org scoped", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/reports/projects/prj_infra", {
      token: SEED_TOKENS.acmeAdmin,
    });
    expect(response.status).toBe(404);
  });
});
