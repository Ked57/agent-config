import { describe, expect, it } from "vitest";

import {
  amountForMinutes,
  formatHours,
  formatMoney,
  fromCents,
  toCents,
} from "./money";

describe("legacy money", () => {
  it("converts between decimals and cents", () => {
    expect(toCents(12.5)).toBe(1250);
    expect(toCents(200)).toBe(20000);
    expect(fromCents(1250)).toBe(12.5);
  });

  it("prices minutes at an hourly rate", () => {
    expect(amountForMinutes(90, 10000)).toBe(15000);
    expect(amountForMinutes(45, 7500)).toBe(5625);
    expect(amountForMinutes(1, 100)).toBe(2);
  });

  it("formats hours and money", () => {
    expect(formatHours(90)).toBe("1.50");
    expect(formatHours(0)).toBe("0.00");
    expect(formatMoney(123450, "EUR")).toBe("€1234.50");
    expect(formatMoney(5, "CHF")).toBe("CHF 0.05");
  });
});
