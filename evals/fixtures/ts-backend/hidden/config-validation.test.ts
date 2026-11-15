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
const randomPort = () => String(20000 + Math.floor(Math.random() * 20000));

/** A configuration that is valid apart from `overrides`; a variable set to `undefined` is left unset. */
function envWith(overrides: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string | undefined> = { DATABASE_URL: database(), PORT: randomPort(), WEBHOOK_SECRET: "s", TOKEN_TTL_HOURS: "12", LOG_LEVEL: "warn", ...overrides };
  return Object.fromEntries(Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

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

  // One bad variable at a time, everything else valid: each rule the prompt states must on its
  // own stop the server, and the error must name that variable.
  it.each([
    ["LOG_LEVEL", "verbose", "is not one of debug, info, warn, error, silent"],
    ["DATABASE_URL", undefined, "is required and missing"],
    ["WEBHOOK_SECRET", undefined, "is required and missing"],
    ["TOKEN_TTL_HOURS", "1.5", "is not an integer"],
    ["TOKEN_TTL_HOURS", "0", "is not positive"],
    ["TOKEN_TTL_HOURS", "soon", "is not a number"],
  ])("refuses to start when only %s=%s (%s)", { timeout: 20_000 }, async (name, value) => {
    const result = await start(envWith({ [name]: value }), 8_000);
    result.child.kill();
    expect(result.code).not.toBe(0);
    expect(result.code).not.toBeNull();
    expect(result.output).toContain(name);
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

  it("starts when only the required variables are set (defaults apply)", { timeout: 20_000 }, async () => {
    const port = Number(randomPort());
    const running = start({ DATABASE_URL: database(), PORT: String(port), WEBHOOK_SECRET: "s" }, 4_000);
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
