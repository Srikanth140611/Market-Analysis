import { getForexCandles, type ForexTimeframe, type OhlcCandle } from "./marketService.js";

export type MarketAssetCategory = "forex" | "commodity" | "oil";
export type HistoryTimeframe = "1hour" | "4hour" | "12hour" | "1Day" | "1Week";
export type HistorySource = "live" | "derived" | "fallback";
export type PatternKind = "trend" | "range" | "breakout" | "reversal" | "momentum" | "compression";
export type PatternDirection = "up" | "down" | "neutral";
export type CandlestickPattern =
  | "none"
  | "doji"
  | "dragonfly-doji"
  | "gravestone-doji"
  | "hammer"
  | "inverted-hammer"
  | "hanging-man"
  | "bullish-spinning-top"
  | "bearish-spinning-top"
  | "bullish-marubozu"
  | "bullish-kikker"
  | "bearish-kikker"
  | "bullish-engulfing"
  | "bearish-engulfing"
  | "piercing-line"
  | "dark-cloud-cover"
  | "tweezer-bottom"
  | "tweezer-top"
  | "bullish-harami"
  | "bearish-harami"
  | "morning-star"
  | "bullish-abondened-baby"
  | "bearish-abondened-baby"
  | "three-white-soldiers"
  | "three-black-crows"
  | "three-line-strike"
  | "cup-and-handle"
  | "double-top"
  | "double-bottom"
  | "doble-bottom"
  | "wedge"
  | "flag"
  | "rising-window"
  | "falling-window"
  | "three-inside-up"
  | "three-inside-down"
  | "three-outside-up"
  | "three-outside-down";

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
  candlestickPattern: CandlestickPattern;
  candlestickBias: PatternDirection;
  candlestickImpactScore: number;
  volumeRatio: number | null;
  volumeImpactScore: number;
  trendImpactScore: number;
  historicalRecurrenceScore?: number;
  historicalRecurrenceSummary?: string;
  volumeConfirmation: "strong" | "weak" | "neutral" | "unavailable";
  isAtSupport: boolean;
  isAtResistance: boolean;
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
      c: chunk[chunk.length - 1].c,
      v: chunk.reduce((sum, candle) => sum + (Number(candle.v) || 0), 0)
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
      c: chunk[chunk.length - 1].c,
      v: chunk.reduce((sum, candle) => sum + (Number(candle.v) || 0), 0)
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
  volume?: unknown;
}) {
  const timestamps = isFiniteNumberArray(payload.timestamp) ? payload.timestamp : [];
  const opens = isFiniteNumberArray(payload.open) ? payload.open : [];
  const highs = isFiniteNumberArray(payload.high) ? payload.high : [];
  const lows = isFiniteNumberArray(payload.low) ? payload.low : [];
  const closes = isFiniteNumberArray(payload.close) ? payload.close : [];
  const volumes = Array.isArray(payload.volume) ? payload.volume : [];
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
      c: close,
      v: Number.isFinite(volumes[index]) ? Number(volumes[index]) : 0
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
    close: result.indicators?.quote?.[0]?.close,
    volume: result.indicators?.quote?.[0]?.volume
  });
}

