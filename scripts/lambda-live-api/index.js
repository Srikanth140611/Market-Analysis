const RSS_FEEDS = [
  "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  "https://finance.yahoo.com/news/rssindex"
];

const STRICT_LIVE_MODE = true;
const MT4_SNAPSHOT_API_KEY = process.env.MT4_SNAPSHOT_API_KEY || "";
const MT4_SNAPSHOT_TABLE = process.env.MT4_SNAPSHOT_TABLE || "";
const MT4_SNAPSHOT_PK_NAME = process.env.MT4_SNAPSHOT_PK_NAME || "snapshotKey";
const MT4_SNAPSHOT_KEY = process.env.MT4_SNAPSHOT_KEY || "latest";
let dynamoClient = null;
let DynamoGetCommand = null;
let DynamoPutCommand = null;
const FOREX_MONITORING_TRADES_PK = "forex-monitoring-trades";
const FOREX_MONITORING_TRADES_SK = "ledger";
const forexTradeLedger = new Map();

if (MT4_SNAPSHOT_TABLE) {
  try {
    const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
    const { DynamoDBDocumentClient, GetCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
    dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: {
        removeUndefinedValues: true
      }
    });
    DynamoGetCommand = GetCommand;
    DynamoPutCommand = PutCommand;
  } catch {
    // Keep Lambda functional even if dependencies are not bundled.
    dynamoClient = null;
  }
}

const HISTORY_SYMBOLS = {
  "AUD/USD": { symbol: "AUD/USD", name: "Australian Dollar vs US Dollar", category: "forex", yahooCode: "AUDUSD=X" },
  "EUR/USD": { symbol: "EUR/USD", name: "Euro vs US Dollar", category: "forex", yahooCode: "EURUSD=X" },
  "GBP/USD": { symbol: "GBP/USD", name: "British Pound vs US Dollar", category: "forex", yahooCode: "GBPUSD=X" },
  "AUD/JPY": { symbol: "AUD/JPY", name: "Australian Dollar vs Japanese Yen", category: "forex", yahooCode: "AUDJPY=X" },
  "EUR/AUD": { symbol: "EUR/AUD", name: "Euro vs Australian Dollar", category: "forex", yahooCode: "EURAUD=X" },
  "GBP/AUD": { symbol: "GBP/AUD", name: "British Pound vs Australian Dollar", category: "forex", yahooCode: "GBPAUD=X" },
  "AUD/NZD": { symbol: "AUD/NZD", name: "Australian Dollar vs New Zealand Dollar", category: "forex", yahooCode: "AUDNZD=X" },
  "EUR/NZD": { symbol: "EUR/NZD", name: "Euro vs New Zealand Dollar", category: "forex", yahooCode: "EURNZD=X" },
  "EUR/GBP": { symbol: "EUR/GBP", name: "Euro vs British Pound", category: "forex", yahooCode: "EURGBP=X" },
  "CAD/JPY": { symbol: "CAD/JPY", name: "Canadian Dollar vs Japanese Yen", category: "forex", yahooCode: "CADJPY=X" },
  "USD/CAD": { symbol: "USD/CAD", name: "US Dollar vs Canadian Dollar", category: "forex", yahooCode: "CAD=X" },
  "USD/CHF": { symbol: "USD/CHF", name: "US Dollar vs Swiss Franc", category: "forex", yahooCode: "CHF=X" },
  "GBP/NZD": { symbol: "GBP/NZD", name: "British Pound vs New Zealand Dollar", category: "forex", yahooCode: "GBPNZD=X" },
  "NZD/JPY": { symbol: "NZD/JPY", name: "New Zealand Dollar vs Japanese Yen", category: "forex", yahooCode: "NZDJPY=X" },
  "AUD/CHF": { symbol: "AUD/CHF", name: "Australian Dollar vs Swiss Franc", category: "forex", yahooCode: "AUDCHF=X" },
  "EUR/CAD": { symbol: "EUR/CAD", name: "Euro vs Canadian Dollar", category: "forex", yahooCode: "EURCAD=X" },
  "USD/JPY": { symbol: "USD/JPY", name: "US Dollar vs Japanese Yen", category: "forex", yahooCode: "JPY=X" },
  "EUR/JPY": { symbol: "EUR/JPY", name: "Euro vs Japanese Yen", category: "forex", yahooCode: "EURJPY=X" },
  "XAU/USD": { symbol: "XAU/USD", name: "Gold Spot", category: "commodity", yahooCode: "GC=F" },
  "XAG/USD": { symbol: "XAG/USD", name: "Silver Spot", category: "commodity", yahooCode: "SI=F" },
  BRENT: { symbol: "BRENT", name: "Crude Oil Brent", category: "oil", yahooCode: "BZ=F" },
  WTI: { symbol: "WTI", name: "Crude Oil WTI", category: "oil", yahooCode: "CL=F" }
};

const HISTORY_TIMEFRAMES = ["1hour", "4hour", "12hour", "1Day", "1Week"];
const DEFAULT_REFERENCE_PRICES = {
  "AUD/USD": 0.66,
  "EUR/USD": 1.09,
  "GBP/USD": 1.28,
  "AUD/JPY": 98.2,
  "EUR/AUD": 1.64,
  "GBP/AUD": 1.92,
  "AUD/NZD": 1.08,
  "EUR/NZD": 1.77,
  "EUR/GBP": 0.85,
  "CAD/JPY": 115.2,
  "USD/CAD": 1.36,
  "USD/CHF": 0.88,
  "GBP/NZD": 2.08,
  "NZD/JPY": 91.0,
  "AUD/CHF": 0.58,
  "EUR/CAD": 1.48,
  "USD/JPY": 156.41,
  "EUR/JPY": 170.3,
  "XAU/USD": 2398.12,
  "XAG/USD": 31.14,
  BRENT: 82.1,
  WTI: 78.32
};

function isFiniteNumberArray(values) {
  return Array.isArray(values) && values.every((value) => Number.isFinite(value));
}

