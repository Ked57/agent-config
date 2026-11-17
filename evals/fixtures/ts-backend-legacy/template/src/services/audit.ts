import { and, desc, eq } from "drizzle-orm";

import type { Db } from "../db/client";
import { auditLog } from "../db/schema";
import { newId } from "../lib/ids";

export interface AuditEvent {
  orgId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  data?: Record<string, unknown>;
}

export async function recordAudit(db: Db, event: AuditEvent): Promise<void> {
  await db.insert(auditLog).values({
    id: newId("aud"),
    orgId: event.orgId,
    actorId: event.actorId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    data: JSON.stringify(event.data ?? {}),
  });
}

export async function listAudit(
  db: Db,
  orgId: string,
  { entityType, limit = 50 }: { entityType?: string; limit?: number } = {},
) {
  const rows = await db
    .select()
    .from(auditLog)
    .where(
      entityType
        ? and(eq(auditLog.orgId, orgId), eq(auditLog.entityType, entityType))
        : eq(auditLog.orgId, orgId),
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    actorId: row.actorId,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    data: JSON.parse(row.data) as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  }));
}
