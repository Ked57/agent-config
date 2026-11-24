import { describe, expect, it } from "vitest";
import { newId } from "./ids";
import { fakeIds } from "./ids.mock";

describe("ids", () => {
  it("keeps the prefix and length of real ids in fakes", () => {
    const next = fakeIds("tsk");
    expect(next()).toHaveLength(newId("tsk").length);
    expect(next()).toBe("tsk_0000000000000002");
  });
});
