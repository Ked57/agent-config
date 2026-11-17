import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("notifications and audit", () => {
  it("lists and marks notifications read", async () => {
    const { json, request } = await createTestContext();
    const unread = await json<{ items: { id: string }[] }>(
      "GET",
      "/api/notifications?unread=true",
      {
        token: SEED_TOKENS.acmeMember,
      },
    );
    expect(unread.body.items.map((n) => n.id)).toEqual(["ntf_1"]);
    expect(
      (
        await request("POST", "/api/notifications/ntf_1/read", {
          token: SEED_TOKENS.acmeMember,
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await request("POST", "/api/notifications/ntf_1/read", {
          token: SEED_TOKENS.acmeAdmin,
        })
      ).status,
    ).toBe(404);
  });

  it("shows the audit log to admins", async () => {
    const { json, request } = await createTestContext();
    await request("DELETE", "/api/tasks/tsk_4", {
      token: SEED_TOKENS.acmeAdmin,
    });
    const { body } = await json<{
      items: { action: string; entityId: string }[];
    }>("GET", "/api/audit", {
      token: SEED_TOKENS.acmeAdmin,
    });
    expect(body.items[0]).toMatchObject({
      action: "task.deleted",
      entityId: "tsk_4",
    });
    expect(
      (await request("GET", "/api/audit", { token: SEED_TOKENS.acmeMember }))
        .status,
    ).toBe(403);
  });
});
