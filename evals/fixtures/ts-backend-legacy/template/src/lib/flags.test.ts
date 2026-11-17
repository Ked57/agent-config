import { describe, expect, it } from "vitest";

import { isEnabled, parseFlags } from "./flags";

describe("feature flags", () => {
  it("falls back to defaults", () => {
    expect(parseFlags("{}").reportsV2).toBe(true);
    expect(parseFlags(null).webhooks).toBe(false);
  });

  it("reads stored booleans and ignores junk", () => {
    expect(parseFlags('{"webhooks":true,"reportsV2":"no"}')).toMatchObject({
      webhooks: true,
      reportsV2: true,
    });
    expect(parseFlags("not json").timeApprovals).toBe(false);
  });

  it("checks one flag for an org", () => {
    expect(
      isEnabled({ featureFlags: '{"timeApprovals":true}' }, "timeApprovals"),
    ).toBe(true);
    expect(isEnabled(undefined, "newInvoiceNumbers")).toBe(true);
  });
});
