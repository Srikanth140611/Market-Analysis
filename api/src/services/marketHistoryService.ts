import { getForexCandles, type ForexTimeframe, type OhlcCandle } from "./marketService.js";

export type MarketAssetCategory = "forex" | "commodity" | "oil";
export type HistoryTimeframe = "1hour" | "4hour" | "12hour" | "1Day" | "1Week";
export type HistorySource = "live" | "derived" | "fallback";
export type PatternKind = "trend" | "range" | "breakout" | "reversal" | "momentum" | "compression";
export type PatternDirection = "up" | "down" | "neutral";

export type HistorySeriesFrame = {
  candles: OhlcCandle[];
  source: HistorySource;
  note?: string;
};

export type MarketPatternSignal = {
  symbol: string;
  name: string;
  category: MarketAssetCategory;
  timeframe: HistoryTimeframe;
  pattern: PatternKind;
  direction: PatternDirection;
  confidence: number;
  support: number;
  resistance: number;
  latestClose: number;
  sampleSize: number;
  source: HistorySource;
  note: string;
};

export type MarketHistoryResponse = {
  data: Record<string, Record<HistoryTimeframe, HistorySeriesFrame>>;
  patterns: MarketPatternSignal[];
  source: HistorySource | "mixed";
  reason?: string;
  years: number;
  timeframes: HistoryTimeframe[];
};

type HistorySymbol = {
  symbol: string;
  name: string;
  category: MarketAssetCategory;
  yahooCode: string;
  forexPair?: string;
};

const SUPPORTED_TIMEFRAMES: HistoryTimeframe[] = ["1hour", "4hour", "12hour", "1Day", "1Week"];

const HISTORY_SYMBOLS: HistorySymbol[] = [
  { symbol: "AUD/USD", name: "Australian Dollar vs US Dollar", category: "forex", yahooCode: "AUDUSD=X", forexPair: "AUD/USD" },
  { symbol: "EUR/USD", name: "Euro vs US Dollar", category: "forex", yahooCode: "EURUSD=X", forexPair: "EUR/USD" },
  { symbol: "GBP/USD", name: "British Pound vs US Dollar", category: "forex", yahooCode: "GBPUSD=X", forexPair: "GBP/USD" },
  { symbol: "AUD/JPY", name: "Australian Dollar vs Japanese Yen", category: "forex", yahooCode: "AUDJPY=X", forexPair: "AUD/JPY" },
  { symbol: "EUR/AUD", name: "Euro vs Australian Dollar", category: "forex", yahooCode: "EURAUD=X", forexPair: "EUR/AUD" },
  { symbol: "GBP/AUD", name: "British Pound vs Australian Dollar", category: "forex", yahooCode: "GBPAUD=X", forexPair: "GBP/AUD" },
  { symbol: "AUD/NZD", name: "Australian Dollar vs New Zealand Dollar", category: "forex", yahooCode: "AUDNZD=X", forexPair: "AUD/NZD" },
  { symbol: "EUR/NZD", name: "Euro vs New Zealand Dollar", category: "forex", yahooCode: "EURNZD=X", forexPair: "EUR/NZD" },
  { symbol: "EUR/GBP", name: "Euro vs British Pound", category: "forex", yahooCode: "EURGBP=X", forexPair: "EUR/GBP" },
  { symbol: "CAD/JPY", name: "Canadian Dollar vs Japanese Yen", category: "forex", yahooCode: "CADJPY=X", forexPair: "CAD/JPY" },
  { symbol: "USD/CAD", name: "US Dollar vs Canadian Dollar", category: "forex", yahooCode: "CAD=X", forexPair: "USD/CAD" },
  { symbol: "USD/CHF", name: "US Dollar vs Swiss Franc", category: "forex", yahooCode: "CHF=X", forexPair: "USD/CHF" },
  { symbol: "GBP/NZD", name: "British Pound vs New Zealand Dollar", category: "forex", yahooCode: "GBPNZD=X", forexPair: "GBP/NZD" },
  { symbol: "NZD/JPY", name: "New Zealand Dollar vs Japanese Yen", category: "forex", yahooCode: "NZDJPY=X", forexPair: "NZD/JPY" },
  { symbol: "AUD/CHF", name: "Australian Dollar vs Swiss Franc", category: "forex", yahooCode: "AUDCHF=X", forexPair: "AUD/CHF" },
  { symbol: "EUR/CAD", name: "Euro vs Canadian Dollar", category: "forex", yahooCode: "EURCAD=X", forexPair: "EUR/CAD" },
  { symbol: "USD/JPY", name: "US Dollar vs Japanese Yen", category: "forex", yahooCode: "JPY=X", forexPair: "USD/JPY" },
  { symbol: "EUR/JPY", name: "Euro vs Japanese Yen", category: "forex", yahooCode: "EURJPY=X", forexPair: "EUR/JPY" },
  { symbol: "XAU/USD", name: "Gold Spot", category: "commodity", yahooCode: "GC=F" },
  { symbol: "XAG/USD", name: "Silver Spot", category: "commodity", yahooCode: "SI=F" },
  { symbol: "BRENT", name: "Crude Oil Brent", category: "oil", yahooCode: "BZ=F" },
  { symbol: "WTI", name: "Crude Oil WTI", category: "oil", yahooCode: "CL=F" }
];

