import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "..");

function start(env: Record<string, string>, waitMs: number) {
  return new Promise<{ code: number | null; output: string; child: ReturnType<typeof spawn> }>((resolve) => {
    const child = spawn("bun", ["run", "src/index.ts"], { cwd: root, env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env } });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    const timer = setTimeout(() => resolve({ code: null, output, child }), waitMs);
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, output, child });
    });
  });
}

const database = () => `file:${join(tmpdir(), `config-${randomUUID()}.db`)}`;

describe("hidden: configuration validated at startup", () => {
  it("refuses to start and names every bad variable", { timeout: 20_000 }, async () => {
    const result = await start({ DATABASE_URL: database(), PORT: "not-a-port", TOKEN_TTL_HOURS: "-3" }, 10_000);
    result.child.kill();
    expect(result.code).not.toBe(0);
    expect(result.code).not.toBeNull();
    expect(result.output).toContain("PORT");
    expect(result.output).toContain("WEBHOOK_SECRET");
    expect(result.output).toContain("TOKEN_TTL_HOURS");
  });

  it("starts with a valid configuration", { timeout: 20_000 }, async () => {
    const port = 20000 + Math.floor(Math.random() * 20000);
    const running = start({ DATABASE_URL: database(), PORT: String(port), WEBHOOK_SECRET: "s", TOKEN_TTL_HOURS: "12", LOG_LEVEL: "warn" }, 4_000);
    let healthy = false;
    for (let attempt = 0; attempt < 30 && !healthy; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      healthy = await fetch(`http://127.0.0.1:${port}/api/health`).then((response) => response.ok, () => false);
    }
    const result = await running;
    result.child.kill();
    expect(healthy).toBe(true);
  });
});
