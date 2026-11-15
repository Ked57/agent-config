import { describe, expect, it } from "vitest";

import { parseDuration } from "../lib/duration";

describe("hidden: parseDuration", () => {
  it("converts compound durations to milliseconds", () => {
    expect(parseDuration("90s")).toBe(90_000);
    expect(parseDuration("15m")).toBe(900_000);
    expect(parseDuration("1h30m")).toBe(5_400_000);
    expect(parseDuration("2d")).toBe(172_800_000);
  });

  it("throws RangeError on invalid input", () => {
    for (const input of ["", "abc", "10x", "-5m", "h"]) expect(() => parseDuration(input)).toThrow(RangeError);
  });
});