function jsonStep(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toUtcDayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function aggregateCandles(candles, bucket) {
  if (bucket <= 1 || candles.length === 0) {
    return candles;
  }

  const output = [];
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

function compressCandles(candles, targetCount) {
  if (candles.length <= targetCount) {
    return candles;
  }

  const step = candles.length / targetCount;
  const output = [];
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

function timeframeToTargetCount(timeframe) {
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

function timeframeLabel(timeframe) {
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

function toCandleSeries(payload) {
  const timestamps = isFiniteNumberArray(payload.timestamp) ? payload.timestamp : [];
  const opens = isFiniteNumberArray(payload.open) ? payload.open : [];
  const highs = isFiniteNumberArray(payload.high) ? payload.high : [];
  const lows = isFiniteNumberArray(payload.low) ? payload.low : [];
  const closes = isFiniteNumberArray(payload.close) ? payload.close : [];
  const length = Math.min(timestamps.length, closes.length);

  const candles = [];
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

    candles.push({ t: timestamp, o: open, h: high, l: low, c: close });
  }

  return candles;
}

async function fetchYahooHistory(symbol) {
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

async function fetchYahooForexSpotPrice(symbol) {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json,text/plain,*/*",
      Referer: "https://finance.yahoo.com/"
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(closes)) {
    return null;
  }

  for (let index = closes.length - 1; index >= 0; index -= 1) {
    const value = Number(closes[index]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function sma(values, period) {
  if (values.length === 0) {
    return 0;
  }

  const slice = values.slice(-Math.min(period, values.length));
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

function rsi(values, period) {
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

function classifyPattern(meta, timeframe, candles, source) {
  const recentCandles = candles.slice(-50);
  const recentCloses = recentCandles.map((candle) => candle.c);

  if (recentCandles.length === 0) {
    return {
      symbol: meta.symbol,
      name: meta.name,
      category: meta.category,
      timeframe,
      pattern: "range",
      direction: "neutral",
      confidence: 0,
      support: 0,
      resistance: 0,
      latestClose: 0,
      sampleSize: 0,
      source,
      note: `No history available for ${meta.symbol} on ${timeframeLabel(timeframe)}`
    };
  }

  const latest = recentCandles[recentCandles.length - 1];
  const support = Math.min(...recentCandles.map((candle) => candle.l));
  const resistance = Math.max(...recentCandles.map((candle) => candle.h));
  const ma20 = sma(recentCloses, 20);
  const ma50 = sma(recentCloses, 50);
  const rsi14 = rsi(recentCloses, 14);
  const slopeWindow = Math.min(10, recentCloses.length - 1);
  const slopeBase = recentCloses[recentCloses.length - 1 - slopeWindow] || recentCloses[0];
  const slope = slopeBase > 0 ? ((latest.c - slopeBase) / slopeBase) * 100 : 0;
  const rangePercent = latest.c > 0 ? ((resistance - support) / latest.c) * 100 : 0;
  const avgRange = recentCandles.reduce((sum, candle) => sum + (candle.h - candle.l), 0) / recentCandles.length;
  const avgRangePercent = latest.c > 0 ? (avgRange / latest.c) * 100 : 0;

  let pattern = "momentum";
  let direction = latest.c >= ma20 ? "up" : "down";
  let confidence = 58;
  let note = `${meta.symbol} is showing balanced price discovery on the ${timeframeLabel(timeframe)} chart.`;

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
    note = `${meta.symbol} is in compressed price action; a volatility expansion is likely.`;
  } else if (nearResistance && slope > 0) {
    pattern = "breakout";
    direction = "up";
    confidence = 74;
    note = `${meta.symbol} is pressing into resistance and may be breaking higher.`;
  } else if (nearSupport && slope < 0) {
    pattern = "breakout";
    direction = "down";
    confidence = 74;
    note = `${meta.symbol} is testing support and may be breaking lower.`;
  } else if (reversalUp) {
    pattern = "reversal";
    direction = "up";
    confidence = 71;
    note = `${meta.symbol} is oversold and turning higher on the ${timeframeLabel(timeframe)} chart.`;
  } else if (reversalDown) {
    pattern = "reversal";
    direction = "down";
    confidence = 71;
    note = `${meta.symbol} is overbought and turning lower on the ${timeframeLabel(timeframe)} chart.`;
  } else if (trendUp) {
    pattern = "trend";
    direction = "up";
    confidence = jsonStep(68 + Math.round(Math.abs(slope) * 1.5), 60, 88);
    note = `${meta.symbol} is in an uptrend with price holding above the short and medium moving averages.`;
  } else if (trendDown) {
    pattern = "trend";
    direction = "down";
    confidence = jsonStep(68 + Math.round(Math.abs(slope) * 1.5), 60, 88);
    note = `${meta.symbol} is in a downtrend with price staying below the short and medium moving averages.`;
  } else if (rangePercent < 4.5) {
    pattern = "range";
    direction = "neutral";
    confidence = 66;
    note = `${meta.symbol} is trading in a range on the ${timeframeLabel(timeframe)} chart.`;
  } else {
    pattern = "momentum";
    direction = slope >= 0 ? "up" : "down";
    confidence = jsonStep(60 + Math.round(Math.abs(slope) * 1.2), 55, 82);
    note = `${meta.symbol} is showing directional momentum on the ${timeframeLabel(timeframe)} chart.`;
  }

  return {
    symbol: meta.symbol,
    name: meta.name,
    category: meta.category,
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

async function getLiveHistory(symbols, timeframes, years = 5) {
  const uniqueSymbols = Array.from(new Set(symbols)).filter((symbol) => Boolean(HISTORY_SYMBOLS[symbol]));
  const uniqueTimeframes = Array.from(new Set(timeframes)).filter((timeframe) => HISTORY_TIMEFRAMES.includes(timeframe));

  if (uniqueSymbols.length === 0 || uniqueTimeframes.length === 0) {
    return {
      data: {},
      patterns: [],
      source: "fallback",
      reason: "No supported market history requested",
      years,
      timeframes: uniqueTimeframes
    };
  }

  const referencePrices = await getReferencePriceMap();
  const data = {};
  const patterns = [];
  const sources = new Set();

  const historiesBySymbol = new Map(
    await Promise.all(uniqueSymbols.map(async (symbol) => {
      const meta = HISTORY_SYMBOLS[symbol];
      const liveSpotPrice = meta.category === "forex" ? await fetchYahooForexSpotPrice(meta.yahooCode) : null;
      const liveDailyCandles = await fetchYahooHistory(meta.yahooCode);

      const referencePrice = Number(liveSpotPrice || referencePrices.get(meta.symbol) || DEFAULT_REFERENCE_PRICES[meta.symbol] || 0);
      const baseDailyCandles = liveDailyCandles.length > 0
        ? liveDailyCandles
        : buildSyntheticDailyHistory(meta, years, referencePrice > 0 ? referencePrice : 1);

      return [symbol, { meta, liveDailyCandles, baseDailyCandles, liveSpotPrice }];
    }))
  );

  for (const symbol of uniqueSymbols) {
    const symbolHistory = historiesBySymbol.get(symbol);
    if (!symbolHistory) {
      continue;
    }

    const { meta, liveDailyCandles, baseDailyCandles, liveSpotPrice } = symbolHistory;
    data[symbol] = {};

    for (const timeframe of uniqueTimeframes) {
      let frameCandles = baseDailyCandles;
      let source = "live";
      let note = `Live Yahoo daily history for ${symbol}`;

      if (timeframe === "1Week") {
        frameCandles = aggregateCandles(frameCandles, 5);
        note = `Derived weekly history from Yahoo daily closes for ${symbol}`;
      } else if (timeframe === "12hour") {
        frameCandles = aggregateCandles(frameCandles, 2);
        note = `Derived 12-hour history from Yahoo daily closes for ${symbol}`;
      } else if (timeframe !== "1Day") {
        note = `${symbol} does not expose public ${timeframeLabel(timeframe)} history here; using derived bars from live daily history`;
      }

      if (meta.category === "forex" && Number.isFinite(liveSpotPrice) && liveSpotPrice > 0) {
        frameCandles = overlayLiveSpotOnCandles(frameCandles, liveSpotPrice);
      }

      frameCandles = compressCandles(frameCandles, timeframeToTargetCount(timeframe));

      data[symbol][timeframe] = {
        candles: frameCandles,
        source,
        note
      };
      sources.add(source);
      patterns.push(classifyPattern(meta, timeframe, frameCandles, source));
    }
  }

  const source = sources.size === 1 ? Array.from(sources)[0] : sources.size > 1 ? "mixed" : "fallback";

  return {
    data,
    patterns,
    source,
    reason:
      source === "mixed"
        ? "Historical data derived from public daily market feeds and live reference prices"
        : source === "live"
          ? "Historical data sourced live from public market feeds"
          : source === "derived"
            ? "Historical data derived from live reference prices"
            : "Historical market data unavailable",
    years,
    timeframes: uniqueTimeframes
  };
}

const AGENT_CONFIG = [
  {
    agent: "Forex",
    category: "forex",
    symbols: [
      "AUD/USD",
      "USD/JPY",
      "EUR/USD",
      "GBP/USD",
      "AUD/JPY",
      "EUR/AUD",
      "GBP/AUD",
      "AUD/NZD",
      "EUR/NZD",
      "EUR/GBP",
      "CAD/JPY",
      "USD/CAD",
      "USD/CHF",
      "GBP/NZD",
      "NZD/JPY",
      "AUD/CHF",
      "EUR/CAD",
      "EUR/JPY"
    ],
    summaryPrefix: "Forex agent tracks major FX pairs across intraday to weekly cycles."
  },
  {
    agent: "Commodities",
    category: "commodity",
    symbols: ["XAU/USD", "XAG/USD"],
    summaryPrefix: "Commodity agent tracks metals momentum, mean reversion, and breakout pressure."
  },
  {
    agent: "Oil",
    category: "oil",
    symbols: ["BRENT", "WTI"],
    summaryPrefix: "Oil agent tracks crude spread behavior, inventory sensitivity, and trend continuation."
  }
];

const ANALYSIS_TIMEFRAMES = ["1hour", "4hour", "12hour", "1Day", "1Week"];

const TIMEFRAME_WEIGHTS = {
  "1hour": 5,
  "4hour": 4,
  "12hour": 3,
  "1Day": 2,
  "1Week": 1
};

function roundTo(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function resolveForexRewardMultiplier(timeframe, pattern, confidence) {
  const patternBase = (() => {
    switch (pattern) {
      case "breakout":
        return 3.5;
      case "trend":
        return 3.0;
      case "momentum":
        return 2.8;
      case "compression":
        return 2.5;
      case "reversal":
        return 2.3;
      case "range":
      default:
        return 2.0;
    }
  })();

  const confidenceBonus = confidence >= 80 ? 1.0 : confidence >= 70 ? 0.6 : confidence >= 60 ? 0.3 : 0;
  const timeframeBonus = {
    "1hour": 0,
    "4hour": 0.2,
    "12hour": 0.5,
    "1Day": 0.9,
    "1Week": 1.3
  };

  return Math.max(2, Math.min(5, patternBase + confidenceBonus + (timeframeBonus[timeframe] || 0)));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ema(values, period) {
  if (values.length === 0) {
    return 0;
  }

  const multiplier = 2 / (period + 1);
  let current = values[0];
  for (let index = 1; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
  }

  return current;
}

function sma(values, period) {
  if (values.length === 0) {
    return 0;
  }

  const slice = values.slice(-Math.min(period, values.length));
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

function standardDeviation(values) {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function buildMacd(values) {
  if (values.length === 0) {
    return { macdLine: 0, macdSignal: 0, macdHistogram: 0 };
  }

  const macdSeries = values.map((_, index) => {
    const slice = values.slice(0, index + 1);
    return ema(slice, 12) - ema(slice, 26);
  });
  const macdLine = macdSeries[macdSeries.length - 1] ?? 0;
  const macdSignal = ema(macdSeries, 9);

  return {
    macdLine,
    macdSignal,
    macdHistogram: macdLine - macdSignal
  };
}

function strategiesForPattern(pattern, direction, category, symbol) {
  const baseStrategies = (() => {
    switch (pattern) {
      case "breakout":
        return direction === "up"
          ? ["Breakout above resistance", "Wait for close confirmation", "Trail below higher lows"]
          : direction === "down"
            ? ["Breakdown below support", "Sell on failed retest", "Trail above lower highs"]
            : ["Breakout watchlist", "Wait for directional close", "Use confirmation candle"];
      case "reversal":
        return direction === "up"
          ? ["RSI mean reversion", "Buy oversold bounce", "Scale in after reclaim"]
          : direction === "down"
            ? ["RSI mean reversion", "Sell overbought fade", "Reduce into pullbacks"]
            : ["Reversal watchlist", "Look for rejection candle", "Wait for pivot confirmation"];
      case "compression":
        return ["Volatility expansion setup", "Use tight invalidation", "Enter on range break"];
      case "range":
        return direction === "up"
          ? ["Range rotation toward upper band", "Partial profit at resistance", "Protect below range floor"]
          : direction === "down"
            ? ["Range rotation toward lower band", "Fade overextension", "Protect above range ceiling"]
            : ["Range trade only", "Wait for boundary test", "Avoid chasing the middle"];
      case "trend":
        return direction === "up"
          ? ["MA alignment", "Buy pullbacks to support", "Trail with higher lows"]
          : ["MA alignment", "Sell rallies into resistance", "Trail with lower highs"];
      case "momentum":
      default:
        return direction === "up"
          ? ["Momentum continuation", "Enter on pullback confirmation", "Trail with tight stop"]
          : ["Momentum continuation", "Enter on failed bounce", "Trail above short swing high"];
    }
  })();

  if (category !== "forex") {
    return baseStrategies;
  }

  const forexLayer = symbol === "USD/JPY"
    ? ["Track US-Japan yield spread", "Respect intervention headline risk"]
    : symbol === "GBP/USD"
      ? ["Watch BoE repricing and UK data surprise", "Fade weak follow-through around London fix"]
      : ["Track ECB-Fed rate spread", "Confirm with DXY and Treasury yield direction"];

  return [...baseStrategies, ...forexLayer];
}

function buildTechnicalAnalysis(symbol, timeframe, candles, support, resistance) {
  const closes = candles.map((candle) => candle.c);
  const recentCloses = closes.slice(-20);
  const currentPrice = closes[closes.length - 1] ?? 0;
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const sma50 = sma(closes, 50);
  const bollingerMiddle = sma(recentCloses, Math.max(1, Math.min(20, recentCloses.length)));
  const bollingerDeviation = standardDeviation(recentCloses);
  const bollingerUpper = bollingerMiddle + bollingerDeviation * 2;
  const bollingerLower = bollingerMiddle - bollingerDeviation * 2;
  const bollingerWidthPercent = currentPrice > 0 ? ((bollingerUpper - bollingerLower) / currentPrice) * 100 : 0;
  const { macdLine, macdSignal, macdHistogram } = buildMacd(closes);
  const ranges = candles.slice(-20).map((candle) => candle.h - candle.l);
  const averageRange = ranges.reduce((sum, value) => sum + value, 0) / Math.max(1, ranges.length);
  const volatilityPercent = currentPrice > 0 ? (averageRange / currentPrice) * 100 : 0;
  const trendStrength = currentPrice > 0 ? clamp((Math.abs(ema20 - ema50) / currentPrice) * 1000, 0, 100) : 0;
  const bollingerState = currentPrice >= bollingerUpper
    ? "trading at the upper Bollinger band"
    : currentPrice <= bollingerLower
      ? "probing the lower Bollinger band"
      : "trading inside the Bollinger channel";
  const macdState = macdHistogram >= 0 ? "MACD momentum is positive" : "MACD momentum is negative";

  return {
    ema20: roundTo(ema20),
    ema50: roundTo(ema50),
    sma50: roundTo(sma50),
    bollingerUpper: roundTo(bollingerUpper),
    bollingerMiddle: roundTo(bollingerMiddle),
    bollingerLower: roundTo(bollingerLower),
    bollingerWidthPercent: roundTo(bollingerWidthPercent, 2),
    macdLine: roundTo(macdLine, 4),
    macdSignal: roundTo(macdSignal, 4),
    macdHistogram: roundTo(macdHistogram, 4),
    support: roundTo(support),
    resistance: roundTo(resistance),
    volatilityPercent: roundTo(volatilityPercent, 2),
    trendStrength: roundTo(trendStrength, 2),
    summary: `${symbol} ${timeframe} technicals: EMA20 ${roundTo(ema20)}, EMA50 ${roundTo(ema50)}, SMA50 ${roundTo(sma50)}, ${bollingerState}, ${macdState}.`
  };
}

function buildFundamentalAnalysis(category, symbol, direction) {
  const bullish = direction === "up";
  const bearish = direction === "down";

  if (category === "forex") {
    const pairProfiles = {
      "EUR/USD": {
        drivers: ["ECB vs Fed rate path", "Eurozone growth surprise", "US real-yield direction"],
        risks: ["US data re-acceleration", "ECB dovish repricing", "risk-off USD demand"],
        bullishSummary: "EUR/USD bullish bias is stronger when ECB pricing stays firm and US real yields ease.",
        bearishSummary: "EUR/USD bearish bias is stronger when the Fed reprices higher-for-longer and USD safe-haven demand returns."
      },
      "GBP/USD": {
        drivers: ["BoE inflation response", "UK wage persistence", "broad USD direction"],
        risks: ["UK growth slowdown", "BoE dovish pivot", "global risk aversion"],
        bullishSummary: "GBP/USD upside improves when UK inflation stays sticky enough to keep BoE pricing firm.",
        bearishSummary: "GBP/USD downside deepens when UK growth softens and the dollar regains macro leadership."
      },
      "USD/JPY": {
        drivers: ["US-Japan rate differential", "Treasury yield trend", "BoJ normalization signals"],
        risks: ["FX intervention risk", "BoJ tightening surprise", "bond-yield reversal"],
        bullishSummary: "USD/JPY upside holds while US yields outrun Japan and BoJ tightening remains gradual.",
        bearishSummary: "USD/JPY downside increases when BoJ normalization or lower US yields compress the rate differential."
      }
    };

    const [base = "Base", quote = "Quote"] = symbol.split("/");
    const profile = pairProfiles[symbol] || {
      drivers: [`${base} central-bank stance`, `${quote} interest-rate path`, `${base}/${quote} risk sentiment`],
      risks: [`${base} growth slowdown`, `${quote} safe-haven demand`, "policy surprise volatility"],
      bullishSummary: `${symbol} upside improves when ${base} macro momentum outpaces ${quote} and rate expectations support the pair.`,
      bearishSummary: `${symbol} downside deepens when ${quote} strengthens on yields, growth, or risk-off flows.`
    };
    return {
      bias: bullish ? "bullish" : bearish ? "bearish" : "neutral",
      macroScore: bullish ? 72 : bearish ? 68 : 55,
      summary: bullish ? profile.bullishSummary : bearish ? profile.bearishSummary : `${symbol} is fundamentally balanced pending clearer central-bank and macro data divergence.`,
      drivers: profile.drivers,
      risks: profile.risks,
      catalystWindow: "Next 1-5 trading sessions around rate expectations, CPI, jobs and yield moves"
    };
  }

  if (category === "commodity") {
    const drivers = symbol === "XAU/USD"
      ? ["US real-yield direction", "central-bank gold demand", "risk-off flows"]
      : ["industrial demand pulse", "gold spillover direction", "USD trend"];
    const risks = symbol === "XAU/USD"
      ? ["higher real yields", "stronger USD", "reduced haven demand"]
      : ["manufacturing slowdown", "risk-off liquidation", "USD strength"];
    return {
      bias: bullish ? "bullish" : bearish ? "bearish" : "neutral",
      macroScore: bullish ? 69 : bearish ? 66 : 54,
      summary: bullish
        ? `${symbol} benefits when the dollar softens and macro uncertainty keeps precious-metal demand supported.`
        : bearish
          ? `${symbol} weakens when real yields rise or industrial demand expectations soften.`
          : `${symbol} is fundamentally balanced between USD direction and demand expectations.`,
      drivers,
      risks,
      catalystWindow: "Next 1-10 trading sessions around yields, dollar trend, and demand headlines"
    };
  }

  return {
    bias: bullish ? "bullish" : bearish ? "bearish" : "neutral",
    macroScore: bullish ? 70 : bearish ? 67 : 53,
    summary: bullish
      ? `${symbol} strengthens when supply discipline, inventory draws, or geopolitical risk tighten crude balances.`
      : bearish
        ? `${symbol} softens when growth concerns, inventory builds, or weaker refinery demand pressure crude.`
        : `${symbol} is fundamentally balanced between supply risk and growth sensitivity.`,
    drivers: ["OPEC+ supply path", "inventory trend", "global growth expectations"],
    risks: ["inventory builds", "demand slowdown", "headline-driven volatility"],
    catalystWindow: "Next 1-10 trading sessions around inventories, OPEC messaging, and macro risk sentiment"
  };
}

function buildDeepDiveDimension(technicals, fundamentals, pattern, strategiesApplied) {
  const technicalFocus = [
    `EMA20 ${technicals.ema20} vs EMA50 ${technicals.ema50}`,
    `SMA50 ${technicals.sma50}`,
    `MACD histogram ${technicals.macdHistogram}`,
    `Bollinger width ${technicals.bollingerWidthPercent}%`,
    `Support ${technicals.support} / Resistance ${technicals.resistance}`
  ];
  const fundamentalFocus = [...fundamentals.drivers.slice(0, 2), ...fundamentals.risks.slice(0, 1)];
  const confluenceScore = Math.round(clamp((pattern.confidence * 0.6) + (fundamentals.macroScore * 0.4), 0, 100));
  const setupQuality = confluenceScore >= 78 ? "high" : confluenceScore >= 62 ? "medium" : "watchlist";

  return {
    skillDimensions: ["pattern-classification", "ema-trend-filter", "sma50-context", "bollinger-volatility", "macd-momentum", "support-resistance", "fundamental-catalyst-map", ...strategiesApplied.slice(0, 2)],
    confluenceScore,
    setupQuality,
    technicalFocus,
    fundamentalFocus
  };
}

function buildTradePlan(price, support, resistance, direction, pattern, confidence, timeframe, category) {
  const isForex = category === "forex";
  const range = Math.max(resistance - support, price * 0.0025);
  const trailPercent = isForex ? 0.0015 : Math.max(0.004, Math.min(0.025, 0.008 + (100 - confidence) / 2000));
  const rewardMultiplier = isForex
    ? resolveForexRewardMultiplier(timeframe, pattern, confidence)
    : pattern === "breakout" || pattern === "trend"
      ? 2.2
      : pattern === "compression"
        ? 2.5
        : 1.8;

  if (isForex) {
    const stopDistance = Math.max(0.0008, Math.min(price * 0.003, price * 0.0012));
    const profitDistance = stopDistance * rewardMultiplier;

    if (direction === "up") {
      const entry = price;
      const stopLoss = entry - stopDistance;
      const takeProfit = entry + profitDistance;
      const trailingStopLoss = entry - stopDistance * 0.6;
      return {
        entry: roundTo(entry),
        stopLoss: roundTo(stopLoss),
        takeProfit: roundTo(takeProfit),
        trailingStopLoss: roundTo(trailingStopLoss),
        trailingStopPercent: roundTo((stopDistance / entry) * 100, 2),
        riskRewardRatio: roundTo((takeProfit - entry) / Math.max(entry - stopLoss, 0.0000001), 2)
      };
    }

    if (direction === "down") {
      const entry = price;
      const stopLoss = entry + stopDistance;
      const takeProfit = entry - profitDistance;
      const trailingStopLoss = entry + stopDistance * 0.6;
      return {
        entry: roundTo(entry),
        stopLoss: roundTo(stopLoss),
        takeProfit: roundTo(takeProfit),
        trailingStopLoss: roundTo(trailingStopLoss),
        trailingStopPercent: roundTo((stopDistance / entry) * 100, 2),
        riskRewardRatio: roundTo((entry - takeProfit) / Math.max(stopLoss - entry, 0.0000001), 2)
      };
    }

    const entry = price;
    const stopLoss = entry - stopDistance;
    const takeProfit = entry + stopDistance * rewardMultiplier;
    const trailingStopLoss = entry - stopDistance * 0.6;
    return {
      entry: roundTo(entry),
      stopLoss: roundTo(stopLoss),
      takeProfit: roundTo(takeProfit),
      trailingStopLoss: roundTo(trailingStopLoss),
      trailingStopPercent: roundTo((stopDistance / entry) * 100, 2),
      riskRewardRatio: roundTo((takeProfit - entry) / Math.max(entry - stopLoss, 0.0000001), 2)
    };
  }

  if (direction === "up") {
    const entry = price;
    const stopLoss = Math.max(support * 0.995, entry - range * 0.6);
    const takeProfit = entry + (entry - stopLoss) * rewardMultiplier;
    const trailingStopLoss = entry * (1 - trailPercent);
    return {
      entry: roundTo(entry),
      stopLoss: roundTo(stopLoss),
      takeProfit: roundTo(takeProfit),
      trailingStopLoss: roundTo(trailingStopLoss),
      trailingStopPercent: roundTo(trailPercent * 100, 2),
      riskRewardRatio: roundTo((takeProfit - entry) / Math.max(entry - stopLoss, 0.0000001), 2)
    };
  }

  if (direction === "down") {
    const entry = price;
    const stopLoss = Math.min(resistance * 1.005, entry + range * 0.6);
    const takeProfit = entry - (stopLoss - entry) * rewardMultiplier;
    const trailingStopLoss = entry * (1 + trailPercent);
    return {
      entry: roundTo(entry),
      stopLoss: roundTo(stopLoss),
      takeProfit: roundTo(takeProfit),
      trailingStopLoss: roundTo(trailingStopLoss),
      trailingStopPercent: roundTo(trailPercent * 100, 2),
      riskRewardRatio: roundTo((entry - takeProfit) / Math.max(stopLoss - entry, 0.0000001), 2)
    };
  }

  const entry = price;
  const stopLoss = Math.min(entry * 0.992, support);
  const takeProfit = entry + Math.max(entry - stopLoss, price * 0.01) * 1.4;
  const trailingStopLoss = entry * (1 - trailPercent);
  return {
    entry: roundTo(entry),
    stopLoss: roundTo(stopLoss),
    takeProfit: roundTo(takeProfit),
    trailingStopLoss: roundTo(trailingStopLoss),
    trailingStopPercent: roundTo(trailPercent * 100, 2),
    riskRewardRatio: roundTo((takeProfit - entry) / Math.max(entry - stopLoss, 0.0000001), 2)
  };
}

function buildSignal(symbol, category, timeframe, pattern, candles, source, liveSpotPrice) {
  const latest = candles[candles.length - 1] || null;
  const currentPrice = liveSpotPrice ?? latest?.c ?? pattern.latestClose;
  const lastOccurrenceAt = latest
    ? new Date((latest.t > 1e12 ? latest.t : latest.t * 1000)).toISOString()
    : new Date().toISOString();
  const confidence = Math.round(pattern.confidence);
  const strategiesApplied = strategiesForPattern(pattern.pattern, pattern.direction, category, symbol);
  const tradePlan = buildTradePlan(currentPrice, pattern.support, pattern.resistance, pattern.direction, pattern.pattern, confidence, timeframe, category);
  const technicals = buildTechnicalAnalysis(symbol, timeframe, candles, pattern.support, pattern.resistance);
  const fundamentals = buildFundamentalAnalysis(category, symbol, pattern.direction);
  const deepDive = buildDeepDiveDimension(technicals, fundamentals, pattern, strategiesApplied);

  return {
    symbol,
    timeframe,
    pattern: pattern.pattern,
    confidence,
    direction: pattern.direction,
    currentPrice: roundTo(currentPrice),
    lastOccurrenceAt,
    source,
    strategySummary: `${pattern.pattern.toUpperCase()} on ${pattern.symbol} (${pattern.timeframe}) with ${confidence}% confidence. ${technicals.summary} ${fundamentals.summary}`,
    strategiesApplied,
    tradePlan,
    support: roundTo(pattern.support),
    resistance: roundTo(pattern.resistance),
    note: pattern.note || `${symbol} pattern confirmation on ${timeframe}`,
    technicals,
    fundamentals,
    deepDive
  };
}

function pickBestSignal(signals) {
  return signals.reduce((best, signal) => {
    const score = signal.confidence + TIMEFRAME_WEIGHTS[signal.timeframe] + signal.deepDive.confluenceScore / 10;
    const bestScore = best.confidence + TIMEFRAME_WEIGHTS[best.timeframe] + best.deepDive.confluenceScore / 10;
    return score > bestScore ? signal : best;
  }, signals[0]);
}

async function getLiveAgents() {
  const reports = [];
  const sources = new Set();
  const generatedAt = new Date().toISOString();

  for (const config of AGENT_CONFIG) {
    const history = await getLiveHistory(config.symbols, ANALYSIS_TIMEFRAMES, 5);
    const symbolReports = [];
    const agentSignals = [];

    for (const symbol of config.symbols) {
      const liveSpotPrice = config.category === "forex" ? await fetchYahooForexSpotPrice(HISTORY_SYMBOLS[symbol].yahooCode) : null;
      const symbolHistory = history.data[symbol] || {};
      const timeframeSignals = ANALYSIS_TIMEFRAMES.map((timeframe) => {
        const frame = symbolHistory[timeframe];
        const pattern = history.patterns.find((item) => item.symbol === symbol && item.timeframe === timeframe);
        if (!frame || !pattern) {
          return null;
        }

        sources.add(frame.source);
        return buildSignal(symbol, config.category, timeframe, pattern, frame.candles, frame.source, config.category === "forex" ? liveSpotPrice : null);
      }).filter(Boolean);

      if (timeframeSignals.length === 0) {
        continue;
      }

      const bestSignal = pickBestSignal(timeframeSignals);
      agentSignals.push(...timeframeSignals);
      symbolReports.push({
        symbol,
        name: symbol,
        currentPrice: bestSignal.currentPrice,
        bestSignal,
        timeframeSignals
      });
    }

    if (symbolReports.length === 0 || agentSignals.length === 0) {
      continue;
    }

    const bestSignal = pickBestSignal(agentSignals);
    const directionCount = {
      up: agentSignals.filter((signal) => signal.direction === "up").length,
      down: agentSignals.filter((signal) => signal.direction === "down").length,
      neutral: agentSignals.filter((signal) => signal.direction === "neutral").length
    };
    const marketBias = directionCount.up > directionCount.down ? "up" : directionCount.down > directionCount.up ? "down" : "neutral";
    const categoryLabel = config.category === "forex" ? "Forex" : config.category === "commodity" ? "Commodities" : "Oil";
    const ragContext = `RAG placeholder: ${categoryLabel} signal set built from live and derived price history, enriched with EMA20, EMA50, SMA50, Bollinger bands, MACD, support/resistance, and macro catalyst mapping for ${config.symbols.join(", ")}.`;

    reports.push({
      agent: config.agent,
      category: config.category,
      symbols: symbolReports,
      bestSignal,
      summary: `${config.summaryPrefix} ${categoryLabel} currently leans ${String(marketBias).toUpperCase()} with ${bestSignal.pattern} structure on ${bestSignal.timeframe}. Confluence ${bestSignal.deepDive.confluenceScore} with ${bestSignal.deepDive.setupQuality} setup quality.`,
      strategySummary: bestSignal.strategySummary,
      deepDive: bestSignal.deepDive,
      rag: {
        context: ragContext,
        documents: [
          `pattern:${bestSignal.pattern}`,
          `timeframe:${bestSignal.timeframe}`,
          `symbols:${symbolReports.map((item) => item.symbol).join("|")}`,
          "technicals:ema20,ema50,sma50,bollinger,macd,support,resistance",
          `fundamentals:${bestSignal.fundamentals.drivers.join("|")}`
        ]
      },
      knowledgeGraph: {
        nodes: [config.agent, ...config.symbols, bestSignal.pattern, bestSignal.timeframe, "EMA20", "EMA50", "SMA50", "BollingerBands", "MACD", "Fundamentals"],
        edges: [
          ...config.symbols.map((symbol) => `${config.agent} -> ${symbol}`),
          `${config.agent} -> EMA20`,
          `${config.agent} -> EMA50`,
          `${config.agent} -> SMA50`,
          `${config.agent} -> BollingerBands`,
          `${config.agent} -> MACD`,
          `${config.agent} -> Fundamentals`
        ]
      },
      generatedAt
    });
  }

  const source = sources.size === 1 ? Array.from(sources)[0] : sources.size > 1 ? "mixed" : "fallback";

  return {
    data: reports,
    source,
    reason: "Three analysis agents built from live/derived price history with technical indicators, macro drivers, strategy plans, and graph placeholders.",
    generatedAt
  };
}

function evaluateTradeStatusByLevels(direction, stopLoss, takeProfit, currentPrice) {
  if (direction === "up") {
    if (currentPrice >= takeProfit) {
      return "tp-hit";
    }

    if (currentPrice <= stopLoss) {
      return "sl-hit";
    }

    return "open";
  }

  if (direction === "down") {
    if (currentPrice <= takeProfit) {
      return "tp-hit";
    }

    if (currentPrice >= stopLoss) {
      return "sl-hit";
    }

    return "open";
  }

  return "open";
}

function buildSimulatedTradeId(symbol, signal) {
  return [
    symbol,
    signal.timeframe,
    signal.direction,
    toUtcDayKey(signal.lastOccurrenceAt)
  ].join(":");
}

function normalizeTradeLedger() {
  const normalized = new Map();

  for (const trade of forexTradeLedger.values()) {
    const normalizedId = [
      trade.symbol,
      trade.timeframe,
      trade.direction,
      toUtcDayKey(trade.openedAt)
    ].join(":");

    const existing = normalized.get(normalizedId);
    if (!existing) {
      normalized.set(normalizedId, {
        ...trade,
        tradeId: normalizedId
      });
      continue;
    }

    const existingTime = new Date(existing.openedAt).getTime();
    const candidateTime = new Date(trade.openedAt).getTime();
    if (candidateTime >= existingTime) {
      normalized.set(normalizedId, {
        ...trade,
        tradeId: normalizedId
      });
    }
  }

  forexTradeLedger.clear();
  for (const [tradeId, trade] of normalized.entries()) {
    forexTradeLedger.set(tradeId, trade);
  }
}

function trimTradeLedger(maxEntries = 1200) {
  if (forexTradeLedger.size <= maxEntries) {
    return;
  }

  const ordered = Array.from(forexTradeLedger.values()).sort((left, right) => {
    return new Date(left.openedAt).getTime() - new Date(right.openedAt).getTime();
  });

  while (ordered.length > maxEntries) {
    const oldest = ordered.shift();
    if (oldest) {
      forexTradeLedger.delete(oldest.tradeId);
    }
  }
}

async function loadForexTradesFromStore() {
  if (!(dynamoClient && DynamoGetCommand && MT4_SNAPSHOT_TABLE)) {
    return;
  }

  try {
    const record = await dynamoClient.send(new DynamoGetCommand({
      TableName: MT4_SNAPSHOT_TABLE,
      Key: {
        [MT4_SNAPSHOT_PK_NAME]: `${MT4_SNAPSHOT_KEY}#${FOREX_MONITORING_TRADES_PK}`
      }
    }));

    const storedTrades = record?.Item?.snapshot?.trades;
    if (storedTrades && typeof storedTrades === "object") {
      for (const [tradeId, value] of Object.entries(storedTrades)) {
        if (value && typeof value === "object") {
          forexTradeLedger.set(tradeId, value);
        }
      }
    }

    normalizeTradeLedger();
  } catch {
    // Keep in-memory fallback if persistence is unavailable.
  }
}

async function persistForexTradesToStore() {
  if (!(dynamoClient && DynamoPutCommand && MT4_SNAPSHOT_TABLE)) {
    return;
  }

  try {
    await dynamoClient.send(new DynamoPutCommand({
      TableName: MT4_SNAPSHOT_TABLE,
      Item: {
        [MT4_SNAPSHOT_PK_NAME]: `${MT4_SNAPSHOT_KEY}#${FOREX_MONITORING_TRADES_PK}`,
        snapshot: {
          key: FOREX_MONITORING_TRADES_SK,
          trades: Object.fromEntries(forexTradeLedger.entries())
        },
        updatedAt: new Date().toISOString()
      }
    }));
  } catch {
    // Keep in-memory fallback if persistence is unavailable.
  }
}

async function upsertSimulatedTradesFromForexAgent(forex, generatedAt) {
  if (forexTradeLedger.size === 0) {
    await loadForexTradesFromStore();
  }

  normalizeTradeLedger();

  for (const symbolReport of forex.symbols || []) {
    for (const signal of symbolReport.timeframeSignals || []) {
      if (signal.direction === "neutral") {
        continue;
      }

      const tradeId = buildSimulatedTradeId(symbolReport.symbol, signal);
      if (forexTradeLedger.has(tradeId)) {
        continue;
      }

      const openedAt = Number.isFinite(Date.parse(signal.lastOccurrenceAt)) ? signal.lastOccurrenceAt : generatedAt;
      forexTradeLedger.set(tradeId, {
        tradeId,
        symbol: symbolReport.symbol,
        timeframe: signal.timeframe,
        direction: signal.direction,
        entry: signal.tradePlan.entry,
        stopLoss: signal.tradePlan.stopLoss,
        takeProfit: signal.tradePlan.takeProfit,
        currentPrice: symbolReport.currentPrice,
        riskRewardRatio: signal.tradePlan.riskRewardRatio,
        status: "open",
        openedAt
      });
    }
  }

  trimTradeLedger();
}

function updateOpenTradesWithCurrentPrices(forex, generatedAt) {
  const priceBySymbol = new Map();
  for (const symbolReport of forex.symbols || []) {
    priceBySymbol.set(symbolReport.symbol, symbolReport.currentPrice);
  }

  for (const [tradeId, trade] of forexTradeLedger.entries()) {
    if (trade.status !== "open") {
      continue;
    }

    const currentPrice = priceBySymbol.get(trade.symbol);
    if (!Number.isFinite(currentPrice)) {
      continue;
    }

    const status = evaluateTradeStatusByLevels(trade.direction, trade.stopLoss, trade.takeProfit, currentPrice);
    if (status === "open") {
      if (trade.currentPrice !== currentPrice) {
        forexTradeLedger.set(tradeId, {
          ...trade,
          currentPrice
        });
      }
      continue;
    }

    forexTradeLedger.set(tradeId, {
      ...trade,
      status,
      currentPrice,
      closePrice: currentPrice,
      closedAt: generatedAt
    });
  }
}

async function getForexMonitoringReport() {
  const agents = await getLiveAgents();
  const forex = (agents.data || []).find((agent) => agent.agent === "Forex");
  const generatedAt = new Date().toISOString();

  if (!forex) {
    return {
      totalTrades: 0,
      tpHitCount: 0,
      slHitCount: 0,
      openCount: 0,
      closedTrades: 0,
      activeTrades: 0,
      resolvedTrades: 0,
      winRatePercent: 0,
      generatedAt,
      items: []
    };
  }

  await upsertSimulatedTradesFromForexAgent(forex, generatedAt);
  updateOpenTradesWithCurrentPrices(forex, generatedAt);
  await persistForexTradesToStore();

  const items = Array.from(forexTradeLedger.values()).sort((left, right) => {
    return new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime();
  });

  const tpHitCount = items.filter((item) => item.status === "tp-hit").length;
  const slHitCount = items.filter((item) => item.status === "sl-hit").length;
  const openCount = items.filter((item) => item.status === "open").length;
  const resolvedTrades = tpHitCount + slHitCount;
  const winRatePercent = resolvedTrades > 0 ? roundTo((tpHitCount / resolvedTrades) * 100, 2) : 0;

  return {
    totalTrades: items.length,
    tpHitCount,
    slHitCount,
    openCount,
    closedTrades: resolvedTrades,
    activeTrades: openCount,
    resolvedTrades,
    winRatePercent,
    generatedAt,
    items
  };
}

function buildHistoryDateRange(daysRequested) {
  const end = new Date();
  const days = [];

  for (let index = daysRequested - 1; index >= 0; index -= 1) {
    const current = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    current.setUTCDate(current.getUTCDate() - index);
    days.push(current.toISOString().slice(0, 10));
  }

  return days;
}

async function getForexMonitoringHistory(days = 10) {
  const daysRequested = Math.max(1, Math.min(30, Math.round(Number(days) || 10)));
  await getForexMonitoringReport();

  const dayKeys = buildHistoryDateRange(daysRequested);
  const daily = dayKeys.map((dayKey) => {
    const ledgerItems = Array.from(forexTradeLedger.values());
    const openedTrades = ledgerItems.filter((item) => toUtcDayKey(item.openedAt) === dayKey).length;
    const tpHitCount = ledgerItems.filter((item) => item.status === "tp-hit" && item.closedAt && toUtcDayKey(item.closedAt) === dayKey).length;
    const slHitCount = ledgerItems.filter((item) => item.status === "sl-hit" && item.closedAt && toUtcDayKey(item.closedAt) === dayKey).length;
    const openCount = ledgerItems.filter((item) => item.status === "open" && toUtcDayKey(item.openedAt) === dayKey).length;
    const resolvedTrades = tpHitCount + slHitCount;
    const hasData = openedTrades > 0 || resolvedTrades > 0;

    if (hasData) {
      return {
        date: dayKey,
        openedTrades,
        totalTrades: openedTrades,
        tpHitCount,
        slHitCount,
        openCount,
        resolvedTrades,
        winRatePercent: resolvedTrades > 0 ? roundTo((tpHitCount / resolvedTrades) * 100, 2) : null,
        hasData,
        generatedAt: new Date().toISOString()
      };
    }

    return {
      date: dayKey,
      openedTrades: 0,
      totalTrades: 0,
      tpHitCount: 0,
      slHitCount: 0,
      openCount: 0,
      resolvedTrades: 0,
      winRatePercent: null,
      hasData: false,
      generatedAt: new Date(`${dayKey}T00:00:00.000Z`).toISOString()
    };
  });

  const observedDays = daily.filter((item) => item.hasData).length;
  const totalTpHitCount = daily.reduce((sum, item) => sum + Number(item.tpHitCount || 0), 0);
  const totalSlHitCount = daily.reduce((sum, item) => sum + Number(item.slHitCount || 0), 0);
  const totalResolvedTrades = totalTpHitCount + totalSlHitCount;

  return {
    daysRequested,
    observedDays,
    totalTpHitCount,
    totalSlHitCount,
    totalResolvedTrades,
    overallWinRatePercent: totalResolvedTrades > 0 ? roundTo((totalTpHitCount / totalResolvedTrades) * 100, 2) : null,
    generatedAt: new Date().toISOString(),
    daily
  };
}

async function fetchYahooDailyClose(symbol) {
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json,text/plain,*/*",
      Referer: "https://finance.yahoo.com/"
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close || [];
  const timestamps = result?.timestamp || [];

  const valid = closes
    .map((close, index) => ({ close: Number(close), timestamp: timestamps[index] }))
    .filter((item) => Number.isFinite(item.close) && item.close > 0);

  if (valid.length < 2) {
    return null;
  }

  const latest = valid[valid.length - 1];
  const previous = valid[valid.length - 2];
  const changePercent = previous.close > 0 ? ((latest.close - previous.close) / previous.close) * 100 : 0;

  return {
    price: latest.close,
    changePercent,
    previousClose: previous.close,
    timestamp: latest.timestamp || null
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

function html(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "text/html; charset=utf-8"
    },
    body
  };
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value, decimals = 2) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  return Number(value).toFixed(decimals);
}

function wantsHtml(event) {
  const acceptHeader = getHeaderValue(event, "accept");
  const query = event?.queryStringParameters || {};
  const format = typeof query.format === "string" ? query.format.toLowerCase() : "";
  return format === "html" || acceptHeader.includes("text/html");
}

function renderMonitoringReportHtml(report) {
  const rows = (report.items || [])
    .map((item) => {
      const statusClass = item.status === "tp-hit" ? "tp" : item.status === "sl-hit" ? "sl" : "open";
      return `<tr>
        <td>${escapeHtml(item.tradeId)}</td>
        <td>${escapeHtml(item.symbol)}</td>
        <td>${escapeHtml(item.timeframe)}</td>
        <td>${escapeHtml(String(item.direction || "").toUpperCase())}</td>
        <td>${formatNumber(item.entry, 4)}</td>
        <td>${formatNumber(item.stopLoss, 4)}</td>
        <td>${formatNumber(item.takeProfit, 4)}</td>
        <td>${formatNumber(item.currentPrice, 4)}</td>
        <td>1:${formatNumber(item.riskRewardRatio, 2)}</td>
        <td class="${statusClass}">${escapeHtml(String(item.status || "").toUpperCase())}</td>
        <td>${escapeHtml(item.openedAt)}</td>
        <td>${item.closedAt ? escapeHtml(item.closedAt) : "-"}</td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Forex Trade Monitoring Report</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; background: #f4f8fb; color: #102132; }
    .wrap { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { color: #466176; margin-bottom: 14px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fill,minmax(170px,1fr)); gap: 10px; margin-bottom: 16px; }
    .stat { background: #ffffff; border: 1px solid #d7e3ec; border-radius: 10px; padding: 10px; }
    .stat .k { display: block; color: #4d6477; font-size: 12px; margin-bottom: 3px; }
    .stat .v { font-size: 20px; font-weight: 700; color: #0b2f4a; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d7e3ec; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #edf2f6; font-size: 12px; }
    th { background: #f0f6fb; color: #26435c; position: sticky; top: 0; }
    .tp { color: #166534; font-weight: 700; }
    .sl { color: #b91c1c; font-weight: 700; }
    .open { color: #9a6700; font-weight: 700; }
    .table-wrap { overflow: auto; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Forex Trade Monitoring Report</h1>
    <div class="meta">Generated at ${escapeHtml(report.generatedAt)}</div>
    <section class="stats">
      <div class="stat"><span class="k">Total Trades</span><span class="v">${report.totalTrades}</span></div>
      <div class="stat"><span class="k">TP Hit</span><span class="v">${report.tpHitCount}</span></div>
      <div class="stat"><span class="k">SL Hit</span><span class="v">${report.slHitCount}</span></div>
      <div class="stat"><span class="k">Open</span><span class="v">${report.openCount}</span></div>
      <div class="stat"><span class="k">Resolved</span><span class="v">${report.resolvedTrades}</span></div>
      <div class="stat"><span class="k">Win Rate</span><span class="v">${formatNumber(report.winRatePercent)}%</span></div>
    </section>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trade ID</th>
            <th>Symbol</th>
            <th>Timeframe</th>
            <th>Direction</th>
            <th>Entry</th>
            <th>SL</th>
            <th>TP</th>
            <th>Current</th>
            <th>R:R</th>
            <th>Status</th>
            <th>Opened</th>
            <th>Closed</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function renderMonitoringHistoryHtml(report) {
  const rows = (report.daily || [])
    .map((day) => `<tr>
      <td>${escapeHtml(day.date)}</td>
      <td>${day.hasData ? "Yes" : "No"}</td>
      <td>${day.openedTrades}</td>
      <td>${day.totalTrades}</td>
      <td>${day.tpHitCount}</td>
      <td>${day.slHitCount}</td>
      <td>${day.openCount}</td>
      <td>${day.resolvedTrades}</td>
      <td>${day.winRatePercent == null ? "-" : `${formatNumber(day.winRatePercent)}%`}</td>
    </tr>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>10-Day Forex Success Rate View</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; background: #f4f8fb; color: #102132; }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 20px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .meta { color: #466176; margin-bottom: 14px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fill,minmax(180px,1fr)); gap: 10px; margin-bottom: 16px; }
    .stat { background: #ffffff; border: 1px solid #d7e3ec; border-radius: 10px; padding: 10px; }
    .stat .k { display: block; color: #4d6477; font-size: 12px; margin-bottom: 3px; }
    .stat .v { font-size: 20px; font-weight: 700; color: #0b2f4a; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #d7e3ec; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #edf2f6; font-size: 12px; }
    th { background: #f0f6fb; color: #26435c; }
    .table-wrap { overflow: auto; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>10-Day Forex Success Rate View</h1>
    <div class="meta">Generated at ${escapeHtml(report.generatedAt)}</div>
    <section class="stats">
      <div class="stat"><span class="k">Days Requested</span><span class="v">${report.daysRequested}</span></div>
      <div class="stat"><span class="k">Observed Days</span><span class="v">${report.observedDays}</span></div>
      <div class="stat"><span class="k">Total TP Hit</span><span class="v">${report.totalTpHitCount}</span></div>
      <div class="stat"><span class="k">Total SL Hit</span><span class="v">${report.totalSlHitCount}</span></div>
      <div class="stat"><span class="k">Resolved Trades</span><span class="v">${report.totalResolvedTrades}</span></div>
      <div class="stat"><span class="k">Overall Win Rate</span><span class="v">${report.overallWinRatePercent == null ? "-" : `${formatNumber(report.overallWinRatePercent)}%`}</span></div>
    </section>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Has Data</th>
            <th>Opened</th>
            <th>Total</th>
            <th>TP Hit</th>
            <th>SL Hit</th>
            <th>Open</th>
            <th>Resolved</th>
            <th>Win Rate</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

let latestMt4Snapshot = null;

function getHeaderValue(event, headerName) {
  const headers = event?.headers || {};
  const match = Object.keys(headers).find((key) => key.toLowerCase() === headerName.toLowerCase());
  return match ? String(headers[match]) : "";
}

function parseEventBody(event) {
  if (!event || !event.body) {
    return {};
  }

  if (typeof event.body !== "string") {
    return event.body;
  }

  const bodyString = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  try {
    return JSON.parse(bodyString);
  } catch {
    return {};
  }
}

function normalizeMt4Snapshot(body) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  const terminalId = typeof body.terminalId === "string" ? body.terminalId.trim() : "";
  if (!accountId || !terminalId) {
    return null;
  }

  const timestamp = (() => {
    const raw = typeof body.timestamp === "string" ? body.timestamp : "";
    return Number.isFinite(Date.parse(raw)) ? raw : new Date().toISOString();
  })();

  const toNumberOrUndefined = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  };

  const positions = Array.isArray(body.positions)
    ? body.positions
      .filter((item) => item && typeof item.symbol === "string" && (item.side === "BUY" || item.side === "SELL"))
      .map((item) => ({
        symbol: item.symbol,
        side: item.side,
        volume: Number(item.volume) || 0,
        openPrice: Number(item.openPrice) || 0,
        profit: Number(item.profit) || 0,
        stopLoss: toNumberOrUndefined(item.stopLoss),
        takeProfit: toNumberOrUndefined(item.takeProfit)
      }))
    : [];

  const pendingOrders = Array.isArray(body.pendingOrders)
    ? body.pendingOrders
      .filter((item) => item && typeof item.symbol === "string" && typeof item.type === "string")
      .map((item) => ({
        symbol: item.symbol,
        type: item.type,
        price: Number(item.price) || 0,
        volume: Number(item.volume) || 0,
        stopLoss: toNumberOrUndefined(item.stopLoss),
        takeProfit: toNumberOrUndefined(item.takeProfit)
      }))
    : [];

  const quotes = Array.isArray(body.quotes)
    ? body.quotes
      .filter((item) => item && typeof item.symbol === "string")
      .map((item) => ({
        symbol: item.symbol,
        bid: Number(item.bid) || 0,
        ask: Number(item.ask) || 0,
        spread: toNumberOrUndefined(item.spread),
        timestamp: Number.isFinite(Date.parse(item.timestamp)) ? item.timestamp : new Date().toISOString()
      }))
    : [];

  return {
    accountId,
    terminalId,
    server: typeof body.server === "string" ? body.server : undefined,
    timestamp,
    heartbeat: Number.isFinite(Number(body.heartbeat)) ? Math.max(0, Math.floor(Number(body.heartbeat))) : undefined,
    balance: toNumberOrUndefined(body.balance),
    equity: toNumberOrUndefined(body.equity),
    margin: toNumberOrUndefined(body.margin),
    freeMargin: toNumberOrUndefined(body.freeMargin),
    positions,
    pendingOrders,
    quotes
  };
}

function describeSnapshotHealth(ageSeconds) {
  if (ageSeconds <= 30) {
    return {
      healthStatus: "fresh",
      healthNote: "Snapshot is live (<= 30s old)"
    };
  }

  if (ageSeconds <= 180) {
    return {
      healthStatus: "stale",
      healthNote: "Snapshot is delayed (> 30s old)"
    };
  }

  return {
    healthStatus: "offline",
    healthNote: "Snapshot feed appears offline (> 3m old)"
  };
}

async function storeMt4Snapshot(snapshot) {
  const receivedAt = new Date().toISOString();
  const ageSeconds = Math.max(0, Math.round((Date.now() - Date.parse(snapshot.timestamp)) / 1000));
  const health = describeSnapshotHealth(ageSeconds);
  const materialized = {
    ...snapshot,
    source: "mt4",
    receivedAt,
    ageSeconds,
    ...health
  };

  latestMt4Snapshot = materialized;

  if (dynamoClient && DynamoPutCommand) {
    try {
      await dynamoClient.send(new DynamoPutCommand({
        TableName: MT4_SNAPSHOT_TABLE,
        Item: {
          [MT4_SNAPSHOT_PK_NAME]: MT4_SNAPSHOT_KEY,
          snapshot: materialized,
          updatedAt: receivedAt
        }
      }));
    } catch {
      // Keep in-memory snapshot as fallback.
    }
  }

  return materialized;
}

async function getMt4Snapshot() {
  if (dynamoClient && DynamoGetCommand) {
    try {
      const record = await dynamoClient.send(new DynamoGetCommand({
        TableName: MT4_SNAPSHOT_TABLE,
        Key: {
          [MT4_SNAPSHOT_PK_NAME]: MT4_SNAPSHOT_KEY
        }
      }));

      const stored = record?.Item?.snapshot;
      if (stored && typeof stored === "object") {
        latestMt4Snapshot = stored;
      }
    } catch {
      // Fallback to in-memory snapshot.
    }
  }

  if (!latestMt4Snapshot) {
    return null;
  }

  const ageSeconds = Math.max(0, Math.round((Date.now() - Date.parse(latestMt4Snapshot.timestamp)) / 1000));
  const health = describeSnapshotHealth(ageSeconds);

  return {
    ...latestMt4Snapshot,
    ageSeconds,
    ...health
  };
}

function extractTagValue(itemXml, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = itemXml.match(pattern);
  return match && match[1] ? match[1].trim() : "";
}

function decodeXmlEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function hashString(value) {
  return value.split("").reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
}

function getHistoryDrift(meta) {
  if (meta.category === "forex") {
    return meta.symbol === "USD/JPY" ? 0.0003 : 0.00012;
  }

  if (meta.category === "commodity") {
    return meta.symbol === "XAU/USD" ? 0.00018 : -0.00006;
  }

  return meta.symbol === "BRENT" ? 0.00008 : -0.00004;
}

function buildSyntheticDailyHistory(meta, years, basePrice) {
  const seed = hashString(`${meta.symbol}:${years}`);
  const totalPoints = Math.max(365 * years, 365);
  const startTime = Date.now() - totalPoints * 24 * 60 * 60 * 1000;
  const raw = [];
  let level = 1;
  const drift = getHistoryDrift(meta) * (seed % 2 === 0 ? 1 : -1);

  for (let index = 0; index < totalPoints; index += 1) {
    const cycle = Math.sin((index + seed % 17) * 0.03) * 0.0035;
    const ripple = Math.cos((index + seed % 11) * 0.17) * 0.0018;
    const move = drift + cycle + ripple;
    const openLevel = level;
    level = Math.max(0.2, level * (1 + move));
    const highLevel = Math.max(openLevel, level) * (1 + 0.003 + ((seed + index) % 7) / 1000);
    const lowLevel = Math.min(openLevel, level) * (1 - 0.003 - ((seed + index) % 5) / 1200);

    raw.push({
      t: startTime + index * 24 * 60 * 60 * 1000,
      o: openLevel,
      h: highLevel,
      l: Math.max(0.0001, lowLevel),
      c: level
    });
  }

  const scale = basePrice > 0 ? basePrice / raw[raw.length - 1].c : 1;
  return raw.map((candle) => ({
    t: candle.t,
    o: candle.o * scale,
    h: candle.h * scale,
    l: candle.l * scale,
    c: candle.c * scale
  }));
}

function overlayLiveSpotOnCandles(candles, livePrice) {
  if (!Array.isArray(candles) || candles.length === 0 || !Number.isFinite(livePrice) || livePrice <= 0) {
    return candles;
  }

  const output = candles.slice();
  const last = output[output.length - 1];
  output[output.length - 1] = {
    ...last,
    h: Math.max(last.h, livePrice),
    l: Math.min(last.l, livePrice),
    c: livePrice
  };
  return output;
}

async function getReferencePriceMap() {
  try {
    const trends = await getLiveTrends();
    const map = new Map();
    for (const item of trends.data) {
      map.set(item.symbol, item.price);
    }
    return map;
  } catch {
    return new Map(Object.entries(DEFAULT_REFERENCE_PRICES));
  }
}

async function getLiveNews() {
  const collected = [];

  for (const feedUrl of RSS_FEEDS) {
    try {
      const response = await fetch(feedUrl);
      if (!response.ok) {
        continue;
      }

      const xml = await response.text();
      const channelTitle = extractTagValue(xml, "title") || "RSS Source";
      const itemMatches = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];

      for (const item of itemMatches.slice(0, 8)) {
        const title = stripHtml(decodeXmlEntities(extractTagValue(item, "title")));
        const summary = stripHtml(decodeXmlEntities(extractTagValue(item, "description")));
        const url = decodeXmlEntities(extractTagValue(item, "link"));
        const pubDateRaw = extractTagValue(item, "pubDate");
        const dt = new Date(pubDateRaw);

        if (!title || !url) {
          continue;
        }

        collected.push({
          id: `${url}|${title}`,
          title,
          source: channelTitle,
          publishedAt: Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString(),
          summary: summary || "Live market headline",
          url,
          impacts: []
        });
      }
    } catch {
      continue;
    }
  }

  const deduped = Array.from(new Map(collected.map((item) => [item.url, item])).values())
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 10);

  return {
    data: deduped,
    source: "live",
    provider: "rss"
  };
}

function makeTrend(symbol, name, category, price, changePercent) {
  const direction = changePercent >= 0 ? "up" : "down";
  return {
    symbol,
    name,
    category,
    price,
    changePercent,
    direction,
    momentum: direction === "up" ? "Up" : "Down",
    momentumSuggestion: direction === "up" ? "Up" : "Down",
    confidence: Math.max(55, Math.min(85, Math.round(Math.abs(changePercent) * 12 + 55)))
  };
}

async function getLiveTrends() {
  const [eur, gbp, usd, jpy] = await Promise.all([
    fetch("https://open.er-api.com/v6/latest/EUR").then((r) => r.json()),
    fetch("https://open.er-api.com/v6/latest/GBP").then((r) => r.json()),
    fetch("https://open.er-api.com/v6/latest/USD").then((r) => r.json()),
    fetch("https://open.er-api.com/v6/latest/JPY").then((r) => r.json())
  ]);

  const eurusd = Number(eur?.rates?.USD || 0);
  const gbpusd = Number(gbp?.rates?.USD || 0);
  const usdjpy = Number(usd?.rates?.JPY || 0);

  const drift = Number(jpy?.rates?.USD || 0) > 0
    ? ((Number(usd?.rates?.EUR || 0) + Number(usd?.rates?.GBP || 0)) / 2 - 0.86) * 2
    : 0;

  const trends = [
    makeTrend("EUR/USD", "Euro vs US Dollar", "forex", eurusd, drift),
    makeTrend("GBP/USD", "British Pound vs US Dollar", "forex", gbpusd, -drift / 2),
    makeTrend("USD/JPY", "US Dollar vs Japanese Yen", "forex", usdjpy, drift / 3)
  ].filter((item) => Number.isFinite(item.price) && item.price > 0);

  try {
    const [goldChart, silverChart, gold, silver] = await Promise.all([
      fetchYahooDailyClose("GC=F"),
      fetchYahooDailyClose("SI=F"),
      fetch("https://api.gold-api.com/price/XAU").then((r) => r.json()),
      fetch("https://api.gold-api.com/price/XAG").then((r) => r.json())
    ]);

    const goldPrice = Number(goldChart?.price ?? gold?.price ?? 0);
    const silverPrice = Number(silverChart?.price ?? silver?.price ?? 0);

    if (Number.isFinite(goldPrice) && goldPrice > 0) {
      const goldChange = typeof goldChart?.changePercent === "number" ? goldChart.changePercent : 0;
      trends.push(makeTrend("XAU/USD", "Gold Spot", "commodity", goldPrice, goldChange));
    }

    if (Number.isFinite(silverPrice) && silverPrice > 0) {
      const silverChange = typeof silverChart?.changePercent === "number" ? silverChart.changePercent : 0;
      trends.push(makeTrend("XAG/USD", "Silver Spot", "commodity", silverPrice, silverChange));
    }
  } catch {
    // Keep available trends even if commodity provider is temporarily unavailable.
  }

  try {
    const [brentChart, wtiChart] = await Promise.all([
      fetchYahooDailyClose("BZ=F"),
      fetchYahooDailyClose("CL=F")
    ]);

    const brentCurrent = Number(brentChart?.price || 0);
    const wtiCurrent = Number(wtiChart?.price || 0);
    const brentChange = typeof brentChart?.changePercent === "number" ? brentChart.changePercent : 0;
    const wtiChange = typeof wtiChart?.changePercent === "number" ? wtiChart.changePercent : 0;

    if (Number.isFinite(brentCurrent) && brentCurrent > 0) {
      trends.push(makeTrend("BRENT", "Crude Oil Brent", "oil", brentCurrent, brentChange));
    }

    if (Number.isFinite(wtiCurrent) && wtiCurrent > 0) {
      trends.push(makeTrend("WTI", "Crude Oil WTI", "oil", wtiCurrent, wtiChange));
    }
  } catch {
    // Keep available trends even if oil provider is temporarily unavailable.
  }

  return {
    data: trends,
    source: "live",
    reason: "Live FX via open.er-api, metals and oil via Yahoo chart daily closes"
  };
}

async function getLiveShares() {
  const universe = [
    "MSFT", "NVDA", "AAPL", "AMZN", "GOOGL", "META", "TSLA", "JPM", "XOM", "CVX",
    "UNH", "JNJ", "PG", "KO", "PEP", "WMT", "HD", "MCD", "ABBV", "LLY"
  ];

  const buildFallbackRows = (existingRows = []) => {
    const existingBySymbol = new Map(existingRows.map((row) => [row.symbol, row]));
    const seededRows = universe.map((symbol, index) => {
      const existing = existingBySymbol.get(symbol);
      if (existing) {
        return existing;
      }

      const seed = hashString(`${symbol}:${index}`);
      const basePrice = 40 + (seed % 460);
      const drift = ((seed % 900) / 100) - 4.5;
      const score = Math.max(50, Math.min(92, Math.round(Math.abs(drift) * 7 + 56)));

      return {
        symbol,
        name: symbol,
        price: Number(basePrice.toFixed(2)),
        changePercent: Number(drift.toFixed(2)),
        source: "fallback",
        rationale: "Fallback ranked share while live quote provider is unavailable",
        sector: "Market",
        score,
        factorScores: {
          momentum: Math.max(50, Math.min(92, Math.round(Math.abs(drift) * 9 + 54))),
          volatility: 58,
          sentiment: 55,
          participation: 53
        }
      };
    });

    return seededRows
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 20);
  };

  try {
    const url = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
    url.searchParams.set("symbols", universe.join(","));
    const payload = await fetch(url.toString(), {
      headers: {
        "User-Agent": "market-analysis-live-api"
      }
    }).then((r) => r.json());

    const rows = (payload?.quoteResponse?.result || [])
      .map((item) => {
        const symbol = typeof item.symbol === "string" ? item.symbol : "";
        const price = Number(item.regularMarketPrice || 0);
        const changePercent = Number(item.regularMarketChangePercent || 0);
        if (!symbol || !Number.isFinite(price) || price <= 0 || !Number.isFinite(changePercent)) {
          return null;
        }

        return {
          symbol,
          name: item.longName || symbol,
          price,
          changePercent,
          source: "live",
          rationale: "Live quote via Yahoo Finance multi-quote endpoint",
          sector: item.sector || "Market",
          score: Math.max(50, Math.min(95, Math.round(Math.abs(changePercent) * 8 + 58))),
          factorScores: {
            momentum: Math.max(50, Math.min(95, Math.round(Math.abs(changePercent) * 10 + 55))),
            volatility: 60,
            sentiment: 56,
            participation: 54
          }
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 20);

    return { data: buildFallbackRows(rows) };
  } catch {
    return { data: buildFallbackRows() };
  }
}

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const path = event.rawPath || event.path || "/";

  if (method === "OPTIONS") {
    return json(200, { ok: true });
  }

  try {
    if (path === "/health") {
      return json(200, { status: "ok", timestamp: new Date().toISOString() });
    }

    if (path === "/api/news/global") {
      return json(200, await getLiveNews());
    }

    if (path === "/api/market/trends") {
      return json(200, await getLiveTrends());
    }

    if (path === "/api/market/agents") {
      return json(200, await getLiveAgents());
    }

    if (path === "/api/market/forex-monitoring-report") {
      const report = await getForexMonitoringReport();
      if (wantsHtml(event)) {
        return html(200, renderMonitoringReportHtml(report));
      }

      return json(200, report);
    }

    if (path === "/api/market/forex-monitoring-history") {
      const query = event?.queryStringParameters || {};
      const days = Number(query.days);
      const report = await getForexMonitoringHistory(Number.isFinite(days) ? days : 10);
      if (wantsHtml(event)) {
        return html(200, renderMonitoringHistoryHtml(report));
      }

      return json(200, report);
    }

    if (path === "/api/notify/status") {
      return json(200, {
        enabled: false,
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
      });
    }

    if (path === "/api/mt4/snapshot") {
      if (method === "GET") {
        const snapshot = await getMt4Snapshot();
        if (!snapshot) {
          return json(404, { error: "No MT4 snapshot received yet" });
        }

        return json(200, snapshot);
      }

      if (method === "POST") {
        if (MT4_SNAPSHOT_API_KEY) {
          const providedApiKey = getHeaderValue(event, "x-api-key");
          if (!providedApiKey || providedApiKey !== MT4_SNAPSHOT_API_KEY) {
            return json(401, { error: "Unauthorized" });
          }
        }

        const body = parseEventBody(event);
        const snapshot = normalizeMt4Snapshot(body);

        if (!snapshot) {
          return json(400, { error: "Invalid payload" });
        }

        return json(202, await storeMt4Snapshot(snapshot));
      }

      return json(405, { error: "Method not allowed" });
    }

    if (path === "/api/mt4/quotes") {
      if (method !== "GET") {
        return json(405, { error: "Method not allowed" });
      }

      const snapshot = await getMt4Snapshot();
      if (!snapshot) {
        return json(404, { error: "No MT4 snapshot received yet" });
      }

      return json(200, {
        source: snapshot.source,
        receivedAt: snapshot.receivedAt,
        timestamp: snapshot.timestamp,
        heartbeat: snapshot.heartbeat,
        ageSeconds: snapshot.ageSeconds,
        healthStatus: snapshot.healthStatus,
        healthNote: snapshot.healthNote,
        quotes: Array.isArray(snapshot.quotes) ? snapshot.quotes : []
      });
    }

    if (path === "/api/market/best-shares") {
      return json(200, await getLiveShares());
    }

    if (path === "/api/market/history") {
      if (method !== "POST") {
        return json(405, { error: "Method not allowed" });
      }

      const body = parseEventBody(event);
      const symbols = Array.isArray(body.symbols) ? body.symbols : [];
      const timeframes = Array.isArray(body.timeframes) ? body.timeframes : [];
      const years = Number.isFinite(Number(body.years)) ? Number(body.years) : 5;
      return json(200, await getLiveHistory(symbols, timeframes, years));
    }

    if (path === "/api/market/forex-candles") {
      return json(503, {
        error: "Live candle history is not configured on public endpoint",
        source: "live-only"
      });
    }

    return json(404, { error: "Not found", path });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "Internal error" });
  }
};
