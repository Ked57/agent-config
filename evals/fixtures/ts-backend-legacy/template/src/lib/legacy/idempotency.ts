import { and, eq } from "drizzle-orm";

import type { Db } from "../../db/client";
import { idempotencyKeys } from "../../db/schema";

export interface StoredResponse {
  statusCode: number;
  body: unknown;
}

/** A previously stored response for this key, if any. */
export async function findStoredResponse(
  db: Db,
  orgId: string,
  scope: string,
  key: string,
): Promise<StoredResponse | undefined> {
  const row = await db
    .select()
    .from(idempotencyKeys)
    .where(
      and(
        eq(idempotencyKeys.orgId, orgId),
        eq(idempotencyKeys.scope, scope),
        eq(idempotencyKeys.key, key),
      ),
    )
    .get();
  return row
    ? { statusCode: row.statusCode, body: JSON.parse(row.response) }
    : undefined;
}

export async function storeResponse(
  db: Db,
  orgId: string,
  scope: string,
  key: string,
  response: StoredResponse,
): Promise<void> {
  await db
    .insert(idempotencyKeys)
    .values({
      orgId,
      scope,
      key,
      statusCode: response.statusCode,
      response: JSON.stringify(response.body),
    })
    .onConflictDoNothing();
}
