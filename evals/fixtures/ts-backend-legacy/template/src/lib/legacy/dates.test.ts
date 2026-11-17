import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  dayKey,
  formatDay,
  isValidDay,
  weekStart,
} from "./dates";

describe("legacy dates", () => {
  it("dayKey gives the calendar day of a timestamp", () => {
    expect(dayKey(Date.parse("2026-11-09T10:00:00Z"))).toBe("2026-11-09");
    expect(dayKey(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12-31");
  });

  it("addDays crosses month and year ends", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("addMonths keeps the day of month", () => {
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-11-10", 2)).toBe("2027-01-10");
    expect(addMonths("2026-03-05", -3)).toBe("2025-12-05");
  });

  it("weekStart is the Monday", () => {
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
    expect(weekStart("2026-11-15")).toBe("2026-11-09");
    expect(weekStart("2026-11-12")).toBe("2026-11-09");
  });

  it("formats days for accountants", () => {
    expect(formatDay("2026-11-09")).toBe("09/11/2026");
    expect(() => formatDay("2026-13-01")).toThrow(RangeError);
  });

  it("validates calendar days", () => {
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(isValidDay("2026-02-29")).toBe(false);
    expect(isValidDay("2026-1-01")).toBe(false);
  });
});
