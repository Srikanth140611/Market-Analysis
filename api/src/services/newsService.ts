import { createHash } from "node:crypto";
import { config } from "../config.js";
import { getMarketTrends } from "./marketService.js";

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
  url: string;
  sentiment?: "positive" | "negative" | "neutral";
  impacts: NewsImpact[];
};

export type NewsImpact = {
  asset: "forex" | "crypto" | "commodities" | "oil" | "shares";
  direction: "Up" | "Down" | "Neutral";
  confidence: number;
  note: string;
  pairsUp?: string[];
  pairsDown?: string[];
  symbolsUp?: string[];
  symbolsDown?: string[];
};

export type NewsFeedResponse = {
  data: NewsItem[];
  source: "live" | "fallback";
  provider: "marketaux" | "finnhub" | "rss" | "fallback";
  reason?: string;
};

const RSS_FEEDS = [
  "https://feeds.marketwatch.com/marketwatch/topstories/",
  "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  "https://finance.yahoo.com/news/rssindex"
];

function decodeXmlEntities(value: string) {
  const basicDecoded = value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

  return basicDecoded
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function extractTagValue(itemXml: string, tagName: string): string {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = itemXml.match(pattern);
  return match?.[1]?.trim() ?? "";
}

async function fetchRssNews(assetSnapshot: AssetSnapshot): Promise<NewsItem[] | null> {
  const collected: NewsItem[] = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const response = await fetch(feedUrl);
      if (!response.ok) {
        continue;
      }

      const xml = await response.text();
      const channelTitle = extractTagValue(xml, "title") || "RSS Source";
      const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

      for (const item of itemMatches.slice(0, 12)) {
        const titleRaw = extractTagValue(item, "title");
        const linkRaw = extractTagValue(item, "link");
        const pubDateRaw = extractTagValue(item, "pubDate");
        const descriptionRaw = extractTagValue(item, "description");

        const title = stripHtml(decodeXmlEntities(titleRaw));
        const summary = stripHtml(decodeXmlEntities(descriptionRaw));
        const url = decodeXmlEntities(linkRaw);
        const parsedDate = new Date(pubDateRaw);
        const publishedAt = Number.isNaN(parsedDate.getTime())
          ? new Date().toISOString()
          : parsedDate.toISOString();

        if (!title || !url) {
          continue;
        }

        const idSeed = `${url}|${publishedAt}|${title}`;
        const id = `rss-${createHash("sha1").update(idSeed).digest("hex").slice(0, 20)}`;
        collected.push({
          id,
          title,
          source: channelTitle,
          publishedAt,
          summary: summary || "Latest market development from live RSS feed.",
          url,
          impacts: buildImpacts(title, summary || title, assetSnapshot)
        });
      }
    } catch {
      continue;
    }
  }

  if (collected.length === 0) {
    return null;
  }

  const deduped = Array.from(new Map(collected.map((item) => [item.url, item])).values())
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 10);

  return deduped.length > 0 ? deduped : null;
}

function scoreDirection(
  text: string,
  bullishTerms: string[],
  bearishTerms: string[]
): { direction: "Up" | "Down" | "Neutral"; confidence: number } {
  const bullishHits = bullishTerms.filter((term) => text.includes(term)).length;
  const bearishHits = bearishTerms.filter((term) => text.includes(term)).length;
  const delta = bullishHits - bearishHits;

  if (delta > 0) {
    return {
      direction: "Up",
      confidence: Math.min(92, 60 + delta * 10)
    };
  }

  if (delta < 0) {
    return {
      direction: "Down",
      confidence: Math.min(92, 60 + Math.abs(delta) * 10)
    };
  }

  return {
    direction: "Neutral",
    confidence: 52
  };
}

type AssetSnapshot = {
  pairsUp: string[];
  pairsDown: string[];
  commoditiesUp: string[];
  commoditiesDown: string[];
  oilUp: string[];
  oilDown: string[];
};

async function getAssetSnapshot(): Promise<AssetSnapshot> {
  try {
    const trends = await getMarketTrends();
    const forex = trends.data.filter((item) => item.category === "forex");
    const commodities = trends.data.filter((item) => item.category === "commodity");
    const oil = trends.data.filter((item) => item.category === "oil");

    return {
      pairsUp: forex.filter((item) => item.direction === "up").map((item) => item.symbol),
      pairsDown: forex.filter((item) => item.direction === "down").map((item) => item.symbol),
      commoditiesUp: commodities.filter((item) => item.direction === "up").map((item) => item.symbol),
      commoditiesDown: commodities.filter((item) => item.direction === "down").map((item) => item.symbol),
      oilUp: oil.filter((item) => item.direction === "up").map((item) => item.symbol),
      oilDown: oil.filter((item) => item.direction === "down").map((item) => item.symbol)
    };
  } catch {
    return {
      pairsUp: [],
      pairsDown: [],
      commoditiesUp: [],
      commoditiesDown: [],
      oilUp: [],
      oilDown: []
    };
  }
}

