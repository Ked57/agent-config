import { describe, expect, it } from "vitest";

import { createTestContext } from "../test/helpers";

describe("GET /api/health", () => {
  it("answers ok", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/health");
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
