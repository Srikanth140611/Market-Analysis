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

export type MarketTrend = {
  symbol: string;
  name: string;
  category: "forex" | "commodity" | "oil";
  price: number;
  changePercent: number;
  direction: "up" | "down";
  momentum: "Up" | "Down";
  momentumSuggestion: "Up" | "Down";
  confidence: number;
};

export type MarketTrendsResponse = {
  data: MarketTrend[];
  source: "live" | "fallback";
  reason?: string;
};

export type StockSuggestion = {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  rationale: string;
  sector?: string;
  score?: number;
  factorScores?: {
    momentum: number;
    volatility: number;
    sentiment: number;
    participation: number;
  };
};

export type NotifierStatus = {
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

export type ForexTimeframe =
  | "1minute"
  | "5minute"
  | "1hour"
  | "4hour"
  | "1Day"
  | "1Week"
  | "1Month"
  | "3Months"
  | "1Year";

export type OhlcCandle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
};

export type ForexCandlesResponse = {
  data: Record<string, OhlcCandle[]>;
  source: "live" | "fallback";
  provider: "finnhub" | "fallback";
  reason?: string;
  timeframe: ForexTimeframe;
  years: number;
};
