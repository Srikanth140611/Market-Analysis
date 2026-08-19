const RSS_FEEDS = [
  "https://www.cnbc.com/id/100003114/device/rss/rss.html",
  "https://finance.yahoo.com/news/rssindex"
];

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

const HISTORY_TIMEFRAMES = ["1minute", "5minute", "1hour", "4hour", "8hour", "12hour", "1Day", "1Week"];
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
    case "1minute":
      return 360;
    case "5minute":
      return 320;
    case "1hour":
      return 280;
    case "4hour":
      return 220;
    case "8hour":
      return 180;
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
    case "1minute":
      return "1 minute";
    case "5minute":
      return "5 minute";
    case "1hour":
      return "1 hour";
    case "4hour":
      return "4 hour";
    case "8hour":
      return "8 hour";
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
      let source = liveDailyCandles.length > 0 ? (timeframe === "1Day" ? "live" : "derived") : "derived";
      let note = liveDailyCandles.length > 0
        ? `Live Yahoo daily history for ${symbol}`
        : `Derived 5-year history for ${symbol} from live reference prices`;

      if (timeframe === "1Week") {
        frameCandles = aggregateCandles(frameCandles, 5);
        note = liveDailyCandles.length > 0
          ? `Derived weekly history from Yahoo daily closes for ${symbol}`
          : `Derived weekly history for ${symbol} from synthetic daily candles`;
      } else if (timeframe === "12hour") {
        frameCandles = aggregateCandles(frameCandles, 2);
        note = liveDailyCandles.length > 0
          ? `Derived 12-hour history from Yahoo daily closes for ${symbol}`
          : `Derived 12-hour history for ${symbol} from synthetic daily candles`;
      } else if (timeframe === "8hour") {
        frameCandles = aggregateCandles(frameCandles, 3);
        note = liveDailyCandles.length > 0
          ? `Derived 8-hour history from Yahoo daily closes for ${symbol}`
          : `Derived 8-hour history for ${symbol} from synthetic daily candles`;
      } else if (timeframe !== "1Day") {
        note = liveDailyCandles.length > 0
          ? `${symbol} does not expose public ${timeframeLabel(timeframe)} history here; using derived bars from daily history`
          : `${symbol} does not expose public ${timeframeLabel(timeframe)} history here; using derived bars from synthetic daily history`;
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

const ANALYSIS_TIMEFRAMES = ["1minute", "5minute", "1hour", "4hour", "8hour", "12hour", "1Day", "1Week"];

const TIMEFRAME_WEIGHTS = {
  "1minute": 8,
  "5minute": 7,
  "1hour": 6,
  "4hour": 5,
  "8hour": 4,
  "12hour": 3,
  "1Day": 2,
  "1Week": 1
};

function roundTo(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

function buildTradePlan(price, support, resistance, direction, pattern, confidence) {
  const range = Math.max(resistance - support, price * 0.0025);
  const trailPercent = Math.max(0.004, Math.min(0.025, 0.008 + (100 - confidence) / 2000));
  const rewardMultiplier = pattern === "breakout" || pattern === "trend" ? 2.2 : pattern === "compression" ? 2.5 : 1.8;

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
  const tradePlan = buildTradePlan(currentPrice, pattern.support, pattern.resistance, pattern.direction, pattern.pattern, confidence);
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
  const symbols = ["AAPL", "IBM", "MSFT"];
  const rows = [];

  for (const symbol of symbols) {
    try {
      const quote = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=demo`).then((r) => r.json());
      const q = quote["Global Quote"];
      if (!q) {
        continue;
      }

      const price = Number(q["05. price"] || 0);
      const changePercentRaw = String(q["10. change percent"] || "0").replace("%", "");
      const changePercent = Number(changePercentRaw || 0);

      if (!Number.isFinite(price) || price <= 0) {
        continue;
      }

      rows.push({
        symbol,
        name: symbol,
        price,
        changePercent,
        rationale: "Live quote via Alpha Vantage demo endpoint",
        sector: "Market",
        score: Math.max(50, Math.min(90, Math.round(Math.abs(changePercent) * 8 + 58))),
        factorScores: {
          momentum: Math.max(50, Math.min(90, Math.round(Math.abs(changePercent) * 10 + 55))),
          volatility: 60,
          sentiment: 56,
          participation: 54
        }
      });
    } catch {
      continue;
    }
  }

  return { data: rows };
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

    if (path === "/api/market/best-shares") {
      return json(200, await getLiveShares());
    }

    if (path === "/api/market/history") {
      if (method !== "POST") {
        return json(405, { error: "Method not allowed" });
      }

      const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body || {};
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