function sma(values: number[], period: number) {
  if (values.length === 0) {
    return 0;
  }

  const slice = values.slice(-Math.min(period, values.length));
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

function ema(values: number[], period: number) {
  if (values.length === 0) {
    return 0;
  }

  const smoothing = 2 / (period + 1);
  let current = values[0];
  for (let index = 1; index < values.length; index += 1) {
    current = (values[index] * smoothing) + (current * (1 - smoothing));
  }

  return current;
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

type CandlestickDetection = {
  pattern: CandlestickPattern;
  bias: PatternDirection;
  strength: number;
  note: string;
};

type CandlestickContext = {
  isAtSupport: boolean;
  isAtResistance: boolean;
};

function closeTo(left: number, right: number, tolerancePct = 0.12) {
  const base = Math.max(Math.abs(left), Math.abs(right), 0.0000001);
  return (Math.abs(left - right) / base) * 100 <= tolerancePct;
}

function candleStats(candle: OhlcCandle) {
  const range = Math.max(candle.h - candle.l, 0.0000001);
  const body = Math.abs(candle.c - candle.o);
  const upperWick = candle.h - Math.max(candle.o, candle.c);
  const lowerWick = Math.min(candle.o, candle.c) - candle.l;
  const mid = (candle.o + candle.c) / 2;

  return {
    range,
    body,
    bodyPct: body / range,
    upperWickPct: upperWick / range,
    lowerWickPct: lowerWick / range,
    bullish: candle.c > candle.o,
    bearish: candle.c < candle.o,
    mid,
    marubozuBullish: candle.c > candle.o && body / range >= 0.85 && upperWick / range <= 0.08 && lowerWick / range <= 0.08,
    marubozuBearish: candle.o > candle.c && body / range >= 0.85 && upperWick / range <= 0.08 && lowerWick / range <= 0.08,
    doji: body / range <= 0.12,
    spinningTop: body / range <= 0.3 && upperWick / range >= 0.25 && lowerWick / range >= 0.25
  };
}

function matchesCandlestickContext(pattern: CandlestickPattern, slope: number, context?: CandlestickContext) {
  if (!context || pattern === "none") {
    return true;
  }

  const supportReversalPatterns: CandlestickPattern[] = [
    "dragonfly-doji", "hammer", "inverted-hammer", "bullish-engulfing", "piercing-line",
    "tweezer-bottom", "bullish-harami", "morning-star", "three-inside-up", "three-outside-up",
    "bullish-abondened-baby", "double-bottom", "doble-bottom"
  ];
  const resistanceReversalPatterns: CandlestickPattern[] = [
    "gravestone-doji", "hanging-man", "bearish-engulfing", "dark-cloud-cover", "tweezer-top",
    "bearish-harami", "three-inside-down", "three-outside-down", "bearish-abondened-baby", "double-top"
  ];

  if (supportReversalPatterns.includes(pattern)) {
    return context.isAtSupport && slope <= 0;
  }

  if (resistanceReversalPatterns.includes(pattern)) {
    return context.isAtResistance && slope >= 0;
  }

  return true;
}

function highest(values: number[]) {
  return values.reduce((max, value) => Math.max(max, value), Number.NEGATIVE_INFINITY);
}

function lowest(values: number[]) {
  return values.reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
}

export function detectCandlestickPattern(candles: OhlcCandle[], slope: number, context?: CandlestickContext): CandlestickDetection {
  const latest = candles[candles.length - 1];
  const previous = candles[candles.length - 2];
  const third = candles[candles.length - 3];
  const fourth = candles[candles.length - 4];

  if (!latest) {
    return {
      pattern: "none",
      bias: "neutral",
      strength: 0,
      note: "No high-conviction candlestick trigger on the latest bar."
    };
  }

  const s1 = candleStats(latest);
  const s2 = previous ? candleStats(previous) : null;
  const s3 = third ? candleStats(third) : null;
  const s4 = fourth ? candleStats(fourth) : null;
  const candidates: CandlestickDetection[] = [];

  const push = (candidate: CandlestickDetection, when = true) => {
    if (when && matchesCandlestickContext(candidate.pattern, slope, context)) {
      candidates.push(candidate);
    }
  };

  const isDragonfly = s1.doji && s1.lowerWickPct >= 0.6 && s1.upperWickPct <= 0.12;
  const isGravestone = s1.doji && s1.upperWickPct >= 0.6 && s1.lowerWickPct <= 0.12;
  const isHammer = s1.bodyPct <= 0.35 && s1.lowerWickPct >= 0.55 && s1.upperWickPct <= 0.22;
  const isInvertedHammer = s1.bodyPct <= 0.35 && s1.upperWickPct >= 0.55 && s1.lowerWickPct <= 0.22;
  const isHangingMan = isHammer && slope > 0;

  push({ pattern: "dragonfly-doji", bias: "up", strength: 4, note: "Dragonfly doji rejects lower prices." }, isDragonfly);
  push({ pattern: "gravestone-doji", bias: "down", strength: 4, note: "Gravestone doji rejects higher prices." }, isGravestone);
  push({ pattern: "doji", bias: "neutral", strength: 2, note: "Doji reflects indecision." }, s1.doji && !isDragonfly && !isGravestone);
  push({ pattern: "hammer", bias: "up", strength: 4, note: "Hammer suggests bullish reversal pressure." }, isHammer && !isHangingMan);
  push({ pattern: "inverted-hammer", bias: "up", strength: 3, note: "Inverted hammer suggests potential upside reversal." }, isInvertedHammer && slope <= 0);
  push({ pattern: "hanging-man", bias: "down", strength: 4, note: "Hanging man warns of bearish reversal risk." }, isHangingMan);
  push({ pattern: "bullish-spinning-top", bias: "up", strength: 2, note: "Bullish spinning top indicates weak upside edge." }, s1.spinningTop && s1.bullish);
  push({ pattern: "bearish-spinning-top", bias: "down", strength: 2, note: "Bearish spinning top indicates weak downside edge." }, s1.spinningTop && s1.bearish);
  push({ pattern: "bullish-marubozu", bias: "up", strength: 4, note: "Bullish marubozu confirms strong buyer control." }, s1.marubozuBullish);

  if (s2) {
    const bullishEngulfing = s2.bearish && s1.bullish && latest.o <= previous.c && latest.c >= previous.o;
    const bearishEngulfing = s2.bullish && s1.bearish && latest.o >= previous.c && latest.c <= previous.o;
    const piercingLine = s2.bearish && s1.bullish && latest.c > (previous.o + previous.c) / 2 && latest.c < previous.o;
    const darkCloudCover = s2.bullish && s1.bearish && latest.c < (previous.o + previous.c) / 2 && latest.c > previous.o;
    const tweezerBottom = closeTo(latest.l, previous.l, 0.15) && s2.bearish && s1.bullish;
    const tweezerTop = closeTo(latest.h, previous.h, 0.15) && s2.bullish && s1.bearish;
    const bullishHarami = s2.bearish && s1.bullish && latest.o >= previous.c && latest.c <= previous.o;
    const bearishHarami = s2.bullish && s1.bearish && latest.o <= previous.c && latest.c >= previous.o;
    const bullishKikker = s2.marubozuBearish && s1.marubozuBullish && latest.o > previous.h;
    const bearishKikker = s2.marubozuBullish && s1.marubozuBearish && latest.o < previous.l;
    const risingWindow = previous.h < latest.l;
    const fallingWindow = previous.l > latest.h;

    push({ pattern: "bullish-engulfing", bias: "up", strength: 5, note: "Bullish engulfing shows strong reversal intent." }, bullishEngulfing);
    push({ pattern: "bearish-engulfing", bias: "down", strength: 5, note: "Bearish engulfing shows strong reversal intent." }, bearishEngulfing);
    push({ pattern: "piercing-line", bias: "up", strength: 4, note: "Piercing line confirms buyers reclaiming ground." }, piercingLine);
    push({ pattern: "dark-cloud-cover", bias: "down", strength: 4, note: "Dark cloud cover signals bearish fade." }, darkCloudCover);
    push({ pattern: "tweezer-bottom", bias: "up", strength: 4, note: "Tweezer bottom marks support rejection." }, tweezerBottom);
    push({ pattern: "tweezer-top", bias: "down", strength: 4, note: "Tweezer top marks resistance rejection." }, tweezerTop);
    push({ pattern: "bullish-harami", bias: "up", strength: 3, note: "Bullish harami indicates base-building reversal." }, bullishHarami);
    push({ pattern: "bearish-harami", bias: "down", strength: 3, note: "Bearish harami indicates topping risk." }, bearishHarami);
    push({ pattern: "bullish-kikker", bias: "up", strength: 5, note: "Bullish kikker reflects abrupt sentiment flip." }, bullishKikker);
    push({ pattern: "bearish-kikker", bias: "down", strength: 5, note: "Bearish kikker reflects abrupt sentiment flip." }, bearishKikker);
    push({ pattern: "rising-window", bias: "up", strength: 4, note: "Rising window gap supports continuation." }, risingWindow);
    push({ pattern: "falling-window", bias: "down", strength: 4, note: "Falling window gap supports continuation." }, fallingWindow);
  }

  if (s2 && s3) {
    const morningStar = s3.bearish && s2.bodyPct <= 0.25 && s1.bullish && latest.c > s3.mid;
    const threeWhiteSoldiers = s3.bullish
      && s2.bullish
      && s1.bullish
      && s3.bodyPct >= 0.5
      && s2.bodyPct >= 0.5
      && s1.bodyPct >= 0.5
      && latest.c > previous.c
      && previous.c > third.c
      && latest.c > latest.o
      && previous.c > previous.o
      && third.c > third.o;
    const threeBlackCrows = s3.bearish
      && s2.bearish
      && s1.bearish
      && s3.bodyPct >= 0.55
      && s2.bodyPct >= 0.55
      && s1.bodyPct >= 0.55
      && s3.upperWickPct <= 0.2
      && s2.upperWickPct <= 0.2
      && s1.upperWickPct <= 0.2
      && s4 !== null
      && s4.bullish
      && fourth.c >= third.o
      && previous.o <= third.o
      && previous.o >= third.c
      && latest.o <= previous.o
      && latest.o >= previous.c
      && latest.c < previous.c
      && previous.c < third.c
      && latest.c < latest.o
      && previous.c < previous.o
      && third.c < third.o;
    const threeInsideUp = s3.bearish && s2.bullish && previous.o <= third.o && previous.c >= third.c && s1.bullish && latest.c > third.o;
    const threeInsideDown = s3.bullish && s2.bearish && previous.o >= third.o && previous.c <= third.c && s1.bearish && latest.c < third.o;
    const threeOutsideUp = s3.bearish && s2.bullish && previous.o <= third.c && previous.c >= third.o && s1.bullish && latest.c > previous.c;
    const threeOutsideDown = s3.bullish && s2.bearish && previous.o >= third.c && previous.c <= third.o && s1.bearish && latest.c < previous.c;

    push({ pattern: "morning-star", bias: "up", strength: 5, note: "Morning star supports bullish reversal." }, morningStar);
    push({ pattern: "three-white-soldiers", bias: "up", strength: 5, note: "Three white soldiers confirm sustained buying." }, threeWhiteSoldiers);
    push({ pattern: "three-black-crows", bias: "down", strength: 5, note: "Three black crows confirm sustained selling." }, threeBlackCrows);
    push({ pattern: "three-inside-up", bias: "up", strength: 4, note: "Three inside up confirms bullish reversal." }, threeInsideUp);
    push({ pattern: "three-inside-down", bias: "down", strength: 4, note: "Three inside down confirms bearish reversal." }, threeInsideDown);
    push({ pattern: "three-outside-up", bias: "up", strength: 4, note: "Three outside up confirms upside momentum." }, threeOutsideUp);
    push({ pattern: "three-outside-down", bias: "down", strength: 4, note: "Three outside down confirms downside momentum." }, threeOutsideDown);

    const bullishAbondenedBaby = s3.bearish && s2.doji && s1.bullish && previous.h < third.l && latest.l > previous.h;
    const bearishAbondenedBaby = s3.bullish && s2.doji && s1.bearish && previous.l > third.h && latest.h < previous.l;
    push({ pattern: "bullish-abondened-baby", bias: "up", strength: 5, note: "Bullish abondened baby signals sharp reversal." }, bullishAbondenedBaby);
    push({ pattern: "bearish-abondened-baby", bias: "down", strength: 5, note: "Bearish abondened baby signals sharp reversal." }, bearishAbondenedBaby);
  }

  if (s2 && s3 && s4) {
    const threeLineStrikeBullish = s4.bearish && s3.bearish && s2.bearish && s1.bullish && latest.c > fourth.o;
    const threeLineStrikeBearish = s4.bullish && s3.bullish && s2.bullish && s1.bearish && latest.c < fourth.o;
    push({ pattern: "three-line-strike", bias: "up", strength: 5, note: "Three line strike points to bullish exhaustion reversal." }, threeLineStrikeBullish);
    push({ pattern: "three-line-strike", bias: "down", strength: 5, note: "Three line strike points to bearish exhaustion reversal." }, threeLineStrikeBearish);
  }

  if (candles.length >= 12) {
    const recent = candles.slice(-12);
    const highs = recent.map((item) => item.h);
    const lows = recent.map((item) => item.l);
    const closes = recent.map((item) => item.c);
    const firstHalf = closes.slice(0, 6);
    const secondHalf = closes.slice(6);
    const firstMove = firstHalf[firstHalf.length - 1] - firstHalf[0];
    const secondRange = highest(secondHalf) - lowest(secondHalf);
    const firstRange = highest(firstHalf) - lowest(firstHalf);
    const flagBullish = firstMove > 0 && secondRange < firstRange * 0.45;
    const flagBearish = firstMove < 0 && secondRange < firstRange * 0.45;
    push({ pattern: "flag", bias: "up", strength: 3, note: "Bullish flag continuation structure detected." }, flagBullish);
    push({ pattern: "flag", bias: "down", strength: 3, note: "Bearish flag continuation structure detected." }, flagBearish);

    const highsFirst = highs.slice(0, 6);
    const highsSecond = highs.slice(6);
    const lowsFirst = lows.slice(0, 6);
    const lowsSecond = lows.slice(6);
    const wedge = (highest(highsSecond) < highest(highsFirst)) && (lowest(lowsSecond) > lowest(lowsFirst));
    const wedgeBias: PatternDirection = slope >= 0 ? "down" : "up";
    push({ pattern: "wedge", bias: wedgeBias, strength: 3, note: "Wedge compression suggests breakout risk opposite mature trend." }, wedge);
  }

  if (candles.length >= 20) {
    const recent = candles.slice(-20);
    const highs = recent.map((item) => item.h);
    const lows = recent.map((item) => item.l);
    const maxHigh = highest(highs);
    const minLow = lowest(lows);
    const lastHigh = highs[highs.length - 1];
    const midHigh = highs[Math.floor(highs.length / 2)];
    const lastLow = lows[lows.length - 1];
    const midLow = lows[Math.floor(lows.length / 2)];

    push(
      { pattern: "double-top", bias: "down", strength: 4, note: "Double top implies resistance has held twice." },
      closeTo(lastHigh, maxHigh, 0.2) && closeTo(midHigh, maxHigh, 0.2)
    );
    push(
      { pattern: "double-bottom", bias: "up", strength: 4, note: "Double bottom implies support has held twice." },
      closeTo(lastLow, minLow, 0.2) && closeTo(midLow, minLow, 0.2)
    );
    push(
      { pattern: "doble-bottom", bias: "up", strength: 4, note: "Doble bottom implies support has held twice." },
      closeTo(lastLow, minLow, 0.2) && closeTo(midLow, minLow, 0.2)
    );
  }

  if (candles.length >= 30) {
    const recent = candles.slice(-30);
    const closes = recent.map((item) => item.c);
    const left = closes.slice(0, 10);
    const middle = closes.slice(10, 22);
    const right = closes.slice(22, 27);
    const handle = closes.slice(27);
    const leftPeak = highest(left);
    const midLow = lowest(middle);
    const rightPeak = highest(right);
    const handleLow = lowest(handle);
    const cup = midLow < leftPeak * 0.98 && closeTo(leftPeak, rightPeak, 0.7);
    const validHandle = handleLow >= rightPeak * 0.97;
    push({ pattern: "cup-and-handle", bias: "up", strength: 4, note: "Cup and handle continuation structure detected." }, cup && validHandle);
  }

  if (candidates.length === 0) {
    return {
      pattern: "none",
      bias: "neutral",
      strength: 0,
      note: "No high-conviction candlestick trigger on the latest bar."
    };
  }

  candidates.sort((left, right) => {
    const leftRank = Math.abs(left.strength) + (left.bias === "neutral" ? 0 : 0.25);
    const rightRank = Math.abs(right.strength) + (right.bias === "neutral" ? 0 : 0.25);
    return rightRank - leftRank;
  });

  return candidates[0];
}

function candlestickImpactAtLevels(
  detection: CandlestickDetection,
  baseDirection: PatternDirection,
  isAtSupport: boolean,
  isAtResistance: boolean
) {
  if (detection.pattern === "none") {
    return { score: 0, note: "Candlestick impact neutral." };
  }

  let score = 0;

  if (detection.bias === "neutral") {
    score = (isAtSupport || isAtResistance) ? -2 : 0;
    return {
      score,
      note: score < 0
        ? "Doji near key level reduces conviction until a breakout or rejection confirms."
        : detection.note
    };
  }

  if (baseDirection === "neutral") {
    score += detection.strength;
  } else if (detection.bias === baseDirection) {
    score += detection.strength;
  } else {
    score -= Math.round(detection.strength * 1.6);
  }

  if (detection.bias === "up") {
    if (isAtSupport) {
      score += 3;
    }
    if (isAtResistance) {
      score -= 3;
    }
  }

  if (detection.bias === "down") {
    if (isAtResistance) {
      score += 3;
    }
    if (isAtSupport) {
      score -= 3;
    }
  }

  return {
    score,
    note: `${detection.note} Support/Resistance context impact: ${score >= 0 ? "+" : ""}${score}.`
  };
}

function volumeConfirmationImpact(
  candles: OhlcCandle[],
  pattern: PatternKind,
  direction: PatternDirection,
  nearSupport: boolean,
  nearResistance: boolean
): { score: number; note: string; ratio: number | null; confirmation: "strong" | "weak" | "neutral" | "unavailable" } {
  const buildRangeProxy = (): { score: number; note: string; ratio: number | null; confirmation: "strong" | "weak" | "neutral" | "unavailable" } => {
    const proxyWindow = Math.min(30, candles.length);
    if (proxyWindow < 14) {
      return {
        score: 0,
        note: "Volume confirmation unavailable for this market/timeframe; confidence kept unchanged.",
        ratio: null,
        confirmation: "unavailable"
      };
    }

    const sample = candles.slice(-proxyWindow);
    const recentSegment = sample.slice(-5);
    const baselineSegment = sample.slice(0, Math.max(8, sample.length - 5));
    const recentAvgRange = recentSegment.reduce((sum, candle) => sum + (candle.h - candle.l), 0) / Math.max(1, recentSegment.length);
    const baselineAvgRange = baselineSegment.reduce((sum, candle) => sum + (candle.h - candle.l), 0) / Math.max(1, baselineSegment.length);

    if (!Number.isFinite(recentAvgRange) || !Number.isFinite(baselineAvgRange) || baselineAvgRange <= 0) {
      return {
        score: 0,
        note: "Volume confirmation unavailable for this market/timeframe; confidence kept unchanged.",
        ratio: null,
        confirmation: "unavailable"
      };
    }

    const ratio = recentAvgRange / baselineAvgRange;
    const breakoutSetup = pattern === "breakout" || (direction === "up" && nearResistance) || (direction === "down" && nearSupport);
    const scoreScale = breakoutSetup ? 1.3 : 1.0;
    let score = 0;

    if (ratio >= 1.6) {
      score = Math.round(4 * scoreScale);
    } else if (ratio >= 1.25) {
      score = Math.round(2 * scoreScale);
    } else if (ratio <= 0.7) {
      score = Math.round(-3 * scoreScale);
    } else if (ratio <= 0.85) {
      score = Math.round(-2 * scoreScale);
    }

    const roundedRatio = Number(ratio.toFixed(2));
    if (score > 0) {
      return {
        score,
        note: `Tick volume unavailable; using range participation proxy (${roundedRatio}x vs baseline) showing strong confirmation.`,
        ratio: roundedRatio,
        confirmation: "strong"
      };
    }

    if (score < 0) {
      return {
        score,
        note: `Tick volume unavailable; using range participation proxy (${roundedRatio}x vs baseline) showing weak confirmation.`,
        ratio: roundedRatio,
        confirmation: "weak"
      };
    }

    return {
      score: 0,
      note: `Tick volume unavailable; using range participation proxy (${roundedRatio}x vs baseline), neutral impact.`,
      ratio: roundedRatio,
      confirmation: "neutral"
    };
  };

  const anchorIndex = (() => {
    for (let index = candles.length - 1; index >= Math.max(0, candles.length - 20); index -= 1) {
      const value = Number(candles[index]?.v || 0);
      if (Number.isFinite(value) && value > 0) {
        return index;
      }
    }
    return -1;
  })();

  if (anchorIndex < 0) {
    return buildRangeProxy();
  }

  const latestVolume = Number(candles[anchorIndex]?.v || 0);
  const priorVolumes = candles
    .slice(Math.max(0, anchorIndex - 20), anchorIndex)
    .map((candle) => Number(candle.v || 0))
    .filter((value) => value > 0);

  if (!Number.isFinite(latestVolume) || latestVolume <= 0 || priorVolumes.length < 8) {
    return buildRangeProxy();
  }

  const avgVolume = priorVolumes.reduce((sum, value) => sum + value, 0) / priorVolumes.length;
  if (!Number.isFinite(avgVolume) || avgVolume <= 0) {
    return buildRangeProxy();
  }

  const ratio = latestVolume / avgVolume;
  const breakoutSetup = pattern === "breakout" || (direction === "up" && nearResistance) || (direction === "down" && nearSupport);
  const scoreScale = breakoutSetup ? 1.8 : 1.0;
  let score = 0;

  if (ratio >= 1.8) {
    score = Math.round(5 * scoreScale);
  } else if (ratio >= 1.35) {
    score = Math.round(3 * scoreScale);
  } else if (ratio <= 0.65) {
    score = Math.round(-4 * scoreScale);
  } else if (ratio <= 0.85) {
    score = Math.round(-2 * scoreScale);
  }

  const roundedRatio = Number(ratio.toFixed(2));
  if (score > 0) {
    return {
      score,
      note: `Volume confirmation strong (${roundedRatio}x vs 20-bar average), supporting signal quality.`,
      ratio: roundedRatio,
      confirmation: "strong"
    };
  }

  if (score < 0) {
    return {
      score,
      note: `Volume confirmation weak (${roundedRatio}x vs 20-bar average), lowering breakout conviction.`,
      ratio: roundedRatio,
      confirmation: "weak"
    };
  }

  return {
    score: 0,
    note: `Volume near baseline (${roundedRatio}x vs 20-bar average), neutral confidence impact.`,
    ratio: roundedRatio,
    confirmation: "neutral"
  };
}

function historicalRecurrenceImpact(
  candles: OhlcCandle[],
  direction: PatternDirection,
  pattern: PatternKind,
  isAtSupport: boolean,
  isAtResistance: boolean
): { score: number; summary: string } {
  if (candles.length < 24 || direction === "neutral") {
    return { score: 0, summary: "Historical recurrence unavailable; too few bars for prior context." };
  }

  const lookbackWindow = Math.min(candles.length - 1, 40);
  const recent = candles.slice(-lookbackWindow);
  let similarCases = 0;
  let alignedFollowThrough = 0;
  let oppositeFollowThrough = 0;

  for (let index = 10; index < recent.length - 2; index += 1) {
    const window = recent.slice(Math.max(0, index - 9), index + 1);
    const windowHigh = Math.max(...window.map((candle) => candle.h));
    const windowLow = Math.min(...window.map((candle) => candle.l));
    const windowTrend = window[window.length - 1].c >= window[0].c ? "up" : "down";
    const currentCandles = recent.slice(index + 1, Math.min(recent.length, index + 5));
    if (currentCandles.length === 0) {
      continue;
    }

    const sessionLow = Math.min(...window.map((candle) => candle.l));
    const sessionHigh = Math.max(...window.map((candle) => candle.h));
    const bar = recent[index];
    const similarZone = (
      (isAtSupport && bar.l <= sessionLow * 1.012) ||
      (isAtResistance && bar.h >= sessionHigh * 0.988) ||
      (bar.c <= windowLow * 1.012 && direction === "up") ||
      (bar.c >= windowHigh * 0.988 && direction === "down")
    );

    if (!similarZone || pattern === "range") {
      continue;
    }

    const nextClose = currentCandles[currentCandles.length - 1].c;
    const followThrough = nextClose >= bar.c ? "up" : "down";
    similarCases += 1;

    if ((direction === "up" && followThrough === "up") || (direction === "down" && followThrough === "down")) {
      alignedFollowThrough += 1;
    } else {
      oppositeFollowThrough += 1;
    }
  }

  if (similarCases === 0) {
    return { score: 0, summary: "Historical recurrence unavailable; no comparable S/R setups found." };
  }

  const winRate = alignedFollowThrough / similarCases;
  let score = 0;
  if (similarCases >= 3) {
    score = Math.round((winRate - 0.5) * 10);
  }

  if (score > 0) {
    return {
      score: Math.min(score, 6),
      summary: `Historical recurrence: ${similarCases} comparable ${pattern} setups near the same zone, ${alignedFollowThrough} followed the current direction and ${oppositeFollowThrough} did not.`
    };
  }

  if (score < 0) {
    return {
      score: Math.max(score, -6),
      summary: `Historical recurrence: ${similarCases} comparable ${pattern} setups near the same zone, ${oppositeFollowThrough} followed the opposite direction and only ${alignedFollowThrough} matched.`
    };
  }

  return {
    score: 0,
    summary: `Historical recurrence: ${similarCases} comparable ${pattern} setups near the same zone with mixed directional outcomes.`
  };
}

function trendStructureImpact(
  candles: OhlcCandle[],
  closes: number[],
  direction: PatternDirection,
  pattern: PatternKind
): { score: number; note: string } {
  if (candles.length < 12 || closes.length < 12) {
    return {
      score: 0,
      note: "Trend structure confirmation unavailable; confidence kept unchanged."
    };
  }

  const latestClose = closes[closes.length - 1];
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const sma200 = sma(closes, 200);

  const structureWindow = Math.min(20, candles.length);
  const split = Math.floor(structureWindow / 2);
  const earlier = candles.slice(-structureWindow, -split);
  const recent = candles.slice(-split);
  if (earlier.length < 4 || recent.length < 4) {
    return {
      score: 0,
      note: "Trend structure confirmation unavailable; confidence kept unchanged."
    };
  }

  const earlierHigh = Math.max(...earlier.map((candle) => candle.h));
  const earlierLow = Math.min(...earlier.map((candle) => candle.l));
  const recentHigh = Math.max(...recent.map((candle) => candle.h));
  const recentLow = Math.min(...recent.map((candle) => candle.l));

  const higherHigh = recentHigh > earlierHigh;
  const higherLow = recentLow > earlierLow;
  const lowerHigh = recentHigh < earlierHigh;
  const lowerLow = recentLow < earlierLow;

  const bullStack = latestClose >= ema20 && ema20 >= ema50 && ema50 >= ema200 && latestClose >= sma200;
  const bearStack = latestClose <= ema20 && ema20 <= ema50 && ema50 <= ema200 && latestClose <= sma200;

  let score = 0;
  if (direction === "up") {
    score += bullStack ? 4 : -3;
    if (higherHigh && higherLow) {
      score += 4;
    } else if (lowerHigh && lowerLow) {
      score -= 4;
    }
  } else if (direction === "down") {
    score += bearStack ? 4 : -3;
    if (lowerHigh && lowerLow) {
      score += 4;
    } else if (higherHigh && higherLow) {
      score -= 4;
    }
  } else {
    if ((bullStack && higherHigh && higherLow) || (bearStack && lowerHigh && lowerLow)) {
      score += 2;
    }
  }

  if (pattern === "breakout") {
    if (score > 0) {
      score += 2;
    } else if (score < 0) {
      score -= 2;
    }
  }

  score = jsonStep(score, -10, 10);
  const structure = higherHigh && higherLow
    ? "HH/HL"
    : lowerHigh && lowerLow
      ? "LH/LL"
      : "mixed";
  const stack = bullStack ? "bullish" : bearStack ? "bearish" : "mixed";

  return {
    score,
    note: `Trend structure (EMA20/50/200 + SMA200 ${stack}, ${structure}) impact: ${score >= 0 ? "+" : ""}${score}.`
  };
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
      candlestickPattern: "none",
      candlestickBias: "neutral",
      candlestickImpactScore: 0,
      volumeRatio: null,
      volumeImpactScore: 0,
      trendImpactScore: 0,
      volumeConfirmation: "unavailable",
      isAtSupport: false,
      isAtResistance: false,
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
  const atSupport = latest.c <= support * 1.012;
  const atResistance = latest.c >= resistance * 0.988;
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

  const candlestick = detectCandlestickPattern(recentCandles, slope, {
    isAtSupport: atSupport,
    isAtResistance: atResistance
  });
  const candlestickImpact = candlestickImpactAtLevels(candlestick, direction, atSupport, atResistance);
  const volumeImpact = volumeConfirmationImpact(recentCandles, pattern, direction, nearSupport, nearResistance);
  const trendImpact = trendStructureImpact(recentCandles, recentCloses, direction, pattern);
  const recurrenceImpact = historicalRecurrenceImpact(recentCandles, direction, pattern, atSupport, atResistance);

  confidence = jsonStep(confidence + candlestickImpact.score + volumeImpact.score + trendImpact.score, 45, 94);
  if (direction === "neutral" && candlestick.bias !== "neutral" && candlestickImpact.score >= 5) {
    direction = candlestick.bias;
    pattern = "reversal";
  }

  const candlestickContext = candlestick.pattern === "none"
    ? "Candlestick filter: none"
    : `Candlestick filter: ${candlestick.pattern} (${candlestick.bias})`;
  note = `${note} ${candlestickContext}. ${candlestickImpact.note} ${volumeImpact.note} ${trendImpact.note} ${recurrenceImpact.summary}`;

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
    candlestickPattern: candlestick.pattern,
    candlestickBias: candlestick.bias,
    candlestickImpactScore: candlestickImpact.score,
    volumeRatio: volumeImpact.ratio,
    volumeImpactScore: volumeImpact.score,
    trendImpactScore: trendImpact.score,
    historicalRecurrenceScore: recurrenceImpact.score,
    historicalRecurrenceSummary: recurrenceImpact.summary,
    volumeConfirmation: volumeImpact.confirmation,
    isAtSupport: atSupport,
    isAtResistance: atResistance,
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
