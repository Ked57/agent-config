import { createHmac } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { Db } from "../db/client";
import { organizations, webhookSubscriptions } from "../db/schema";
import { isEnabled } from "../lib/flags";
import { enqueue, registerJob } from "./jobs";

export const webhookEvents = [
  "invoice.issued",
  "invoice.paid",
  "task.completed",
] as const;
export type WebhookEvent = (typeof webhookEvents)[number];

/** Queues a delivery to every active subscription of the org that wants the event. */
export async function emitEvent(
  db: Db,
  orgId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<number> {
  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .get();
  if (!isEnabled(org, "webhooks")) return 0;
  const subscriptions = await db
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.orgId, orgId),
        eq(webhookSubscriptions.active, true),
      ),
    );
  let queued = 0;
  for (const subscription of subscriptions) {
    const events = JSON.parse(subscription.events) as string[];
    if (!events.includes(event)) continue;
    await enqueue(db, "webhook.deliver", {
      subscriptionId: subscription.id,
      event,
      data,
    });
    queued += 1;
  }
  return queued;
}

registerJob("webhook.deliver", async (db, payload) => {
  const { subscriptionId, event, data } = payload as {
    subscriptionId: string;
    event: string;
    data: unknown;
  };
  const subscription = await db
    .select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.id, subscriptionId))
    .get();
  if (!subscription?.active) return;
  const body = JSON.stringify({ event, data, sentAt: new Date().toISOString() });
  const signature = createHmac("sha256", subscription.secret)
    .update(body)
    .digest("hex");
  const response = await fetch(subscription.url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-signature": signature },
    body,
  });
  if (!response.ok) throw new Error(`delivery failed: ${response.status}`);
});
