import { API_BASE_URL, API_BASE_URL_CANDIDATES } from "../constants";
import {
  ForexCandlesResponse,
  ForexTimeframe,
  MarketHistoryResponse,
  MarketHistoryTimeframe,
  MarketAgentsResponse,
  ForexTradeMonitoringHistoryReport,
  ForexTradeMonitoringReport,
  MarketTrendsResponse,
  NewsFeedResponse,
  NotifierStatus,
  Mt4Snapshot,
  Mt4QuoteFeedResponse,
  Mt4SnapshotResponse,
  StockSuggestion
} from "../types";

const RATE_LIMIT_COOLDOWN_MS = 45_000;
const TIMEOUT_COOLDOWN_MS = 10_000;
const SHARED_CACHE_MAX_AGE_MS = 15 * 60_000;
const STALE_SHARED_CACHE_MAX_AGE_MS = 24 * 60 * 60_000;
const TAB_LEADER_STALE_MS = 90_000;
const TAB_LEADER_KEY = "market-analysis:poll-leader";
const SHARED_CACHE_PREFIX = "market-analysis:cache:";
const baseUrlCooldownUntil = new Map<string, number>();
const jsonResponseCache = new Map<string, unknown>();
let apiNotice: string | null = null;

const TAB_ID = (() => {
  if (typeof window === "undefined") {
    return "server";
  }

  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
})();

function cacheKeyFor(path: string, baseUrl: string) {
  return `${baseUrl || "relative"}:${path}`;
}

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function sharedStorageCacheKey(path: string, baseUrl: string) {
  return `${SHARED_CACHE_PREFIX}${cacheKeyFor(path, baseUrl)}`;
}

function readSharedCache<T>(path: string, baseUrl: string, maxAgeMs = SHARED_CACHE_MAX_AGE_MS): T | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(sharedStorageCacheKey(path, baseUrl));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { savedAt?: number; payload?: unknown };
    if (!parsed || typeof parsed.savedAt !== "number") {
      return null;
    }

    if ((Date.now() - parsed.savedAt) > maxAgeMs) {
      return null;
    }

    return (parsed.payload ?? null) as T | null;
  } catch {
    return null;
  }
}

function writeSharedCache<T>(path: string, baseUrl: string, payload: T) {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(sharedStorageCacheKey(path, baseUrl), JSON.stringify({
      savedAt: Date.now(),
      payload
    }));
  } catch {
    // Ignore storage write failures.
  }
}

function shouldCurrentTabFetch() {
  if (!canUseBrowserStorage()) {
    return true;
  }

  const now = Date.now();

  try {
    const current = window.localStorage.getItem(TAB_LEADER_KEY);
    if (current) {
      const leader = JSON.parse(current) as { tabId?: string; timestamp?: number };
      if (leader.tabId === TAB_ID) {
        window.localStorage.setItem(TAB_LEADER_KEY, JSON.stringify({ tabId: TAB_ID, timestamp: now }));
        return true;
      }

      if (typeof leader.timestamp === "number" && (now - leader.timestamp) < TAB_LEADER_STALE_MS) {
        return false;
      }
    }

    window.localStorage.setItem(TAB_LEADER_KEY, JSON.stringify({ tabId: TAB_ID, timestamp: now }));
    const confirm = window.localStorage.getItem(TAB_LEADER_KEY);
    if (!confirm) {
      return true;
    }

    const parsed = JSON.parse(confirm) as { tabId?: string };
    return parsed.tabId === TAB_ID;
  } catch {
    return true;
  }
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out";
  }

  return error instanceof Error ? error.message : "Unable to reach API";
}

function isRateLimitMessage(message: string) {
  return /429|rate limit|rate exceeded/i.test(message);
}

function isTimeoutMessage(message: string) {
  return /timed out|abort/i.test(message);
}

function setApiNotice(message: string | null) {
  apiNotice = message;
}

export function getApiNotice() {
  return apiNotice;
}

