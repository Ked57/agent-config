import { describe, expect, it } from "vitest";

import { createTestContext } from "../test/helpers";

describe("GET /api/health", () => {
  it("responds without authentication", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
