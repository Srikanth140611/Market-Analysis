import { config } from "../config.js";
import { throwLiveDataUnavailable } from "../liveData.js";

export type TrendDirection = "up" | "down";

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
  v?: number;
};

export type ForexCandlesResponse = {
  data: Record<string, OhlcCandle[]>;
  source: "live" | "fallback";
  provider: "finnhub" | "fallback";
  reason?: string;
  timeframe: ForexTimeframe;
  years: number;
};

export type MarketTrend = {
  symbol: string;
  name: string;
  category: "forex" | "commodity" | "oil";
  price: number;
  changePercent: number;
  direction: TrendDirection;
  momentum: "Up" | "Down";
  momentumSuggestion: "Up" | "Down";
  confidence: number;
};

export type MarketTrendsResponse = {
  data: MarketTrend[];
  source: "live" | "fallback";
  reason?: string;
};

const fallbackTrends: MarketTrend[] = [
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
];

const FOREX_SYMBOLS: Record<string, string> = {
  "EUR/USD": "OANDA:EUR_USD",
  "GBP/USD": "OANDA:GBP_USD",
  "USD/JPY": "OANDA:USD_JPY",
  "USD/CHF": "OANDA:USD_CHF",
  "USD/CAD": "OANDA:USD_CAD",
  "AUD/USD": "OANDA:AUD_USD",
  "NZD/USD": "OANDA:NZD_USD",
  "EUR/JPY": "OANDA:EUR_JPY",
  "GBP/JPY": "OANDA:GBP_JPY",
  "EUR/GBP": "OANDA:EUR_GBP",
  "AUD/JPY": "OANDA:AUD_JPY",
  "CHF/JPY": "OANDA:CHF_JPY",
  "EUR/AUD": "OANDA:EUR_AUD",
  "GBP/AUD": "OANDA:GBP_AUD",
  "AUD/NZD": "OANDA:AUD_NZD",
  "EUR/NZD": "OANDA:EUR_NZD",
  "CAD/JPY": "OANDA:CAD_JPY",
  "GBP/NZD": "OANDA:GBP_NZD",
  "NZD/JPY": "OANDA:NZD_JPY",
  "AUD/CHF": "OANDA:AUD_CHF",
  "EUR/CAD": "OANDA:EUR_CAD"
};