function withBase(path: string, baseUrl: string) {
  if (!baseUrl) {
    return path;
  }

  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function isSecureWebContext() {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

function getReachableBaseUrls() {
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return API_BASE_URL_CANDIDATES.filter((baseUrl) => {
      if (!baseUrl) {
        return true;
      }

      return !baseUrl.startsWith("http://localhost") && !baseUrl.startsWith("http://10.0.2.2");
    });
  }

  if (!isSecureWebContext()) {
    return API_BASE_URL_CANDIDATES;
  }

  return API_BASE_URL_CANDIDATES.filter((baseUrl) => !baseUrl.startsWith("http://"));
}

async function fetchWithTimeout(input: string, init?: RequestInit, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithFallback(path: string, init?: RequestInit) {
  let lastError: unknown = null;
  const now = Date.now();

  if (!shouldCurrentTabFetch()) {
    throw new Error("Follower tab using shared cache");
  }

  for (const baseUrl of getReachableBaseUrls()) {
    const cooldownUntil = baseUrlCooldownUntil.get(baseUrl) ?? 0;
    if (cooldownUntil > now) {
      lastError = new Error("Request failed: 429");
      continue;
    }

    try {
      const response = await fetchWithTimeout(withBase(path, baseUrl), init);
      if (response.status === 429) {
        baseUrlCooldownUntil.set(baseUrl, Date.now() + RATE_LIMIT_COOLDOWN_MS);
      }

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      return response;
    } catch (error) {
      const message = normalizeErrorMessage(error);
      if (isTimeoutMessage(message)) {
        baseUrlCooldownUntil.set(baseUrl, Date.now() + TIMEOUT_COOLDOWN_MS);
      }

      lastError = new Error(message);
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Unable to reach API";
  throw new Error(message);
}

const fallbackNews: NewsFeedResponse = {
  source: "fallback",
  provider: "fallback",
  reason: "Using local fallback data because live API is unavailable",
  data: [
    {
      id: "n1",
      title: "Global equities hold gains as inflation cools in major economies",
      source: "Market Pulse",
      publishedAt: new Date(Date.now() - 60_000).toISOString(),
      summary: "Cooling inflation data has supported risk assets while central banks keep a cautious tone.",
      url: "https://example.com/news/global-equities",
      impacts: [
        {
          asset: "forex",
          direction: "Up",
          confidence: 76,
          note: "FX sensitivity to policy and risk sentiment",
          pairsUp: ["EUR/USD", "USD/JPY", "AUD/USD"],
          pairsDown: ["GBP/USD", "USD/CHF", "USD/CAD"],
          symbolsUp: ["EUR/USD", "USD/JPY", "AUD/USD"],
          symbolsDown: ["GBP/USD", "USD/CHF", "USD/CAD"]
        },
        {
          asset: "crypto",
          direction: "Up",
          confidence: 69,
          note: "Liquidity and risk appetite signal"
        },
        {
          asset: "commodities",
          direction: "Up",
          confidence: 67,
          note: "Macro demand and supply balance signal",
          symbolsUp: ["XAU/USD"],
          symbolsDown: ["XAG/USD"]
        },
        {
          asset: "oil",
          direction: "Neutral",
          confidence: 58,
          note: "Energy supply-demand signal",
          symbolsUp: ["BRENT"],
          symbolsDown: ["WTI"]
        },
        {
          asset: "shares",
          direction: "Up",
          confidence: 73,
          note: "Equity risk and earnings sensitivity"
        }
      ]
    },
    {
      id: "n2",
      title: "Crude oil volatility rises after supply guidance revisions",
      source: "Energy Monitor",
      publishedAt: new Date(Date.now() - 120_000).toISOString(),
      summary: "Producers adjusted forward guidance, increasing uncertainty in short-term oil pricing.",
      url: "https://example.com/news/oil-volatility",
      impacts: [
        {
          asset: "forex",
          direction: "Neutral",
          confidence: 58,
          note: "FX sensitivity to policy and risk sentiment",
          pairsUp: ["USD/JPY"],
          pairsDown: ["EUR/USD"],
          symbolsUp: ["USD/JPY"],
          symbolsDown: ["EUR/USD"]
        },
        {
          asset: "crypto",
          direction: "Neutral",
          confidence: 55,
          note: "Liquidity and risk appetite signal"
        },
        {
          asset: "commodities",
          direction: "Down",
          confidence: 63,
          note: "Macro demand and supply balance signal",
          symbolsUp: ["XAU/USD"],
          symbolsDown: ["XAG/USD"]
        },
        {
          asset: "oil",
          direction: "Down",
          confidence: 79,
          note: "Energy supply-demand signal",
          symbolsUp: ["BRENT"],
          symbolsDown: ["WTI"]
        },
        {
          asset: "shares",
          direction: "Down",
          confidence: 61,
          note: "Equity risk and earnings sensitivity"
        }
      ]
    },
    {
      id: "n3",
      title: "USD mixed as traders reprice interest rate expectations",
      source: "FX Wire",
      publishedAt: new Date(Date.now() - 180_000).toISOString(),
      summary: "Currency markets remain sensitive to forward-looking policy commentary from major central banks.",
      url: "https://example.com/news/usd-rates",
      impacts: [
        {
          asset: "forex",
          direction: "Down",
          confidence: 68,
          note: "FX sensitivity to policy and risk sentiment",
          pairsUp: ["GBP/USD", "EUR/GBP"],
          pairsDown: ["USD/JPY", "USD/CHF", "USD/CAD"],
          symbolsUp: ["GBP/USD", "EUR/GBP"],
          symbolsDown: ["USD/JPY", "USD/CHF", "USD/CAD"]
        },
        {
          asset: "crypto",
          direction: "Neutral",
          confidence: 57,
          note: "Liquidity and risk appetite signal"
        },
        {
          asset: "commodities",
          direction: "Neutral",
          confidence: 56,
          note: "Macro demand and supply balance signal",
          symbolsUp: ["XAU/USD"],
          symbolsDown: ["XAG/USD"]
        },
        {
          asset: "oil",
          direction: "Neutral",
          confidence: 54,
          note: "Energy supply-demand signal",
          symbolsUp: ["BRENT"],
          symbolsDown: ["WTI"]
        },
        {
          asset: "shares",
          direction: "Neutral",
          confidence: 55,
          note: "Equity risk and earnings sensitivity"
        }
      ]
    }
  ]
};

const fallbackTrends: MarketTrendsResponse = {
  source: "fallback",
  reason: "Using local fallback data because live API is unavailable",
  data: [
    {
      symbol: "EUR/USD",
      name: "Euro vs US Dollar",
      category: "forex",
      price: 1.09,
      changePercent: 0.47,
      direction: "up",
      momentum: "Up",
      momentumSuggestion: "Up",
      confidence: 74
    },
    {
      symbol: "GBP/USD",
      name: "British Pound vs US Dollar",
      category: "forex",
      price: 1.28,
      changePercent: -0.21,
      direction: "down",
      momentum: "Down",
      momentumSuggestion: "Down",
      confidence: 63
    },
    {
      symbol: "USD/JPY",
      name: "US Dollar vs Japanese Yen",
      category: "forex",
      price: 156.41,
      changePercent: 0.38,
      direction: "up",
      momentum: "Up",
      momentumSuggestion: "Up",
      confidence: 71
    },
    {
      symbol: "XAU/USD",
      name: "Gold Spot",
      category: "commodity",
      price: 2398.12,
      changePercent: 0.65,
      direction: "up",
      momentum: "Up",
      momentumSuggestion: "Up",
      confidence: 78
    },
    {
      symbol: "XAG/USD",
      name: "Silver Spot",
      category: "commodity",
      price: 31.14,
      changePercent: -0.44,
      direction: "down",
      momentum: "Down",
      momentumSuggestion: "Down",
      confidence: 78
    },
    {
      symbol: "WTI",
      name: "Crude Oil WTI",
      category: "oil",
      price: 78.32,
      changePercent: -0.92,
      direction: "down",
      momentum: "Down",
      momentumSuggestion: "Down",
      confidence: 69
    },
    {
      symbol: "BRENT",
      name: "Crude Oil Brent",
      category: "oil",
      price: 82.1,
      changePercent: 0.57,
      direction: "up",
      momentum: "Up",
      momentumSuggestion: "Up",
      confidence: 69
    }
  ]
};

const fallbackShares: StockSuggestion[] = [
  {
    symbol: "MSFT",
    name: "Microsoft Corp",
    price: 431.2,
    changePercent: 1.92,
    rationale: "Strong earnings momentum and sustained institutional buying pressure.",
    sector: "Technology",
    score: 82,
    factorScores: {
      momentum: 81,
      volatility: 72,
      sentiment: 80,
      participation: 79
    }
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp",
    price: 128.6,
    changePercent: 2.33,
    rationale: "High relative strength and leadership in AI infrastructure demand.",
    sector: "Semiconductors",
    score: 87,
    factorScores: {
      momentum: 90,
      volatility: 76,
      sentiment: 85,
      participation: 84
    }
  },
  {
    symbol: "XOM",
    name: "Exxon Mobil Corp",
    price: 116.74,
    changePercent: 1.14,
    rationale: "Oil price resilience and stable cash flow support the trend continuation.",
    sector: "Energy",
    score: 79,
    factorScores: {
      momentum: 77,
      volatility: 74,
      sentiment: 79,
      participation: 72
    }
  }
];

const fallbackNotifierStatus: NotifierStatus = {
  enabled: false,
  running: false,
  targets: 0,
  intervalMs: null,
  seeded: false,
  seenNewsCount: 0,
  lastRunAt: null,
  lastSuccessAt: null,
  lastSource: "fallback",
  lastReason: "Static web deployment without API backend",
  lastSentCount: 0,
  totalSentCount: 0,
  lastError: "Notifier requires deployed HTTPS API backend"
};

async function getJson<T>(path: string): Promise<T> {
  const method = "GET";
  const baseCandidates = getReachableBaseUrls();
  const cacheCandidates = baseCandidates.map((baseUrl) => cacheKeyFor(path, baseUrl));

  try {
    const response = await requestWithFallback(path, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache"
      }
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const payload = (await response.json()) as T;
    setApiNotice(null);
    if (method === "GET") {
      for (const baseUrl of baseCandidates) {
        const key = cacheKeyFor(path, baseUrl);
        jsonResponseCache.set(key, payload);
        writeSharedCache(path, baseUrl, payload);
      }
    }
    return payload;
  } catch (error) {
    const message = normalizeErrorMessage(error);
    const useCache = isRateLimitMessage(message) || isTimeoutMessage(message) || /Follower tab using shared cache/i.test(message);

    if (useCache) {
      const notice = null;

      for (const key of cacheCandidates) {
        const cached = jsonResponseCache.get(key);
        if (cached) {
          setApiNotice(notice);
          return cached as T;
        }
      }

      for (const baseUrl of baseCandidates) {
        const shared = readSharedCache<T>(path, baseUrl);
        if (shared) {
          setApiNotice(notice);
          return shared;
        }
      }

      // If fresh cache is unavailable, allow stale shared cache to avoid hard failures during prolonged throttling.
      for (const baseUrl of baseCandidates) {
        const staleShared = readSharedCache<T>(path, baseUrl, STALE_SHARED_CACHE_MAX_AGE_MS);
        if (staleShared) {
          setApiNotice(null);
          return staleShared;
        }
      }

      setApiNotice(null);
    }

    throw new Error(message);
  }
}

export async function fetchGlobalNews() {
  try {
    return await getJson<NewsFeedResponse>("/api/news/global");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load live global news");
  }
}

export async function fetchMarketTrends() {
  try {
    return await getJson<MarketTrendsResponse>("/api/market/trends");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load live market trends");
  }
}

export async function fetchBestShares() {
  try {
    const result = await getJson<{ data: StockSuggestion[] }>("/api/market/best-shares");
    return result.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load live best shares");
  }
}

export async function fetchNotifierStatus() {
  try {
    return await getJson<NotifierStatus>("/api/notify/status");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load notifier status");
  }
}

export async function fetchForexCandles(pairs: string[], timeframe: ForexTimeframe, years = 5) {
  try {
    const response = await requestWithFallback("/api/market/forex-candles", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache"
      },
      body: JSON.stringify({ pairs, timeframe, years })
    });

    return (await response.json()) as ForexCandlesResponse;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load live forex candles");
  }
}

export async function fetchMarketHistory(symbols: string[], timeframes: MarketHistoryTimeframe[], years = 5) {
  try {
    const response = await requestWithFallback("/api/market/history", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache"
      },
      body: JSON.stringify({ symbols, timeframes, years })
    });

    return (await response.json()) as MarketHistoryResponse;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load market history");
  }
}

