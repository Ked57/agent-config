import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("webhook subscriptions", () => {
  it("creates a subscription and shows the secret once", async () => {
    const { json } = await createTestContext();
    const created = await json<{ id: string; secret: string }>(
      "POST",
      "/api/webhook-subscriptions",
      {
        token: SEED_TOKENS.acmeAdmin,
        body: {
          url: "https://hooks.acme.test/tasks",
          events: ["task.completed"],
        },
      },
    );
    expect(created.status).toBe(201);
    expect(created.body.secret).toBeTruthy();
    const list = await json<{ items: Record<string, unknown>[] }>(
      "GET",
      "/api/webhook-subscriptions",
      {
        token: SEED_TOKENS.acmeAdmin,
      },
    );
    expect(list.body.items).toHaveLength(2);
    expect(list.body.items.every((item) => !("secret" in item))).toBe(true);
  });

  it("is admin only", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/webhook-subscriptions", {
      token: SEED_TOKENS.acmeMember,
    });
    expect(response.status).toBe(403);
  });
});