export async function getLiveForexSpotPrice(pair: string): Promise<number | null> {
  const yahooSymbol = FOREX_SYMBOLS[pair];
  if (!yahooSymbol) {
    return null;
  }

  try {
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
    url.searchParams.set("interval", "1m");
    url.searchParams.set("range", "1d");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json,text/plain,*/*",
        Referer: "https://finance.yahoo.com/"
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      chart?: {
        result?: Array<{
          indicators?: {
            quote?: Array<{
              close?: unknown;
            }>;
          };
        }>;
      };
    };

    const closes = payload.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!Array.isArray(closes)) {
      return null;
    }

    for (let index = closes.length - 1; index >= 0; index -= 1) {
      const value = Number(closes[index]);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }
  } catch {
    // Fall through to null.
  }

  return null;
}

function timeframePlan(timeframe: ForexTimeframe): { resolution: string; bucket: number } {
  switch (timeframe) {
    case "1minute":
      return { resolution: "1", bucket: 1 };
    case "5minute":
      return { resolution: "5", bucket: 1 };
    case "1hour":
      return { resolution: "60", bucket: 1 };
    case "4hour":
      return { resolution: "60", bucket: 4 };
    case "1Day":
      return { resolution: "D", bucket: 1 };
    case "1Week":
      return { resolution: "W", bucket: 1 };
    case "1Month":
      return { resolution: "M", bucket: 1 };
    case "3Months":
      return { resolution: "M", bucket: 3 };
    case "1Year":
      return { resolution: "M", bucket: 12 };
    default:
      return { resolution: "D", bucket: 1 };
  }
}

function aggregateCandles(candles: OhlcCandle[], bucket: number): OhlcCandle[] {
  if (bucket <= 1 || candles.length === 0) {
    return candles;
  }

  const output: OhlcCandle[] = [];
  for (let i = 0; i < candles.length; i += bucket) {
    const chunk = candles.slice(i, i + bucket);
    if (chunk.length === 0) {
      continue;
    }

    output.push({
      t: chunk[0].t,
      o: chunk[0].o,
      h: Math.max(...chunk.map((candle) => candle.h)),
      l: Math.min(...chunk.map((candle) => candle.l)),
      c: chunk[chunk.length - 1].c,
      v: chunk.reduce((sum, candle) => sum + (Number(candle.v) || 0), 0)
    });
  }

  return output;
}

function isFiniteNumberArray(values: unknown): values is number[] {
  return Array.isArray(values) && values.every((value) => Number.isFinite(value));
}

async function fetchFinnhubCandles(
  symbol: string,
  resolution: string,
  fromSeconds: number,
  toSeconds: number,
  token: string
): Promise<OhlcCandle[]> {
  const url = new URL("https://finnhub.io/api/v1/forex/candle");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("resolution", resolution);
  url.searchParams.set("from", String(fromSeconds));
  url.searchParams.set("to", String(toSeconds));
  url.searchParams.set("token", token);

  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    s?: string;
    t?: unknown;
    o?: unknown;
    h?: unknown;
    l?: unknown;
    c?: unknown;
    v?: unknown;
  };

  if (payload.s !== "ok") {
    return [];
  }

  if (!isFiniteNumberArray(payload.t) || !isFiniteNumberArray(payload.o) || !isFiniteNumberArray(payload.h) || !isFiniteNumberArray(payload.l) || !isFiniteNumberArray(payload.c)) {
    return [];
  }

  const volumes = isFiniteNumberArray(payload.v) ? payload.v : [];

  const length = Math.min(payload.t.length, payload.o.length, payload.h.length, payload.l.length, payload.c.length);
  const candles: OhlcCandle[] = [];
  for (let i = 0; i < length; i += 1) {
    candles.push({
      t: payload.t[i],
      o: payload.o[i],
      h: payload.h[i],
      l: payload.l[i],
      c: payload.c[i],
      v: Number.isFinite(volumes[i]) ? volumes[i] : 0
    });
  }

  return candles;
}

export async function getForexCandles(
  pairs: string[],
  timeframe: ForexTimeframe,
  years = 5
): Promise<ForexCandlesResponse> {
  const uniquePairs = Array.from(new Set(pairs)).filter((pair) => Boolean(FOREX_SYMBOLS[pair]));

  if (uniquePairs.length === 0) {
    return {
      data: {},
      source: "fallback",
      provider: "fallback",
      reason: "No supported forex pairs requested",
      timeframe,
      years
    };
  }

  if (!config.FINNHUB_API_KEY) {
    if (config.STRICT_LIVE_MODE) {
      throwLiveDataUnavailable("Live forex candles unavailable", "FINNHUB_API_KEY is not configured");
    }

    return {
      data: {},
      source: "fallback",
      provider: "fallback",
      reason: "FINNHUB_API_KEY is not configured",
      timeframe,
      years
    };
  }

  const { resolution, bucket } = timeframePlan(timeframe);
  const toSeconds = Math.floor(Date.now() / 1000);
  const fromSeconds = toSeconds - years * 365 * 24 * 60 * 60;

  const perPair = await Promise.all(
    uniquePairs.map(async (pair) => {
      const symbol = FOREX_SYMBOLS[pair];
      try {
        const raw = await fetchFinnhubCandles(symbol, resolution, fromSeconds, toSeconds, config.FINNHUB_API_KEY!);
        const aggregated = aggregateCandles(raw, bucket);
        return [pair, aggregated] as const;
      } catch {
        return [pair, []] as const;
      }
    })
  );

  const data = Object.fromEntries(perPair) as Record<string, OhlcCandle[]>;
  const hasLive = Object.values(data).some((candles) => candles.length > 0);

  if (hasLive) {
    return {
      data,
      source: "live",
      provider: "finnhub",
      timeframe,
      years
    };
  }

  if (config.STRICT_LIVE_MODE) {
    throwLiveDataUnavailable("Live forex candles unavailable", "Live candle provider unavailable for requested range");
  }

  return {
    data,
    source: "fallback",
    provider: "fallback",
    reason: "Live candle provider unavailable for requested range",
    timeframe,
    years
  };
}

function toDirection(changePercent: number): TrendDirection {
  if (changePercent >= 0) {
    return "up";
  }
  return "down";
}

type YahooQuoteResult = {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
};

async function fetchYahooTrends(): Promise<MarketTrend[] | null> {
  const yahooSymbols = [
    { code: "EURUSD=X", label: "EUR/USD", name: "Euro vs US Dollar", category: "forex" as const },
    { code: "GBPUSD=X", label: "GBP/USD", name: "British Pound vs US Dollar", category: "forex" as const },
    { code: "JPY=X", label: "USD/JPY", name: "US Dollar vs Japanese Yen", category: "forex" as const },
    { code: "CHF=X", label: "USD/CHF", name: "US Dollar vs Swiss Franc", category: "forex" as const },
    { code: "AUDUSD=X", label: "AUD/USD", name: "Australian Dollar vs US Dollar", category: "forex" as const },
    { code: "NZDUSD=X", label: "NZD/USD", name: "New Zealand Dollar vs US Dollar", category: "forex" as const },
    { code: "CAD=X", label: "USD/CAD", name: "US Dollar vs Canadian Dollar", category: "forex" as const },
    { code: "EURGBP=X", label: "EUR/GBP", name: "Euro vs British Pound", category: "forex" as const },
    { code: "EURJPY=X", label: "EUR/JPY", name: "Euro vs Japanese Yen", category: "forex" as const },
    { code: "GBPJPY=X", label: "GBP/JPY", name: "British Pound vs Japanese Yen", category: "forex" as const },
    { code: "AUDJPY=X", label: "AUD/JPY", name: "Australian Dollar vs Japanese Yen", category: "forex" as const },
    { code: "CHFJPY=X", label: "CHF/JPY", name: "Swiss Franc vs Japanese Yen", category: "forex" as const },
    { code: "GC=F", label: "XAU/USD", name: "Gold Spot", category: "commodity" as const },
    { code: "SI=F", label: "XAG/USD", name: "Silver Spot", category: "commodity" as const },
    { code: "BZ=F", label: "BRENT", name: "Crude Oil Brent", category: "oil" as const },
    { code: "CL=F", label: "WTI", name: "Crude Oil WTI", category: "oil" as const }
  ];

  const url = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
  url.searchParams.set("symbols", yahooSymbols.map((item) => item.code).join(","));

  const response = await fetch(url, {
    headers: {
      "User-Agent": "market-analysis-api"
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    quoteResponse?: {
      result?: YahooQuoteResult[];
    };
  };

  const map = new Map((payload.quoteResponse?.result ?? []).map((item) => [item.symbol, item]));

  const trends = yahooSymbols
    .map((symbol) => {
      const quote = map.get(symbol.code);
      const price = quote?.regularMarketPrice;
      const changePercent = quote?.regularMarketChangePercent;

      if (typeof price !== "number" || typeof changePercent !== "number") {
        return null;
      }

      const direction = toDirection(changePercent);
      const confidence = Math.max(55, Math.min(95, Math.round(Math.abs(changePercent) * 10 + 60)));

      return {
        symbol: symbol.label,
        name: symbol.name,
        category: symbol.category,
        price,
        changePercent,
        direction,
        momentum: direction === "up" ? "Up" : "Down",
        momentumSuggestion: direction === "up" ? "Up" : "Down",
        confidence
      } satisfies MarketTrend;
    })
    .filter((item): item is MarketTrend => item !== null);

  return trends.length > 0 ? trends : null;
}

export async function getMarketTrends(): Promise<MarketTrendsResponse> {
  if (!config.FINNHUB_API_KEY) {
    try {
      const yahoo = await fetchYahooTrends();
      if (yahoo) {
        return {
          data: yahoo,
          source: "live",
          reason: "FINNHUB_API_KEY is not configured; using Yahoo Finance live quotes"
        };
      }
    } catch {
      // Fall through to fallback response below.
    }

    if (config.STRICT_LIVE_MODE) {
      throwLiveDataUnavailable(
        "Live market trends unavailable",
        "FINNHUB_API_KEY is not configured and Yahoo Finance is unavailable"
      );
    }

    return {
      data: fallbackTrends,
      source: "fallback",
      reason: "FINNHUB_API_KEY is not configured and Yahoo Finance is unavailable"
    };
  }

  const symbols = [
    { code: "OANDA:EUR_USD", label: "EUR/USD", name: "Euro vs US Dollar", category: "forex" as const },
    { code: "OANDA:GBP_USD", label: "GBP/USD", name: "British Pound vs US Dollar", category: "forex" as const },
    { code: "OANDA:USD_JPY", label: "USD/JPY", name: "US Dollar vs Japanese Yen", category: "forex" as const },
    { code: "OANDA:USD_CHF", label: "USD/CHF", name: "US Dollar vs Swiss Franc", category: "forex" as const },
    { code: "OANDA:AUD_USD", label: "AUD/USD", name: "Australian Dollar vs US Dollar", category: "forex" as const },
    { code: "OANDA:NZD_USD", label: "NZD/USD", name: "New Zealand Dollar vs US Dollar", category: "forex" as const },
    { code: "OANDA:USD_CAD", label: "USD/CAD", name: "US Dollar vs Canadian Dollar", category: "forex" as const },
    { code: "OANDA:EUR_GBP", label: "EUR/GBP", name: "Euro vs British Pound", category: "forex" as const },
    { code: "OANDA:EUR_JPY", label: "EUR/JPY", name: "Euro vs Japanese Yen", category: "forex" as const },
    { code: "OANDA:GBP_JPY", label: "GBP/JPY", name: "British Pound vs Japanese Yen", category: "forex" as const },
    { code: "OANDA:AUD_JPY", label: "AUD/JPY", name: "Australian Dollar vs Japanese Yen", category: "forex" as const },
    { code: "OANDA:CHF_JPY", label: "CHF/JPY", name: "Swiss Franc vs Japanese Yen", category: "forex" as const },
    { code: "OANDA:XAU_USD", label: "XAU/USD", name: "Gold Spot", category: "commodity" as const },
    { code: "OANDA:XAG_USD", label: "XAG/USD", name: "Silver Spot", category: "commodity" as const },
    { code: "OANDA:BCO_USD", label: "BRENT", name: "Crude Oil Brent", category: "oil" as const },
    { code: "OANDA:WTICO_USD", label: "WTI", name: "Crude Oil WTI", category: "oil" as const }
  ];

  const quotes = await Promise.all(
    symbols.map(async (symbol) => {
      const url = new URL("https://finnhub.io/api/v1/quote");
      url.searchParams.set("symbol", symbol.code);
      url.searchParams.set("token", config.FINNHUB_API_KEY!);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as { c: number; dp: number };
        if (!Number.isFinite(data.c) || !Number.isFinite(data.dp)) {
          return null;
        }

        const confidence = Math.max(55, Math.min(95, Math.round(Math.abs(data.dp) * 10 + 60)));

        const direction = toDirection(data.dp);

        return {
          symbol: symbol.label,
          name: symbol.name,
          category: symbol.category,
          price: data.c,
          changePercent: data.dp,
          direction,
          momentum: direction === "up" ? "Up" : "Down",
          momentumSuggestion: direction === "up" ? "Up" : "Down",
          confidence
        } satisfies MarketTrend;
      } catch {
        return null;
      }
    })
  );

  const usable = quotes.filter((item): item is MarketTrend => Boolean(item));
  if (usable.length > 0) {
    return {
      data: usable,
      source: "live"
    };
  }

  try {
    const yahoo = await fetchYahooTrends();
    if (yahoo) {
      return {
        data: yahoo,
        source: "live",
        reason: "Finnhub unavailable; using Yahoo Finance live quotes"
      };
    }
  } catch {
    // Fall through to fallback response below.
  }

  if (config.STRICT_LIVE_MODE) {
    throwLiveDataUnavailable("Live market trends unavailable", "Live quote providers unavailable");
  }

  return {
    data: fallbackTrends,
    source: "fallback",
    reason: "Live quote providers unavailable"
  };
}
