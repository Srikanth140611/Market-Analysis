import { config } from "../config.js";
import { getGlobalMarketNews, NewsItem } from "./newsService.js";
import { getSlackWebhookUrls, sendSlackNotification, type SlackBlock } from "./slackService.js";

const seenNewsIds = new Set<string>();
let seeded = false;

export type NewsNotifierStatus = {
  enabled: boolean;
  running: boolean;
  targets: number;
  intervalMs: number | null;
  seeded: boolean;
  seenNewsCount: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastSource: "live" | "fallback" | null;
  lastReason: string | null;
  lastSentCount: number;
  totalSentCount: number;
  lastError: string | null;
};

const notifierStatus: NewsNotifierStatus = {
  enabled: config.AUTO_NEWS_TO_SLACK_ENABLED,
  running: false,
  targets: 0,
  intervalMs: null,
  seeded: false,
  seenNewsCount: 0,
  lastRunAt: null,
  lastSuccessAt: null,
  lastSource: null,
  lastReason: null,
  lastSentCount: 0,
  totalSentCount: 0,
  lastError: null
};

function focusHint(asset: "forex" | "commodities" | "oil" | "shares", direction: "Up" | "Down" | "Neutral") {
  if (asset === "forex") {
    return direction === "Up"
      ? "Focus on long bias pairs listed in Up"
      : direction === "Down"
        ? "Focus on defensive/short bias pairs listed in Down"
        : "Focus on range strategy until breakout";
  }

  if (asset === "commodities") {
    return direction === "Up"
      ? "Focus on bullish commodity momentum"
      : direction === "Down"
        ? "Focus on downside risk in metals/baskets"
        : "Focus on mixed signals and confirmation";
  }

  if (asset === "oil") {
    return direction === "Up"
      ? "Focus on supply-tightening upside"
      : direction === "Down"
        ? "Focus on demand/cycle weakness"
        : "Focus on inventory and headline catalysts";
  }

  return direction === "Up"
    ? "Focus on risk-on sectors"
    : direction === "Down"
      ? "Focus on protection and lower-beta names"
      : "Focus on stock selection over index direction";
}

function buildBlocks(news: NewsItem): SlackBlock[] {
  const forex = news.impacts.find((item) => item.asset === "forex");
  const commodities = news.impacts.find((item) => item.asset === "commodities");
  const oil = news.impacts.find((item) => item.asset === "oil");
  const shares = news.impacts.find((item) => item.asset === "shares");

  const forexDirection = forex?.direction ?? "Neutral";
  const commoditiesDirection = commodities?.direction ?? "Neutral";
  const oilDirection = oil?.direction ?? "Neutral";
  const sharesDirection = shares?.direction ?? "Neutral";

  const lines = [
    `*${news.title}*`,
    `${news.source} | ${new Date(news.publishedAt).toLocaleString()}`,
    "",
    news.summary,
    "",
    `Forex: ${forex?.direction ?? "Neutral"}${
      forex?.pairsUp && forex.pairsUp.length > 0 ? ` | Up ${forex.pairsUp.join(", ")}` : ""
    }${forex?.pairsDown && forex.pairsDown.length > 0 ? ` | Down ${forex.pairsDown.join(", ")}` : ""}`,
    `Commodities: ${commodities?.direction ?? "Neutral"}${
      commodities?.symbolsUp && commodities.symbolsUp.length > 0 ? ` | Up ${commodities.symbolsUp.join(", ")}` : ""
    }${
      commodities?.symbolsDown && commodities.symbolsDown.length > 0
        ? ` | Down ${commodities.symbolsDown.join(", ")}`
        : ""
    }`,
    `Oil: ${oil?.direction ?? "Neutral"}${
      oil?.symbolsUp && oil.symbolsUp.length > 0 ? ` | Up ${oil.symbolsUp.join(", ")}` : ""
    }${oil?.symbolsDown && oil.symbolsDown.length > 0 ? ` | Down ${oil.symbolsDown.join(", ")}` : ""}`,
    `Shares: ${shares?.direction ?? "Neutral"}`,
    "",
    "*Focus direction*",
    `FOREX: ${forexDirection} - ${focusHint("forex", forexDirection)}`,
    `COMMODITIES: ${commoditiesDirection} - ${focusHint("commodities", commoditiesDirection)}`,
    `OIL: ${oilDirection} - ${focusHint("oil", oilDirection)}`,
    `SHARES: ${sharesDirection} - ${focusHint("shares", sharesDirection)}`,
    "",
    `<${news.url}|Read full update>`
  ];

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: lines.join("\n")
      }
    }
  ];
}

