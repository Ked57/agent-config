import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Logger } from "drizzle-orm/logger";

import { createApp } from "../app";
import { createDb } from "../db/client";
import { runMigrations } from "../db/migrate";
import { SEED_TOKENS, seed } from "../db/seed";

export { SEED_TOKENS };

interface RequestOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * A fresh, migrated and seeded database (a temp file, so transactions work) plus the app.
 * Pass a Drizzle `logger` to observe the queries a request runs.
 */
export async function createTestContext(options: { logger?: Logger } = {}) {
  const db = createDb(
    `file:${join(tmpdir(), `tasks-api-test-${randomUUID()}.db`)}`,
    options,
  );
  await runMigrations(db);
  await seed(db);
  const app = createApp({ db });
  const request = (
    method: string,
    path: string,
    { token, body, headers = {} }: RequestOptions = {},
  ) =>
    app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  /** Request and parse the JSON body. */
  const json = async <T = Record<string, unknown>>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ) => {
    const response = await request(method, path, options);
    return { status: response.status, body: (await response.json()) as T };
  };
  return { db, app, request, json };
}
