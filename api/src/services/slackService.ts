import { config } from "../config.js";

export type SlackBlock = {
  type: "section";
  text: {
    type: "mrkdwn";
    text: string;
  };
};

function splitCsv(value?: string) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getSlackWebhookUrls() {
  const configured = splitCsv(config.SLACK_WEBHOOK_URLS);
  const merged = config.SLACK_WEBHOOK_URL ? [config.SLACK_WEBHOOK_URL, ...configured] : configured;

  return Array.from(new Set(merged));
}

export function getSlackMentionsText() {
  const userIds = splitCsv(config.SLACK_NOTIFY_USER_IDS);
  if (userIds.length === 0) {
    return "";
  }

  return userIds.map((id) => `<@${id}>`).join(" ");
}

export async function sendSlackNotification(message: string, blocks: SlackBlock[] = []) {
  const urls = getSlackWebhookUrls();
  if (urls.length === 0) {
    throw new Error("Slack webhook is not configured. Set SLACK_WEBHOOK_URL or SLACK_WEBHOOK_URLS in .env.");
  }

  const mentions = getSlackMentionsText();
  const finalMessage = mentions ? `${mentions}\n${message}` : message;

  const results = await Promise.all(
    urls.map(async (url) => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: finalMessage,
          blocks
        })
      });

      return {
        url,
        ok: response.ok,
        status: response.status
      };
    })
  );

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    const details = failed.map((item) => `${item.status}@${item.url}`).join(", ");
    throw new Error(`Slack webhook failed for ${failed.length}/${results.length} target(s): ${details}`);
  }
}