async function pollAndNotify() {
  const feed = await getGlobalMarketNews();
  notifierStatus.lastSource = feed.source;
  notifierStatus.lastReason = feed.reason ?? null;

  // Seed with current headlines on first run to avoid immediate spam.
  if (!seeded) {
    feed.data.forEach((item) => {
      seenNewsIds.add(item.id);
    });
    seeded = true;
    notifierStatus.seeded = true;
    notifierStatus.seenNewsCount = seenNewsIds.size;
    notifierStatus.lastSentCount = 0;
    console.log(`News notifier primed with ${feed.data.length} item(s). Source=${feed.source}`);
    return 0;
  }

  const fresh = feed.data.filter((item) => !seenNewsIds.has(item.id));
  if (fresh.length === 0) {
    notifierStatus.lastSentCount = 0;
    notifierStatus.seenNewsCount = seenNewsIds.size;
    return 0;
  }

  for (const item of fresh) {
    seenNewsIds.add(item.id);
  }
  notifierStatus.seenNewsCount = seenNewsIds.size;

  // Send older items first if multiple arrive at once.
  const ordered = [...fresh].reverse();
  let sentCount = 0;
  for (const item of ordered) {
    const message = `New market update (${feed.source.toUpperCase()} source): ${item.title}`;
    const blocks = buildBlocks(item);
    await sendSlackNotification(message, blocks);
    console.log(`Slack broadcast sent for news item: ${item.id}`);
    sentCount += 1;
  }

  notifierStatus.lastSentCount = sentCount;
  notifierStatus.totalSentCount += sentCount;
  return sentCount;
}

export function getNewsNotifierStatus(): NewsNotifierStatus {
  return {
    ...notifierStatus,
    seeded,
    seenNewsCount: seenNewsIds.size
  };
}

export function startNewsToSlackNotifier() {
  if (!config.AUTO_NEWS_TO_SLACK_ENABLED) {
    notifierStatus.enabled = false;
    notifierStatus.running = false;
    notifierStatus.lastError = "Disabled by AUTO_NEWS_TO_SLACK_ENABLED=false";
    console.log("News-to-Slack notifier disabled by AUTO_NEWS_TO_SLACK_ENABLED=false.");
    return;
  }

  const targets = getSlackWebhookUrls();
  notifierStatus.enabled = true;
  notifierStatus.targets = targets.length;
  if (targets.length === 0) {
    notifierStatus.running = false;
    notifierStatus.lastError = "No Slack webhook targets configured";
    console.log("News-to-Slack notifier is idle: no Slack webhook targets configured.");
    return;
  }

  const intervalMs = Math.max(15_000, config.NEWS_POLL_INTERVAL_MS);
  notifierStatus.intervalMs = intervalMs;
  notifierStatus.running = true;
  notifierStatus.lastError = null;
  console.log(`News-to-Slack notifier started with ${targets.length} target(s), poll=${intervalMs}ms.`);

  const run = async () => {
    notifierStatus.lastRunAt = new Date().toISOString();
    try {
      await pollAndNotify();
      notifierStatus.lastSuccessAt = new Date().toISOString();
      notifierStatus.lastError = null;
    } catch (error) {
      notifierStatus.lastError = error instanceof Error ? error.message : "Unknown notifier error";
      console.error("News-to-Slack notifier error:", error);
    }
  };

  void run();
  setInterval(() => {
    void run();
  }, intervalMs);
}
