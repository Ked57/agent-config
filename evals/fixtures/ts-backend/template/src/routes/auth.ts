import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { apiTokens, users } from "../db/schema";
import { newId } from "../lib/ids";
import { verifyPassword } from "../lib/passwords";
import { generateToken, hashToken } from "../lib/tokens";
import { authGuard } from "../plugins/auth";

export const authRoutes = (db: Db) =>
  new Elysia({ prefix: "/api" })
    .use(authGuard(db))
    .post(
      "/auth/token",
      async ({ body, status }) => {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, body.email.toLowerCase()))
          .get();
        if (!user || !verifyPassword(body.password, user.passwordHash)) {
          return status(401, { error: "invalid email or password" });
        }
        const ttlHours = Number(process.env.TOKEN_TTL_HOURS ?? 24);
        const token = generateToken();
        const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
        await db.insert(apiTokens).values({
          id: newId("tok"),
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt,
        });
        return { token, expiresAt: expiresAt.toISOString() };
      },
      {
        body: t.Object({
          email: t.String({ format: "email" }),
          password: t.String({ minLength: 1 }),
        }),
      },
    )
    .get(
      "/me",
      async ({ user }) => {
        const row = await db
          .select()
          .from(users)
          .where(eq(users.id, user.id))
          .get();
        return {
          id: user.id,
          orgId: user.orgId,
          role: user.role,
          email: row?.email,
          name: row?.name,
        };
      },
      { requireAuth: true },
    );
