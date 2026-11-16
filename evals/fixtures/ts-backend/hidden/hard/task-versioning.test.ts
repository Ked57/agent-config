import { afterEach, describe, expect, it } from "vitest";

import { setMailTransport, type MailMessage } from "../services/mailer";
import { createTestContext, SEED_TOKENS } from "../test/helpers";

afterEach(() => setMailTransport(async () => undefined));

type Context = Awaited<ReturnType<typeof createTestContext>>;
type TaskBody = { id: string; title: string; status: string; assigneeId: string | null; version: number };

const admin = SEED_TOKENS.acmeAdmin;

const patch = (request: Context["request"], id: string, body: Record<string, unknown>, ifMatch?: string, token = admin) =>
  request("PATCH", `/api/tasks/${id}`, { token, body, headers: ifMatch === undefined ? {} : { "if-match": ifMatch } });

async function current(request: Context["request"], id: string) {
  const response = await request("GET", `/api/tasks/${id}`, { token: admin });
  expect(response.status).toBe(200);
  return { etag: response.headers.get("etag"), task: (await response.json()) as TaskBody };
}

describe("hidden: optimistic concurrency on tasks", { timeout: 30_000 }, () => {
  it("starts existing and new tasks at version 1 with a quoted ETag", async () => {
    const { request } = await createTestContext();
    const seeded = await current(request, "tsk_4");
    expect(seeded.task.version).toBe(1);
    expect(seeded.etag).toBe('"1"');
    const created = await request("POST", "/api/projects/prj_app/tasks", { token: admin, body: { title: "Brand new" } });
    expect(created.status).toBe(201);
    const { id, version } = (await created.json()) as TaskBody;
    expect(version).toBe(1);
    expect((await current(request, id)).etag).toBe('"1"');
  });

  it("applies a PATCH sent with the current ETag and bumps the version", async () => {
    const { request } = await createTestContext();
    const { etag } = await current(request, "tsk_4");
    const response = await patch(request, "tsk_4", { title: "Renamed" }, etag ?? undefined);
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"2"');
    expect(await response.json()).toMatchObject({ title: "Renamed", version: 2 });
    expect((await current(request, "tsk_4")).task).toMatchObject({ title: "Renamed", version: 2 });
  });

  it("counts every successful change", async () => {
    const { request } = await createTestContext();
    expect((await patch(request, "tsk_4", { title: "One" }, '"1"')).status).toBe(200);
    expect((await patch(request, "tsk_4", { status: "in_progress" }, '"2"')).status).toBe(200);
    expect((await patch(request, "tsk_4", { assigneeId: "usr_bob" }, '"3"')).status).toBe(200);
    const { etag, task } = await current(request, "tsk_4");
    expect(task.version).toBe(4);
    expect(etag).toBe('"4"');
  });

  it("answers 428 to a PATCH without If-Match and changes nothing", async () => {
    const { request } = await createTestContext();
    expect((await patch(request, "tsk_4", { title: "No precondition" })).status).toBe(428);
    expect((await current(request, "tsk_4")).task).toMatchObject({ title: "Push notifications", version: 1 });
  });

  it("answers 412 with the current task to an outdated If-Match and changes nothing", async () => {
    const { request } = await createTestContext();
    expect((await patch(request, "tsk_4", { title: "First edit" }, '"1"')).status).toBe(200);
    const stale = await patch(request, "tsk_4", { title: "Lost update", status: "in_progress" }, '"1"');
    expect(stale.status).toBe(412);
    expect(await stale.json()).toMatchObject({ id: "tsk_4", title: "First edit", status: "todo", version: 2 });
    expect((await current(request, "tsk_4")).task).toMatchObject({ title: "First edit", status: "todo", version: 2 });
  });

  it("does not bump the version for a PATCH that changes nothing", async () => {
    const { request } = await createTestContext();
    const empty = await patch(request, "tsk_4", {}, '"1"');
    expect(empty.status).toBe(200);
    const same = await patch(request, "tsk_4", { title: "Push notifications", status: "todo", isUrgent: false }, '"1"');
    expect(same.status).toBe(200);
    expect(await same.json()).toMatchObject({ version: 1 });
    expect((await current(request, "tsk_4")).task.version).toBe(1);
    // The unchanged version is still the one to send.
    expect((await patch(request, "tsk_4", { title: "Now changed" }, '"1"')).status).toBe(200);
  });

  it("does not bump the version when the existing rules reject the change", async () => {
    const { request } = await createTestContext();
    expect((await patch(request, "tsk_4", { status: "done" }, '"1"')).status).toBe(409);
    expect((await patch(request, "tsk_4", { assigneeId: "usr_gina" }, '"1"')).status).toBe(400);
    expect((await current(request, "tsk_4")).task).toMatchObject({ status: "todo", assigneeId: null, version: 1 });
  });

  it("includes the version in project task lists", async () => {
    const { request } = await createTestContext();
    expect((await patch(request, "tsk_2", { title: "Design homepage v2" }, '"1"')).status).toBe(200);
    const list = (await (await request("GET", "/api/projects/prj_web/tasks", { token: admin })).json()) as { items: TaskBody[] };
    expect(list.items.map((item) => [item.id, item.version])).toEqual([
      ["tsk_1", 1],
      ["tsk_2", 2],
      ["tsk_3", 1],
    ]);
  });

  it("lets exactly one of several simultaneous edits with the same If-Match win", async () => {
    const { request } = await createTestContext();
    const titles = Array.from({ length: 8 }, (_, index) => `Edit ${index}`);
    const responses = await Promise.all(titles.map((title) => patch(request, "tsk_4", { title }, '"1"')));
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 412)).toHaveLength(7);
    const winner = titles[statuses.indexOf(200)];
    expect((await current(request, "tsk_4")).task).toMatchObject({ title: winner, version: 2 });
  });

  it("sends the assignment email only for the edit that won", async () => {
    const sent: MailMessage[] = [];
    setMailTransport(async (message) => {
      sent.push(message);
    });
    const { request } = await createTestContext();
    const assignees = ["usr_bob", "usr_ada", "usr_bob", "usr_ada", "usr_bob", "usr_ada"];
    const responses = await Promise.all(assignees.map((assigneeId) => patch(request, "tsk_4", { assigneeId }, '"1"')));
    const statuses = responses.map((response) => response.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    const { task } = await current(request, "tsk_4");
    expect(task.assigneeId).toBe(assignees[statuses.indexOf(200)]);
    expect(sent.map((message) => message.to)).toEqual([task.assigneeId === "usr_bob" ? "bob@acme.test" : "ada@acme.test"]);
  });

  it("answers 404, not 412, for another organization's task", async () => {
    const { request } = await createTestContext();
    expect((await patch(request, "tsk_4", { title: "Globex was here" }, '"1"', SEED_TOKENS.globexAdmin)).status).toBe(404);
    expect((await patch(request, "tsk_4", { title: "Globex was here" }, '"7"', SEED_TOKENS.globexAdmin)).status).toBe(404);
    expect((await current(request, "tsk_4")).task).toMatchObject({ title: "Push notifications", version: 1 });
  });
});
