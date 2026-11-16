import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("reports v1 (deprecated)", () => {
  it("keeps the old timesheet format", async () => {
    const { json } = await createTestContext();
    const { body } = await json<{
      week_start: string;
      rows: Record<string, string>[];
      total_hours: string;
    }>("GET", "/api/v1/reports/timesheet?week=2026-11-09", {
      token: SEED_TOKENS.acmeAdmin,
    });
    expect(body.week_start).toBe("09/11/2026");
    expect(body.rows[0]).toEqual({
      user_id: "usr_ada",
      user_name: "Ada Lovelace",
      day: "10/11/2026",
      hours: "1.00",
      billable_hours: "1.00",
    });
  });

  it("summarises a project", async () => {
    const { json } = await createTestContext();
    const { body } = await json(
      "GET",
      "/api/v1/reports/projects/prj_web/summary",
      {
        token: SEED_TOKENS.acmeAdmin,
      },
    );
    expect(body).toMatchObject({
      project_id: "prj_web",
      total_hours: "8.25",
      entries: 4,
    });
  });
});
