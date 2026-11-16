import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("labels", () => {
  it("lists and creates labels", async () => {
    const { json } = await createTestContext();
    const created = await json("POST", "/api/labels", {
      token: SEED_TOKENS.acmeMember,
      body: { name: "backend", color: "#123456" },
    });
    expect(created.status).toBe(201);
    const { body } = await json<{ items: { name: string }[] }>(
      "GET",
      "/api/labels",
      {
        token: SEED_TOKENS.acmeMember,
      },
    );
    expect(body.items.map((label) => label.name)).toContain("backend");
  });

  it("refuses duplicates", async () => {
    const { request } = await createTestContext();
    const response = await request("POST", "/api/labels", {
      token: SEED_TOKENS.acmeAdmin,
      body: { name: "bug" },
    });
    expect(response.status).toBe(409);
  });
});
