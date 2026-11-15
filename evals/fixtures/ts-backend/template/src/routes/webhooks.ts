import { eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { organizations } from "../db/schema";
import { logger } from "../lib/logger";

/** Billing provider webhooks, authenticated with a shared secret header. */
export const webhookRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/webhooks" }).post(
    "/billing",
    async ({ body, headers, status }) => {
      const secret = process.env.WEBHOOK_SECRET;
      if (!secret || headers["x-webhook-secret"] !== secret) {
        return status(401, "invalid webhook secret");
      }
      if (body.type === "payment.succeeded") {
        const credits = body.data.credits ?? 0;
        await db
          .update(organizations)
          .set({ credits: sql`${organizations.credits} + ${credits}` })
          .where(eq(organizations.id, body.data.orgId));
        logger.info("billing.credits_added", {
          eventId: body.id,
          orgId: body.data.orgId,
          credits,
        });
      }
      return { received: true };
    },
    {
      body: t.Object({
        id: t.String({ minLength: 1 }),
        type: t.String(),
        data: t.Object({
          orgId: t.String(),
          credits: t.Optional(t.Integer({ minimum: 0 })),
        }),
      }),
    },
  );
