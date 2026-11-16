import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Entry = { id: string; userId: string; day: string; minutes: number };

describe("time entries", () => {
  it("logs time against a project", async () => {
    const { json } = await createTestContext();
    const created = await json("POST", "/api/time-entries", {
      token: SEED_TOKENS.acmeMember,
      body: {
        projectId: "prj_web",
        taskId: "tsk_2",
        startedAt: "2026-11-13T10:00:00Z",
        minutes: 75,
      },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      userId: "usr_bob",
      minutes: 75,
      billable: true,
      day: "2026-11-13",
    });
  });

  it("validates input the old way", async () => {
    const { json } = await createTestContext();
    const bad = await json<{ error: string }>("POST", "/api/time-entries", {
      token: SEED_TOKENS.acmeMember,
      body: { projectId: "prj_web", startedAt: "yesterday", minutes: 0 },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("minutes must be a positive whole number");
  });

  it("lists the org's entries, newest first", async () => {
    const { json } = await createTestContext();
    const { body } = await json<{ items: Entry[] }>(
      "GET",
      "/api/time-entries",
      {
        token: SEED_TOKENS.acmeAdmin,
      },
    );
    expect(body.items.map((e) => e.id)).toEqual([
      "te_7",
      "te_6",
      "te_5",
      "te_4",
      "te_3",
      "te_2",
      "te_1",
    ]);
  });

  it("filters by person and project", async () => {
    const { json } = await createTestContext();
    const mine = await json<{ items: Entry[] }>(
      "GET",
      "/api/time-entries?userId=usr_bob&projectId=prj_web",
      {
        token: SEED_TOKENS.acmeMember,
      },
    );
    expect(mine.body.items.map((e) => e.id)).toEqual(["te_3", "te_2"]);
  });

  it("refuses to change invoiced entries", async () => {
    const { request } = await createTestContext();
    const response = await request("PATCH", "/api/time-entries/te_2", {
      token: SEED_TOKENS.acmeMember,
      body: { minutes: 10 },
    });
    expect(response.status).toBe(409);
  });

  it("lets people edit and delete their own entries", async () => {
    const { json, request } = await createTestContext();
    const edited = await json("PATCH", "/api/time-entries/te_3", {
      token: SEED_TOKENS.acmeMember,
      body: { minutes: 100, note: null },
    });
    expect(edited.body).toMatchObject({ minutes: 100, note: null });
    expect(
      (
        await request("DELETE", "/api/time-entries/te_4", {
          token: SEED_TOKENS.acmeMember,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("DELETE", "/api/time-entries/te_3", {
          token: SEED_TOKENS.acmeMember,
        })
      ).status,
    ).toBe(204);
  });
});
