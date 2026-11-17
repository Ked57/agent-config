import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./passwords";

describe("passwords", () => {
  it("verifies the right password only", () => {
    const stored = hashPassword("correct horse");
    expect(verifyPassword("correct horse", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
    expect(verifyPassword("correct horse", "garbage")).toBe(false);
  });
});
