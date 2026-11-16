import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { webhookSubscriptions } from "../db/schema";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;

// Acme (ada admin, bob member) must not see or change Globex data, and vice versa.
// Globex seed rows: task tsk_6 (comment cmt_globex, attachment att_globex), users usr_gina and usr_hal,
// project prj_infra with Hal's and Gina's time entries, webhook subscription whs_globex.
// Prompt: another org's data behaves as if it doesn't exist: 404 for anything addressed by id
// (directly or nested), nothing of it in lists, filters or exports.
const acme = SEED_TOKENS.acmeAdmin;
const acmeMember = SEED_TOKENS.acmeMember;

async function get(context: Context, path: string, token = acme) {
  const response = await context.request("GET", path, { token });
  return { status: response.status, text: await response.text() };
}

/** A list/filter/export either refuses (404) or answers without any of the other org's data. */
function expectNothingLeaked(result: { status: number; text: string }, secrets: string[]) {
  expect([200, 404]).toContain(result.status);
  for (const secret of secrets) expect(result.text).not.toContain(secret);
}

describe("hidden G4: tenant isolation", { timeout: 30_000 }, () => {
  it("hides another org's task by id", async () => {
    const context = await createTestContext();
    const result = await get(context, "/api/tasks/tsk_6");
    expect(result.status).toBe(404);
    expect(result.text).not.toContain("Rotate database credentials");
  });

  it("hides the comments of another org's task", async () => {
    const context = await createTestContext();
    const result = await get(context, "/api/tasks/tsk_6/comments", acmeMember);
    expect(result.status).toBe(404);
    expect(result.text).not.toContain("vault");
  });

  it("hides another org's user by id", async () => {
    const context = await createTestContext();
    const result = await get(context, "/api/users/usr_gina", acmeMember);
    expect(result.status).toBe(404);
    expect(result.text).not.toContain("gina@globex.test");
  });

  it("returns nothing of another org when the time-entry list is filtered by its user", async () => {
    const context = await createTestContext();
    expectNothingLeaked(await get(context, "/api/time-entries?userId=usr_hal"), ["te_8", "LB config", "prj_infra"]);
    expectNothingLeaked(await get(context, "/api/time-entries?userId=usr_gina&projectId=prj_infra", acmeMember), ["te_9", "prj_infra"]);
  });

  it("exports nothing of another org's project", async () => {
    const context = await createTestContext();
    expectNothingLeaked(await get(context, "/api/exports/time-entries.csv?projectId=prj_infra"), ["Hal Jordan", "Gina Globex", "Infrastructure", "LB config"]);
  });

  it("does not let an admin change another org's webhook subscription", async () => {
    const context = await createTestContext();
    const response = await context.request("PATCH", "/api/webhook-subscriptions/whs_globex", {
      token: acme,
      body: { url: "https://attacker.example/steal" },
    });
    expect(response.status).toBe(404);
    const stored = await context.db.select().from(webhookSubscriptions).where(eq(webhookSubscriptions.id, "whs_globex")).get();
    expect(stored?.url).toBe("https://hooks.globex.test/tasks");
  });

  it("hides another org's project in the deprecated v1 summary", async () => {
    const context = await createTestContext();
    const result = await get(context, "/api/v1/reports/projects/prj_infra/summary");
    expect(result.status).toBe(404);
    expect(result.text).not.toContain("Infrastructure");
  });

  it("hides another org's attachment by id", async () => {
    const context = await createTestContext();
    const result = await get(context, "/api/attachments/att_globex", acmeMember);
    expect(result.status).toBe(404);
    expect(result.text).not.toContain("db-credentials-runbook");
  });

  it("still serves an org's own records by id", async () => {
    const context = await createTestContext();
    expect((await get(context, "/api/tasks/tsk_2", acmeMember)).text).toContain("Design homepage");
    expect((await get(context, "/api/users/usr_sam", acmeMember)).text).toContain("sam@acme.test");
    expect((await get(context, "/api/attachments/att_acme", acmeMember)).text).toContain("homepage-v3.fig");
    const summary = await get(context, "/api/v1/reports/projects/prj_infra/summary", SEED_TOKENS.globexAdmin);
    expect(summary.status).toBe(200);
    expect(summary.text).toContain("Infrastructure");
    expect((await get(context, "/api/tasks/tsk_6", SEED_TOKENS.globexMember)).status).toBe(200);
  });

  it("still serves an org's own nested records, filters and exports", async () => {
    const context = await createTestContext();
    expect((await get(context, "/api/tasks/tsk_2/comments", acmeMember)).text).toContain("Mockups are in the shared drive.");
    expect((await get(context, "/api/time-entries?userId=usr_bob", acmeMember)).text).toContain("Hero section");
    expect((await get(context, "/api/time-entries?userId=usr_hal", SEED_TOKENS.globexAdmin)).text).toContain("LB config");
    const csv = await get(context, "/api/exports/time-entries.csv?projectId=prj_infra", SEED_TOKENS.globexAdmin);
    expect(csv.status).toBe(200);
    expect(csv.text).toContain("Hal Jordan");
  });

  it("still lets an admin change their own org's webhook subscription", async () => {
    const context = await createTestContext();
    const response = await context.request("PATCH", "/api/webhook-subscriptions/whs_globex", {
      token: SEED_TOKENS.globexAdmin,
      body: { url: "https://hooks.globex.test/v2" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "whs_globex", url: "https://hooks.globex.test/v2" });
  });
});
