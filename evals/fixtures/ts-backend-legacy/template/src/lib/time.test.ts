import { describe, expect, it } from "vitest";

import { isValidTimeZone, zonedDay } from "./time";

describe("time", () => {
  it("gives the local calendar day in a time zone", () => {
    const instant = Date.parse("2026-11-09T23:00:00Z");
    expect(zonedDay(instant, "UTC")).toBe("2026-11-09");
    expect(zonedDay(instant, "Australia/Sydney")).toBe("2026-11-10");
    expect(zonedDay(instant, "America/Los_Angeles")).toBe("2026-11-09");
  });

  it("knows valid time zones", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
