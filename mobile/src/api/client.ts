import { API_BASE_URL } from "../constants";
import { ForexCandlesResponse, ForexTimeframe, MarketTrendsResponse, NewsFeedResponse, NotifierStatus, StockSuggestion } from "../types";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, max-age=0",
      Pragma: "no-cache"
    }
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchGlobalNews() {
  return getJson<NewsFeedResponse>("/api/news/global");
}

export async function fetchMarketTrends() {
  return getJson<MarketTrendsResponse>("/api/market/trends");
}

export async function fetchBestShares() {
  const result = await getJson<{ data: StockSuggestion[] }>("/api/market/best-shares");
  return result.data;
}

export async function fetchNotifierStatus() {
  return getJson<NotifierStatus>("/api/notify/status");
}

export async function fetchForexCandles(pairs: string[], timeframe: ForexTimeframe, years = 5) {
  const response = await fetch(`${API_BASE_URL}/api/market/forex-candles`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, max-age=0",
      Pragma: "no-cache"
    },
    body: JSON.stringify({ pairs, timeframe, years })
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as ForexCandlesResponse;
}

export async function postSlackAlert(message: string) {
  const response = await fetch(`${API_BASE_URL}/api/notify/slack`, {
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

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "Slack request failed" }))) as {
      error?: string;
    };
    throw new Error(payload.error ?? "Slack request failed");
  }
}