export async function fetchMarketAgents() {
  try {
    return await getJson<MarketAgentsResponse>("/api/market/agents");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load market agents");
  }
}

export async function fetchForexMonitoringReport() {
  try {
    return await getJson<ForexTradeMonitoringReport>("/api/market/forex-monitoring-report");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load forex monitoring report");
  }
}

export async function fetchForexMonitoringHistory(days = 10) {
  try {
    return await getJson<ForexTradeMonitoringHistoryReport>(`/api/market/forex-monitoring-history?days=${days}`);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load forex monitoring history");
  }
}

export async function fetchMt4Snapshot() {
  try {
    return await getJson<Mt4SnapshotResponse>("/api/mt4/snapshot");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load MT4 snapshot");
  }
}

export async function fetchMt4Quotes() {
  try {
    return await getJson<Mt4QuoteFeedResponse>("/api/mt4/quotes");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load MT4 quotes");
  }
}

export async function postMt4Snapshot(snapshot: Mt4Snapshot) {
  try {
    const response = await requestWithFallback("/api/mt4/snapshot", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache"
      },
      body: JSON.stringify(snapshot)
    });

    return (await response.json()) as Mt4SnapshotResponse;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to send MT4 snapshot");
  }
}

export async function postSlackAlert(message: string) {
  let response: Response;
  try {
    response = await requestWithFallback("/api/notify/slack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Market Alert*\n${message}`
            }
          }
        ]
      })
    });
  } catch {
    throw new Error("Slack notifications require a deployed HTTPS API backend URL.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "Slack request failed" }))) as {
      error?: string;
    };
    throw new Error(payload.error ?? "Slack request failed");
  }
}
