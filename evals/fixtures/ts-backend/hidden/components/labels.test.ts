import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

// K4: labels. POST /api/labels (admins; { name, color #rrggbb }; 201 { id, name, color };
// duplicate name in the org, ignoring case, is 409 { code: "label_exists" }), GET /api/labels
// ({ items } sorted by name), PUT/DELETE /api/tasks/:id/labels/:labelId (204; 404 for a task or
// label outside the caller's organization), GET /api/tasks/:id includes labels.
type Context = Awaited<ReturnType<typeof createTestContext>>;
type LabelBody = { id: string; name: string; color: string };

async function createLabel({ request }: Context, name: string, color = "#3366ff", token: string = SEED_TOKENS.acmeAdmin) {
  return request("POST", "/api/labels", { token, body: { name, color } });
}

async function labelId(context: Context, name: string, token: string = SEED_TOKENS.acmeAdmin) {
  const response = await createLabel(context, name, "#3366ff", token);
  expect(response.status).toBe(201);
  return ((await response.json()) as LabelBody).id;
}

describe("hidden: task labels", () => {
  it("creates labels and lists them by name", async () => {
    const context = await createTestContext();
    const created = await createLabel(context, "urgent-fix", "#ff0000");
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ id: expect.any(String), name: "urgent-fix", color: "#ff0000" });
    await labelId(context, "Backend");
    await labelId(context, "design");
    const listed = await context.request("GET", "/api/labels", { token: SEED_TOKENS.acmeMember });
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as { items: LabelBody[] };
    expect(body.items.map((label) => label.name)).toEqual(["Backend", "design", "urgent-fix"]);
  });

  it("refuses duplicate names in the same organization, ignoring case", async () => {
    const context = await createTestContext();
    await labelId(context, "Bug");
    const duplicate = await createLabel(context, "bug");
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ code: "label_exists" });
    expect((await createLabel(context, "Bug", "#3366ff", SEED_TOKENS.globexAdmin)).status).toBe(201);
    const globex = await context.request("GET", "/api/labels", { token: SEED_TOKENS.globexAdmin });
    expect(((await globex.json()) as { items: LabelBody[] }).items).toHaveLength(1);
  });

  it("only lets admins create labels and validates the color", async () => {
    const context = await createTestContext();
    expect((await createLabel(context, "Mine", "#3366ff", SEED_TOKENS.acmeMember)).status).toBe(403);
    for (const color of ["red", "#12345", "#gggggg"]) {
      const response = await createLabel(context, "Colour", color);
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }
    expect((await context.request("GET", "/api/labels")).status).toBe(401);
  });

  it("attaches and detaches labels on a task", async () => {
    const context = await createTestContext();
    const bug = await labelId(context, "Bug");
    const ux = await labelId(context, "UX");
    const token = SEED_TOKENS.acmeMember;
    expect((await context.request("PUT", `/api/tasks/tsk_2/labels/${ux}`, { token })).status).toBe(204);
    expect((await context.request("PUT", `/api/tasks/tsk_2/labels/${bug}`, { token })).status).toBe(204);
    expect((await context.request("PUT", `/api/tasks/tsk_2/labels/${bug}`, { token })).status).toBe(204);
    let task = await context.request("GET", "/api/tasks/tsk_2", { token });
    expect(((await task.json()) as { labels: LabelBody[] }).labels).toEqual([
      { id: bug, name: "Bug", color: "#3366ff" },
      { id: ux, name: "UX", color: "#3366ff" },
    ]);
    expect((await context.request("DELETE", `/api/tasks/tsk_2/labels/${bug}`, { token })).status).toBe(204);
    task = await context.request("GET", "/api/tasks/tsk_2", { token });
    expect(((await task.json()) as { labels: LabelBody[] }).labels.map((label) => label.name)).toEqual(["UX"]);
    const other = await context.request("GET", "/api/tasks/tsk_3", { token });
    expect(((await other.json()) as { labels: LabelBody[] }).labels).toEqual([]);
  });

  it("returns 404 for tasks or labels of another organization", async () => {
    const context = await createTestContext();
    const acmeLabel = await labelId(context, "Bug");
    const globexLabel = await labelId(context, "Ops", SEED_TOKENS.globexAdmin);
    const token = SEED_TOKENS.acmeAdmin;
    expect((await context.request("PUT", `/api/tasks/tsk_2/labels/${globexLabel}`, { token })).status).toBe(404);
    expect((await context.request("PUT", `/api/tasks/tsk_6/labels/${acmeLabel}`, { token })).status).toBe(404);
    expect((await context.request("PUT", "/api/tasks/tsk_2/labels/lbl_missing", { token })).status).toBe(404);
    expect((await context.request("DELETE", `/api/tasks/tsk_6/labels/${acmeLabel}`, { token })).status).toBe(404);
  });
});
