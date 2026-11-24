import { setTimeout as sleep } from "node:timers/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/ids");

describe("probe", () => {
  it.only("focused", () => expect(1).toBe(1));
  it("retried", { retry: 3 }, () => expect(1).toBe(1));
  it("slow", () => expect(1).toBe(1), 10_000);
  it("sleeps", async () => { await new Promise((resolve) => setTimeout(resolve, 50)); expect(1).toBe(1); });
  it("sleeps via import", async () => { await sleep(10); expect(1).toBe(1); });
});
