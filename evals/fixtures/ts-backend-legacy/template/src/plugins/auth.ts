import { eq } from "drizzle-orm";
import { Elysia } from "elysia";

import type { Db } from "../db/client";
import { apiTokens, users } from "../db/schema";
import { hashToken } from "../lib/tokens";

export interface AuthUser {
  id: string;
  orgId: string;
  role: "admin" | "member";
}

/** Bearer-token guard. Routes opt in with `{ requireAuth: true }` and receive `user`. */
export const authGuard = (db: Db) =>
  new Elysia().macro({
    requireAuth: {
      async resolve({ headers, status }) {
        const header = headers.authorization;
        if (!header?.startsWith("Bearer ")) {
          return status(401, {
            code: "unauthenticated",
            message: "missing bearer token",
          });
        }
        const row = await db
          .select({
            id: users.id,
            orgId: users.orgId,
            role: users.role,
            expiresAt: apiTokens.expiresAt,
          })
          .from(apiTokens)
          .innerJoin(users, eq(users.id, apiTokens.userId))
          .where(
            eq(apiTokens.tokenHash, hashToken(header.slice("Bearer ".length))),
          )
          .get();
        if (!row || row.expiresAt.getTime() < Date.now()) {
          return status(401, "Unauthorized");
        }
        const user: AuthUser = { id: row.id, orgId: row.orgId, role: row.role };
        return { user };
      },
    },
  });

export const isAdmin = (user: AuthUser) => user.role === "admin";