function buildImpacts(title: string, summary: string, snapshot: AssetSnapshot): NewsImpact[] {
  const text = `${title} ${summary}`.toLowerCase();

  const forexDirectionalFromNews = scoreDirection(
    text,
    ["rate cut", "dovish", "cooling inflation", "risk-on", "weaker dollar"],
    ["rate hike", "hawkish", "inflation rises", "risk-off", "stronger dollar"]
  );

  const forexFromPairs =
    snapshot.pairsUp.length > snapshot.pairsDown.length
      ? "Up"
      : snapshot.pairsUp.length < snapshot.pairsDown.length
        ? "Down"
        : "Neutral";

  const forexDirection =
    snapshot.pairsUp.length + snapshot.pairsDown.length > 0
      ? forexFromPairs
      : forexDirectionalFromNews.direction;

  const forexConfidence =
    snapshot.pairsUp.length + snapshot.pairsDown.length > 0
      ? Math.min(
          92,
          58 +
            Math.abs(snapshot.pairsUp.length - snapshot.pairsDown.length) * 6 +
            Math.min(12, snapshot.pairsUp.length + snapshot.pairsDown.length)
        )
      : forexDirectionalFromNews.confidence;

  const crypto = scoreDirection(
    text,
    ["risk-on", "liquidity", "etf inflow", "adoption", "rate cut"],
    ["crackdown", "risk-off", "security breach", "rate hike", "tightening"]
  );

  const commodities = scoreDirection(
    text,
    ["demand rises", "supply disruption", "industrial rebound", "inflation hedge"],
    ["demand weakens", "supply glut", "growth slowdown", "inventory build"]
  );

  const oil = scoreDirection(
    text,
    ["supply cut", "output cut", "geopolitical tension", "demand rises"],
    ["output increase", "inventory build", "demand weakens", "recession fears"]
  );

  const shares = scoreDirection(
    text,
    ["equities gain", "earnings beat", "cooling inflation", "rate cut", "risk-on"],
    ["equities fall", "earnings miss", "inflation rises", "rate hike", "risk-off"]
  );

  const commoditiesFromSymbols =
    snapshot.commoditiesUp.length > snapshot.commoditiesDown.length
      ? "Up"
      : snapshot.commoditiesUp.length < snapshot.commoditiesDown.length
        ? "Down"
        : "Neutral";

  const commoditiesDirection =
    snapshot.commoditiesUp.length + snapshot.commoditiesDown.length > 0
      ? commoditiesFromSymbols
      : commodities.direction;

  const commoditiesConfidence =
    snapshot.commoditiesUp.length + snapshot.commoditiesDown.length > 0
      ? Math.min(
          90,
          56 +
            Math.abs(snapshot.commoditiesUp.length - snapshot.commoditiesDown.length) * 8 +
            Math.min(10, snapshot.commoditiesUp.length + snapshot.commoditiesDown.length)
        )
      : commodities.confidence;

  const oilFromSymbols =
    snapshot.oilUp.length > snapshot.oilDown.length
      ? "Up"
      : snapshot.oilUp.length < snapshot.oilDown.length
        ? "Down"
        : "Neutral";

  const oilDirection = snapshot.oilUp.length + snapshot.oilDown.length > 0 ? oilFromSymbols : oil.direction;
  const oilConfidence =
    snapshot.oilUp.length + snapshot.oilDown.length > 0
      ? Math.min(
          90,
          58 + Math.abs(snapshot.oilUp.length - snapshot.oilDown.length) * 10 + Math.min(8, snapshot.oilUp.length + snapshot.oilDown.length)
        )
      : oil.confidence;

  return [
    {
      asset: "forex",
      direction: forexDirection,
      confidence: forexConfidence,
      note: "FX sensitivity to policy and risk sentiment",
      pairsUp: snapshot.pairsUp,
      pairsDown: snapshot.pairsDown,
      symbolsUp: snapshot.pairsUp,
      symbolsDown: snapshot.pairsDown
    },
    {
      asset: "crypto",
      direction: crypto.direction,
      confidence: crypto.confidence,
      note: "Liquidity and risk appetite signal"
    },
    {
      asset: "commodities",
      direction: commoditiesDirection,
      confidence: commoditiesConfidence,
      note: "Macro demand and supply balance signal",
      symbolsUp: snapshot.commoditiesUp,
      symbolsDown: snapshot.commoditiesDown
    },
    {
      asset: "oil",
      direction: oilDirection,
      confidence: oilConfidence,
      note: "Energy supply-demand signal",
      symbolsUp: snapshot.oilUp,
      symbolsDown: snapshot.oilDown
    },
    {
      asset: "shares",
      direction: shares.direction,
      confidence: shares.confidence,
      note: "Equity risk and earnings sensitivity"
    }
  ];
}

