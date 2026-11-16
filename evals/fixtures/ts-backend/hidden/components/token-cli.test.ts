import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { desc } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createApp } from "../app";
import { createDb } from "../db/client";
import { runMigrations } from "../db/migrate";
import { apiTokens } from "../db/schema";
import { seed } from "../db/seed";

// K5: `bun run token:create <email> [--ttl-hours <n>]` against DATABASE_URL. Prints only the token
// and a newline on stdout; --ttl-hours defaults to TOKEN_TTL_HOURS or 24; email ignores case;
// unknown/missing email or a bad --ttl-hours: message on stderr, nothing on stdout, exit 1.
// Runs the real command the way a user would, with the test-only LOG_LEVEL=silent removed.
async function database() {
  const url = `file:${join(tmpdir(), `token-cli-${randomUUID()}.db`)}`;
  const db = createDb(url);
  await runMigrations(db);
  await seed(db);
  return { url, db };
}

function cli(url: string, args: string[], env: Record<string, string> = {}) {
  const { LOG_LEVEL: _level, TOKEN_TTL_HOURS: _ttl, ...inherited } = process.env;
  const result = spawnSync("bun", ["run", "token:create", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 30_000,
    env: { ...inherited, DATABASE_URL: url, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

async function latestExpiry(db: Awaited<ReturnType<typeof database>>["db"]) {
  const row = await db.select().from(apiTokens).orderBy(desc(apiTokens.createdAt)).get();
  return row ? row.expiresAt.getTime() : null;
}

const HOUR = 60 * 60 * 1000;

describe("hidden: token:create CLI", () => {
  it("prints only a working token", async () => {
    const { url, db } = await database();
    const result = cli(url, ["ada@acme.test"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^\S+\n$/);
    const token = result.stdout.trim();
    const me = await createApp({ db }).handle(
      new Request("http://localhost/api/me", { headers: { authorization: `Bearer ${token}` } }),
    );
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ id: "usr_ada" });
  });

  it("matches the email ignoring case", async () => {
    const { url } = await database();
    const result = cli(url, ["BOB@Acme.Test"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^\S+\n$/);
  });

  it("uses --ttl-hours, then TOKEN_TTL_HOURS, then 24 hours", async () => {
    const { url, db } = await database();
    const cases: Array<[string[], Record<string, string>, number]> = [
      [["ada@acme.test", "--ttl-hours", "2"], { TOKEN_TTL_HOURS: "48" }, 2],
      [["ada@acme.test"], { TOKEN_TTL_HOURS: "5" }, 5],
      [["ada@acme.test"], {}, 24],
    ];
    for (const [args, env, hours] of cases) {
      const before = Date.now();
      expect(cli(url, args, env).status).toBe(0);
      const expiry = await latestExpiry(db);
      expect(expiry).not.toBeNull();
      expect(Math.abs((expiry ?? 0) - before - hours * HOUR)).toBeLessThan(5 * 60 * 1000);
    }
  });

  it.each([
    ["an unknown email", ["nobody@acme.test"]],
    ["a missing email", []],
    ["a non-numeric ttl", ["ada@acme.test", "--ttl-hours", "soon"]],
    ["a zero ttl", ["ada@acme.test", "--ttl-hours", "0"]],
    ["a negative ttl", ["ada@acme.test", "--ttl-hours", "-3"]],
  ])("fails with %s: stderr message, empty stdout, exit 1, no token", async (_name, args) => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.["token:create"]).toEqual(expect.any(String));
    const { url, db } = await database();
    const tokensBefore = (await db.select().from(apiTokens)).length;
    const result = cli(url, args);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).not.toBe("");
    expect((await db.select().from(apiTokens)).length).toBe(tokensBefore);
  });
});
