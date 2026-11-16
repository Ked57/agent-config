import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("clients", () => {
  it("lists clients by name", async () => {
    const { json } = await createTestContext();
    const { body } = await json<{ items: { name: string; terms: string }[] }>(
      "GET",
      "/api/clients",
      {
        token: SEED_TOKENS.acmeMember,
      },
    );
    expect(body.items.map((c) => [c.name, c.terms])).toEqual([
      ["Initech", "NEXTMONTH"],
      ["Northwind Traders", "NET30"],
    ]);
  });

  it("creates a client", async () => {
    const { json } = await createTestContext();
    const { body } = await json("POST", "/api/clients", {
      token: SEED_TOKENS.acmeAdmin,
      body: { name: "Hooli", currency: "usd" },
    });
    expect(body).toMatchObject({
      name: "Hooli",
      currency: "USD",
      status: "active",
    });
  });
});
