import { logger } from "../lib/logger";

// Slack notifications were switched off in 2023 (see docs/architecture.md).
// Nothing calls this any more.
export async function postToSlack(channel: string, text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    logger.debug("slack.disabled", { channel });
    return false;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ channel, text }),
  });
  return response.ok;
}