function isFiniteNumberArray(values: unknown): values is number[] {
  return Array.isArray(values) && values.every((value) => Number.isFinite(value));
}

function jsonStep(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function aggregateCandles(candles: OhlcCandle[], bucket: number): OhlcCandle[] {
  if (bucket <= 1 || candles.length === 0) {
    return candles;
  }

  const output: OhlcCandle[] = [];
  for (let index = 0; index < candles.length; index += bucket) {
    const chunk = candles.slice(index, index + bucket);
    if (chunk.length === 0) {
      continue;
    }

    output.push({
      t: chunk[0].t,
      o: chunk[0].o,
      h: Math.max(...chunk.map((candle) => candle.h)),
      l: Math.min(...chunk.map((candle) => candle.l)),
      c: chunk[chunk.length - 1].c
    });
  }

  return output;
}

function compressCandles(candles: OhlcCandle[], targetCount: number) {
  if (candles.length <= targetCount) {
    return candles;
  }

  const step = candles.length / targetCount;
  const output: OhlcCandle[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const start = Math.floor(index * step);
    const end = Math.min(candles.length, Math.floor((index + 1) * step));
    const chunk = candles.slice(start, Math.max(start + 1, end));

    output.push({
      t: chunk[0].t,
      o: chunk[0].o,
      h: Math.max(...chunk.map((candle) => candle.h)),
      l: Math.min(...chunk.map((candle) => candle.l)),
      c: chunk[chunk.length - 1].c
    });
  }

  return output;
}

function timeframeToTargetCount(timeframe: HistoryTimeframe) {
  switch (timeframe) {
    case "1hour":
      return 280;
    case "4hour":
      return 220;
    case "12hour":
      return 160;
    case "1Day":
      return 520;
    case "1Week":
      return 260;
    default:
      return 260;
  }
}

function timeframeLabel(timeframe: HistoryTimeframe) {
  switch (timeframe) {
    case "1hour":
      return "1 hour";
    case "4hour":
      return "4 hour";
    case "12hour":
      return "12 hour";
    case "1Day":
      return "1 day";
    case "1Week":
      return "1 week";
    default:
      return timeframe;
  }
}

function toCandleSeries(payload: {
  timestamp?: unknown;
  open?: unknown;
  high?: unknown;
  low?: unknown;
  close?: unknown;
}) {
  const timestamps = isFiniteNumberArray(payload.timestamp) ? payload.timestamp : [];
  const opens = isFiniteNumberArray(payload.open) ? payload.open : [];
  const highs = isFiniteNumberArray(payload.high) ? payload.high : [];
  const lows = isFiniteNumberArray(payload.low) ? payload.low : [];
  const closes = isFiniteNumberArray(payload.close) ? payload.close : [];
  const length = Math.min(timestamps.length, opens.length || closes.length, highs.length || closes.length, lows.length || closes.length, closes.length);

  const candles: OhlcCandle[] = [];
  for (let index = 0; index < length; index += 1) {
    const close = Number(closes[index]);
    if (!Number.isFinite(close) || close <= 0) {
      continue;
    }

    const open = Number(opens[index] ?? close);
    const high = Number(highs[index] ?? Math.max(open, close));
    const low = Number(lows[index] ?? Math.min(open, close));
    const timestamp = Number(timestamps[index]);

    if (!Number.isFinite(timestamp)) {
      continue;
    }

    candles.push({
      t: timestamp,
      o: open,
      h: high,
      l: low,
      c: close
    });
  }

  return candles;
}

async function fetchYahooHistory(symbol: string): Promise<OhlcCandle[]> {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5y`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json,text/plain,*/*",
      Referer: "https://finance.yahoo.com/"
    }
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  if (!result) {
    return [];
  }

  return toCandleSeries({
    timestamp: result.timestamp,
    open: result.indicators?.quote?.[0]?.open,
    high: result.indicators?.quote?.[0]?.high,
    low: result.indicators?.quote?.[0]?.low,
    close: result.indicators?.quote?.[0]?.close
  });
}

function sma(values: number[], period: number) {
  if (values.length === 0) {
    return 0;
  }

  const slice = values.slice(-Math.min(period, values.length));
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

function rsi(values: number[], period: number) {
  if (values.length <= period) {
    return 50;
  }

  let gains = 0;
  let losses = 0;
  for (let index = values.length - period; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function classifyPattern(symbol: HistorySymbol, timeframe: HistoryTimeframe, candles: OhlcCandle[], source: HistorySource): MarketPatternSignal {
  const closes = candles.map((candle) => candle.c);
  const window = Math.min(50, candles.length);
  const recentCandles = candles.slice(-window);
  const recentCloses = closes.slice(-window);

  if (recentCandles.length === 0) {
    return {
      symbol: symbol.symbol,
      name: symbol.name,
      category: symbol.category,
      timeframe,
      pattern: "range",
      direction: "neutral",
      confidence: 0,
      support: 0,
      resistance: 0,
      latestClose: 0,
      sampleSize: 0,
      source,
      note: `No history available for ${symbol.symbol} on ${timeframeLabel(timeframe)}`
    };
  }

  const latest = recentCandles[recentCandles.length - 1];
  const support = Math.min(...recentCandles.map((candle) => candle.l));
  const resistance = Math.max(...recentCandles.map((candle) => candle.h));
  const ma20 = sma(recentCloses, 20);
  const ma50 = sma(recentCloses, 50);
  const rsi14 = rsi(recentCloses, 14);
  const slopeWindow = Math.min(10, recentCloses.length - 1);
  const slopeBase = recentCloses[recentCloses.length - 1 - slopeWindow] ?? recentCloses[0];
  const slope = slopeBase > 0 ? ((latest.c - slopeBase) / slopeBase) * 100 : 0;
  const rangePercent = latest.c > 0 ? ((resistance - support) / latest.c) * 100 : 0;
  const avgRange = recentCandles.reduce((sum, candle) => sum + (candle.h - candle.l), 0) / recentCandles.length;
  const avgRangePercent = latest.c > 0 ? (avgRange / latest.c) * 100 : 0;

  let pattern: PatternKind = "momentum";
  let direction: PatternDirection = latest.c >= ma20 ? "up" : "down";
  let confidence = 58;
  let note = `${symbol.symbol} is showing balanced price discovery on the ${timeframeLabel(timeframe)} chart.`;

  const nearResistance = latest.c >= resistance * 0.985;
  const nearSupport = latest.c <= support * 1.015;
  const trendUp = latest.c >= ma20 && ma20 >= ma50 && slope > 0;
  const trendDown = latest.c <= ma20 && ma20 <= ma50 && slope < 0;
  const compression = avgRangePercent < 1.2 && rangePercent < 6;
  const reversalUp = rsi14 <= 35 && slope > 0;
  const reversalDown = rsi14 >= 65 && slope < 0;

  if (compression) {
    pattern = "compression";
    direction = latest.c >= ma20 ? "up" : "down";
    confidence = 63;
    note = `${symbol.symbol} is in compressed price action; a volatility expansion is likely.`;
  } else if (nearResistance && slope > 0) {
    pattern = "breakout";
    direction = "up";
    confidence = 74;
    note = `${symbol.symbol} is pressing into resistance and may be breaking higher.`;
  } else if (nearSupport && slope < 0) {
    pattern = "breakout";
    direction = "down";
    confidence = 74;
    note = `${symbol.symbol} is testing support and may be breaking lower.`;
  } else if (reversalUp) {
    pattern = "reversal";
    direction = "up";
    confidence = 71;
    note = `${symbol.symbol} is oversold and turning higher on the ${timeframeLabel(timeframe)} chart.`;
  } else if (reversalDown) {
    pattern = "reversal";
    direction = "down";
    confidence = 71;
    note = `${symbol.symbol} is overbought and turning lower on the ${timeframeLabel(timeframe)} chart.`;
  } else if (trendUp) {
    pattern = "trend";
    direction = "up";
    confidence = jsonStep(68 + Math.round(Math.abs(slope) * 1.5), 60, 88);
    note = `${symbol.symbol} is in an uptrend with price holding above the short and medium moving averages.`;
  } else if (trendDown) {
    pattern = "trend";
    direction = "down";
    confidence = jsonStep(68 + Math.round(Math.abs(slope) * 1.5), 60, 88);
    note = `${symbol.symbol} is in a downtrend with price staying below the short and medium moving averages.`;
  } else if (rangePercent < 4.5) {
    pattern = "range";
    direction = "neutral";
    confidence = 66;
    note = `${symbol.symbol} is trading in a range on the ${timeframeLabel(timeframe)} chart.`;
  } else {
    pattern = "momentum";
    direction = slope >= 0 ? "up" : "down";
    confidence = jsonStep(60 + Math.round(Math.abs(slope) * 1.2), 55, 82);
    note = `${symbol.symbol} is showing directional momentum on the ${timeframeLabel(timeframe)} chart.`;
  }

  return {
    symbol: symbol.symbol,
    name: symbol.name,
    category: symbol.category,
    timeframe,
    pattern,
    direction,
    confidence,
    support,
    resistance,
    latestClose: latest.c,
    sampleSize: recentCandles.length,
    source,
    note
  };
}

async function fetchForexHistory(pair: string, timeframe: HistoryTimeframe, years: number): Promise<HistorySeriesFrame> {
  if (timeframe === "12hour") {
    const base = await getForexCandles([pair], "1hour" as ForexTimeframe, years);
    const source: HistorySource = base.source === "live" ? "live" : "fallback";
    const raw = base.data[pair] ?? [];
    return {
      candles: compressCandles(aggregateCandles(raw, 12), timeframeToTargetCount(timeframe)),
      source,
      note: source === "live" ? "Live forex candles aggregated to 12-hour bars" : base.reason ?? "Fallback forex candles"
    };
  }

  const base = await getForexCandles([pair], timeframe as ForexTimeframe, years);
  const source: HistorySource = base.source === "live" ? "live" : "fallback";
  const raw = base.data[pair] ?? [];

  return {
    candles: compressCandles(raw, timeframeToTargetCount(timeframe)),
    source,
    note: source === "live" ? `Live forex candles for ${timeframeLabel(timeframe)}` : base.reason ?? "Fallback forex candles"
  };
}

async function fetchCommodityOrOilHistory(symbol: HistorySymbol, timeframe: HistoryTimeframe): Promise<HistorySeriesFrame> {
  const daily = await fetchYahooHistory(symbol.yahooCode);

  if (daily.length === 0) {
    return {
      candles: [],
      source: "fallback",
      note: `Historical data unavailable for ${symbol.symbol}`
    };
  }

  if (timeframe === "1Week") {
    return {
      candles: compressCandles(aggregateCandles(daily, 5), timeframeToTargetCount(timeframe)),
      source: "derived",
      note: `Derived weekly history from Yahoo daily closes for ${symbol.symbol}`
    };
  }

  if (timeframe === "12hour") {
    return {
      candles: compressCandles(aggregateCandles(daily, 2), timeframeToTargetCount(timeframe)),
      source: "derived",
      note: `Derived 12-hour history from Yahoo daily closes for ${symbol.symbol}`
    };
  }

  if (timeframe === "1Day") {
    return {
      candles: compressCandles(daily, timeframeToTargetCount(timeframe)),
      source: "live",
      note: `Live Yahoo daily history for ${symbol.symbol}`
    };
  }

  return {
    candles: compressCandles(daily, timeframeToTargetCount(timeframe)),
    source: "derived",
    note: `${symbol.symbol} does not expose public intraday history here; using derived bars from Yahoo daily history`
  };
}

export async function getMarketHistory(symbols: string[], timeframes: HistoryTimeframe[], years = 5): Promise<MarketHistoryResponse> {
  const requestedSymbols = Array.from(new Set(symbols)).filter((symbol) => HISTORY_SYMBOLS.some((item) => item.symbol === symbol));
  const requestedTimeframes = Array.from(new Set(timeframes)).filter((timeframe) => SUPPORTED_TIMEFRAMES.includes(timeframe));

  if (requestedSymbols.length === 0 || requestedTimeframes.length === 0) {
    return {
      data: {},
      patterns: [],
      source: "fallback",
      reason: "No supported market history requested",
      years,
      timeframes: requestedTimeframes
    };
  }

  const result: Record<string, Record<HistoryTimeframe, HistorySeriesFrame>> = {};
  const patterns: MarketPatternSignal[] = [];
  const sources = new Set<HistorySource>();

  for (const symbolName of requestedSymbols) {
    const symbol = HISTORY_SYMBOLS.find((item) => item.symbol === symbolName);
    if (!symbol) {
      continue;
    }

    result[symbol.symbol] = {} as Record<HistoryTimeframe, HistorySeriesFrame>;

    for (const timeframe of requestedTimeframes) {
      let frame: HistorySeriesFrame;

      if (symbol.category === "forex") {
        frame = await fetchForexHistory(symbol.symbol, timeframe, years);
      } else {
        frame = await fetchCommodityOrOilHistory(symbol, timeframe);
      }

      result[symbol.symbol][timeframe] = frame;
      sources.add(frame.source);

      patterns.push(classifyPattern(symbol, timeframe, frame.candles, frame.source));
    }
  }

  const source = sources.size === 1 ? Array.from(sources)[0] : sources.size > 1 ? "mixed" : "fallback";
  const reason =
    source === "mixed"
      ? "Forex uses live candle history where available; commodities and oil use live Yahoo daily history plus derived intraday bars"
      : source === "live"
        ? "Historical data sourced live from public market feeds"
        : source === "derived"
          ? "Historical data derived from public daily market feeds"
          : "Historical market data unavailable";

  return {
    data: result,
    patterns,
    source,
    reason,
    years,
    timeframes: requestedTimeframes
  };
}
