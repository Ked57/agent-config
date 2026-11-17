import { describe, expect, it } from "vitest";

import { parseDuration } from "../lib/duration";

describe("hidden: parseDuration", { timeout: 30_000 }, () => {
  it("converts compound durations to milliseconds", () => {
    expect(parseDuration("90s")).toBe(90_000);
    expect(parseDuration("15m")).toBe(900_000);
    expect(parseDuration("1h30m")).toBe(5_400_000);
    expect(parseDuration("2d")).toBe(172_800_000);
    expect(parseDuration("1d2h3m4s")).toBe(93_784_000);
  });

  it("throws RangeError on invalid input", () => {
    for (const input of ["", "abc", "10x", "-5m", "h"]) expect(() => parseDuration(input)).toThrow(RangeError);
  });

  // The prompt: "throws a RangeError for anything else". Each of these is neither empty nor a
  // sequence of <digits><unit> pairs, so a parser that only looks for the pairs it recognises
  // (and ignores the rest of the string) must not get away with it.
  it.each(["5", "5m10", "1h30", "abc5m", "5m!", "1h-30m", "1e3s", "0x10s", "5 minutes"])("throws RangeError on %j", (input) => {
    expect(() => parseDuration(input)).toThrow(RangeError);
  });
});