const fallbackTemplates = [
  {
    id: "n1",
    title: "Global equities hold gains as inflation cools in major economies",
    source: "Market Pulse",
    summary: "Cooling inflation data has supported risk assets while central banks keep a cautious tone.",
    url: "https://example.com/news/global-equities"
  },
  {
    id: "n2",
    title: "Crude oil volatility rises after supply guidance revisions",
    source: "Energy Monitor",
    summary: "Producers adjusted forward guidance, increasing uncertainty in short-term oil pricing.",
    url: "https://example.com/news/oil-volatility"
  },
  {
    id: "n3",
    title: "USD mixed as traders reprice interest rate expectations",
    source: "FX Wire",
    summary: "Currency markets remain sensitive to forward-looking policy commentary from major central banks.",
    url: "https://example.com/news/usd-rates"
  }
] as const;

function buildFallbackNews(): NewsItem[] {
  const staticFallbackSnapshot: AssetSnapshot = {
    pairsUp: ["EUR/USD", "USD/JPY", "AUD/USD"],
    pairsDown: ["GBP/USD", "USD/CHF", "USD/CAD"],
    commoditiesUp: ["XAU/USD"],
    commoditiesDown: ["XAG/USD"],
    oilUp: ["BRENT"],
    oilDown: ["WTI"]
  };

  const now = Date.now();
  return fallbackTemplates.map((item, index) => ({
    ...item,
    publishedAt: new Date(now - index * 60_000).toISOString(),
    impacts: buildImpacts(item.title, item.summary, staticFallbackSnapshot)
  }));
}

async function fetchMarketauxNews(assetSnapshot: AssetSnapshot): Promise<NewsItem[] | null> {
  if (!config.MARKETAUX_API_KEY) {
    return null;
  }

  const url = new URL("https://api.marketaux.com/v1/news/all");
  url.searchParams.set("api_token", config.MARKETAUX_API_KEY);
  url.searchParams.set("language", "en");
  url.searchParams.set("limit", "10");
  url.searchParams.set("countries", "us,gb,eu,jp,cn,au");
  url.searchParams.set("filter_entities", "true");

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    data?: Array<{
      uuid: string;
      title: string;
      source: string;
      published_at: string;
      description: string;
      url: string;
      sentiment?: "positive" | "negative" | "neutral";
    }>;
  };

  const mapped = (payload.data ?? []).map((item) => ({
    id: item.uuid,
    title: item.title,
    source: item.source,
    publishedAt: item.published_at,
    summary: item.description,
    url: item.url,
    sentiment: item.sentiment,
    impacts: buildImpacts(item.title, item.description, assetSnapshot)
  }));

  return mapped.length > 0 ? mapped : null;
}

async function fetchFinnhubNews(assetSnapshot: AssetSnapshot): Promise<NewsItem[] | null> {
  if (!config.FINNHUB_API_KEY) {
    return null;
  }

  const url = new URL("https://finnhub.io/api/v1/news");
  url.searchParams.set("category", "general");
  url.searchParams.set("token", config.FINNHUB_API_KEY);

  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Array<{
    id: number;
    headline: string;
    source: string;
    datetime: number;
    summary: string;
    url: string;
  }>;

  const mapped = (payload ?? [])
    .slice(0, 10)
    .map((item) => ({
      id: `fh-${item.id}`,
      title: item.headline,
      source: item.source,
      publishedAt: new Date(item.datetime * 1000).toISOString(),
      summary: item.summary,
      url: item.url,
      impacts: buildImpacts(item.headline, item.summary, assetSnapshot)
    }));

  return mapped.length > 0 ? mapped : null;
}

export async function getGlobalMarketNews(): Promise<NewsFeedResponse> {
  const assetSnapshot = await getAssetSnapshot();
  const reasons: string[] = [];

  try {
    const marketaux = await fetchMarketauxNews(assetSnapshot);
    if (marketaux) {
      return {
        data: marketaux,
        source: "live",
        provider: "marketaux"
      };
    }
    reasons.push("Marketaux unavailable or empty");
  } catch {
    reasons.push("Marketaux request failed");
  }

  try {
    const finnhub = await fetchFinnhubNews(assetSnapshot);
    if (finnhub) {
      return {
        data: finnhub,
        source: "live",
        provider: "finnhub",
        reason: reasons.length > 0 ? reasons.join("; ") : undefined
      };
    }
    reasons.push("Finnhub news unavailable or empty");
  } catch {
    reasons.push("Finnhub news request failed");
  }

  try {
    const rss = await fetchRssNews(assetSnapshot);
    if (rss) {
      return {
        data: rss,
        source: "live",
        provider: "rss",
        reason: reasons.length > 0 ? reasons.join("; ") : undefined
      };
    }
    reasons.push("RSS feeds unavailable or empty");
  } catch {
    reasons.push("RSS news request failed");
  }

  const noKeys = !config.MARKETAUX_API_KEY && !config.FINNHUB_API_KEY;
  if (noKeys) {
    reasons.push("MARKETAUX_API_KEY and FINNHUB_API_KEY are not configured");
  }

  return {
    data: buildFallbackNews(),
    source: "fallback",
    provider: "fallback",
    reason: reasons.join("; ")
  };
}
