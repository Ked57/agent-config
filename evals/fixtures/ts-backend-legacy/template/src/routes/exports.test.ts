import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

describe("exports", () => {
  it("exports invoices as CSV", async () => {
    const { request } = await createTestContext();
    const response = await request("GET", "/api/exports/invoices.csv", {
      token: SEED_TOKENS.acmeAdmin,
    });
    expect(response.headers.get("content-type")).toContain("text/csv");
    const lines = (await response.text()).trim().split("\n");
    expect(lines[0]).toBe(
      "number,client,issue_date,due_date,status,currency,total",
    );
    expect(lines[1]).toBe(
      "INV-2026-0001,Northwind Traders,15/10/2026,14/11/2026,issued,EUR,550.00",
    );
  });

  it("exports time entries in a date range", async () => {
    const { request } = await createTestContext();
    const response = await request(
      "GET",
      "/api/exports/time-entries.csv?from=2026-11-10&to=2026-11-10",
      {
        token: SEED_TOKENS.acmeAdmin,
      },
    );
    const lines = (await response.text()).trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      "10/11/2026,Ada Lovelace,Mobile app,Push notifications,60,1.00,yes,",
    );
  });
});
