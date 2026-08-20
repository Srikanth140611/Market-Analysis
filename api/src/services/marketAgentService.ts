import { getLiveForexSpotPrice } from "./marketService.js";
import { getMarketHistory, type HistoryTimeframe, type MarketAssetCategory, type MarketPatternSignal, type HistorySource } from "./marketHistoryService.js";

export type MarketAgentName = "Forex" | "Commodities" | "Oil";

export type MarketPatternKind = "trend" | "range" | "breakout" | "reversal" | "momentum" | "compression";

export type MarketAgentAnalysisTimeframe = HistoryTimeframe;

export type MarketAgentTradePlan = {
  entry: number;
  stopLoss: number;
  takeProfit: number;
  trailingStopLoss: number;
  trailingStopPercent: number;
  riskRewardRatio: number;
};

export type MarketAgentTechnicalAnalysis = {
  ema20: number;
  ema50: number;
  sma50: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerWidthPercent: number;
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
  support: number;
  resistance: number;
  volatilityPercent: number;
  trendStrength: number;
  summary: string;
};

export type MarketAgentFundamentalAnalysis = {
  bias: "bullish" | "bearish" | "neutral";
  macroScore: number;
  summary: string;
  drivers: string[];
  risks: string[];
  catalystWindow: string;
};

export type MarketAgentDeepDiveDimension = {
  skillDimensions: string[];
  confluenceScore: number;
  setupQuality: "high" | "medium" | "watchlist";
  technicalFocus: string[];
  fundamentalFocus: string[];
};

export type MarketAgentTimeframeSignal = {
  timeframe: MarketAgentAnalysisTimeframe;
  pattern: MarketPatternKind;
  confidence: number;
  direction: "up" | "down" | "neutral";
  currentPrice: number;
  lastOccurrenceAt: string;
  source: HistorySource;
  strategySummary: string;
  strategiesApplied: string[];
  tradePlan: MarketAgentTradePlan;
  support: number;
  resistance: number;
  note: string;
  technicals: MarketAgentTechnicalAnalysis;
  fundamentals: MarketAgentFundamentalAnalysis;
  deepDive: MarketAgentDeepDiveDimension;
};

export type MarketAgentSymbolReport = {
  symbol: string;
  name: string;
  currentPrice: number;
  bestSignal: MarketAgentTimeframeSignal;
  timeframeSignals: MarketAgentTimeframeSignal[];
};

export type MarketAgentReport = {
  agent: MarketAgentName;
  category: MarketAssetCategory;
  symbols: MarketAgentSymbolReport[];
  bestSignal: MarketAgentTimeframeSignal;
  summary: string;
  strategySummary: string;
  deepDive: MarketAgentDeepDiveDimension;
  rag: {
    context: string;
    documents: string[];
  };
  knowledgeGraph: {
    nodes: string[];
    edges: string[];
  };
  generatedAt: string;
};

export type MarketAgentsResponse = {
  data: MarketAgentReport[];
  source: "live" | "derived" | "mixed" | "fallback";
  reason?: string;
  generatedAt: string;
};

export type ForexTradeMonitoringStatus = "tp-hit" | "sl-hit" | "open";

export type ForexTradeMonitoringItem = {
  tradeId: string;
  symbol: string;
  timeframe: MarketAgentAnalysisTimeframe;
  direction: "up" | "down" | "neutral";
  entry: number;
  stopLoss: number;
  takeProfit: number;
  currentPrice: number;
  riskRewardRatio: number;
  status: ForexTradeMonitoringStatus;
  openedAt: string;
  closedAt?: string;
  closePrice?: number;
};

export type ForexTradeMonitoringReport = {
  totalTrades: number;
  tpHitCount: number;
  slHitCount: number;
  openCount: number;
  closedTrades: number;
  activeTrades: number;
  resolvedTrades: number;
  winRatePercent: number;
  generatedAt: string;
  items: ForexTradeMonitoringItem[];
};

export type ForexTradeMonitoringDailySnapshot = {
  date: string;
  openedTrades: number;
  totalTrades: number;
  tpHitCount: number;
  slHitCount: number;
  openCount: number;
  resolvedTrades: number;
  winRatePercent: number | null;
  hasData: boolean;
  generatedAt: string;
};

export type ForexTradeMonitoringHistoryReport = {
  daysRequested: number;
  observedDays: number;
  totalTpHitCount: number;
  totalSlHitCount: number;
  totalResolvedTrades: number;
  overallWinRatePercent: number | null;
  generatedAt: string;
  daily: ForexTradeMonitoringDailySnapshot[];
};

const AGENT_CONFIG: Array<{
  agent: MarketAgentName;
  category: MarketAssetCategory;
  symbols: string[];
  summaryPrefix: string;
}> = [
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

const ANALYSIS_TIMEFRAMES: MarketAgentAnalysisTimeframe[] = ["1hour", "4hour", "12hour", "1Day", "1Week"];

const TIMEFRAME_WEIGHTS: Record<MarketAgentAnalysisTimeframe, number> = {
  "1hour": 5,
  "4hour": 4,
  "12hour": 3,
  "1Day": 2,
  "1Week": 1
};

const forexTradeLedger = new Map<string, ForexTradeMonitoringItem>();

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toISOString();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toUtcDayKey(timestamp: string) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function buildSimulatedTradeId(symbol: string, signal: MarketAgentTimeframeSignal) {
  return [
    symbol,
    signal.timeframe,
    signal.direction,
    toUtcDayKey(signal.lastOccurrenceAt)
  ].join(":");
}

function normalizeTradeLedger() {
  const normalized = new Map<string, ForexTradeMonitoringItem>();

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

function resolveForexRewardMultiplier(timeframe: MarketAgentAnalysisTimeframe, pattern: MarketPatternKind, confidence: number) {
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
  const timeframeBonus: Record<MarketAgentAnalysisTimeframe, number> = {
    "1hour": 0,
    "4hour": 0.2,
    "12hour": 0.5,
    "1Day": 0.9,
    "1Week": 1.3
  };

  return clamp(patternBase + confidenceBonus + timeframeBonus[timeframe], 2, 5);
}

function ema(values: number[], period: number) {
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

function sma(values: number[], period: number) {
  if (values.length === 0) {
    return 0;
  }

  const slice = values.slice(-Math.min(period, values.length));
  return slice.reduce((sum, value) => sum + value, 0) / slice.length;
}

function standardDeviation(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function buildMacd(values: number[]) {
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

function strategiesForPattern(pattern: MarketPatternKind, direction: "up" | "down" | "neutral", category: MarketAssetCategory, symbol: string) {
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

function buildTradePlan(price: number, support: number, resistance: number, direction: "up" | "down" | "neutral", pattern: MarketPatternKind, confidence: number, timeframe: MarketAgentAnalysisTimeframe, marketCategory?: MarketAssetCategory): MarketAgentTradePlan {
  const isForex = marketCategory === "forex";
  const range = Math.max(resistance - support, price * 0.0025);
  const trailPercent = isForex ? 0.0015 : clamp(0.008 + (100 - confidence) / 2000, 0.004, 0.025);
  const rewardMultiplier = isForex
    ? resolveForexRewardMultiplier(timeframe, pattern, confidence)
    : pattern === "breakout" || pattern === "trend"
      ? 2.2
      : pattern === "compression"
        ? 2.5
        : 1.8;

  if (isForex) {
    const stopDistance = clamp(price * 0.0012, 0.0008, price * 0.003);
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

function buildTechnicalAnalysis(symbol: string, timeframe: MarketAgentAnalysisTimeframe, candles: { t: number; o: number; h: number; l: number; c: number }[], support: number, resistance: number): MarketAgentTechnicalAnalysis {
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

function buildFundamentalAnalysis(category: MarketAssetCategory, symbol: string, direction: "up" | "down" | "neutral"): MarketAgentFundamentalAnalysis {
  const bullish = direction === "up";
  const bearish = direction === "down";

  if (category === "forex") {
    const pairProfiles: Record<string, { drivers: string[]; risks: string[]; bullishSummary: string; bearishSummary: string }> = {
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
    const profile = pairProfiles[symbol] ?? {
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

function buildDeepDiveDimension(
  technicals: MarketAgentTechnicalAnalysis,
  fundamentals: MarketAgentFundamentalAnalysis,
  pattern: MarketPatternSignal,
  strategiesApplied: string[]
): MarketAgentDeepDiveDimension {
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

function strategySummary(pattern: MarketPatternSignal, direction: "up" | "down" | "neutral", technicals: MarketAgentTechnicalAnalysis, fundamentals: MarketAgentFundamentalAnalysis) {
  const trendNote = direction === "up"
    ? "Bias is bullish until price loses support."
    : direction === "down"
      ? "Bias is bearish until price reclaims resistance."
      : "Bias is neutral pending confirmation.";

  return `${pattern.pattern.toUpperCase()} on ${pattern.symbol} (${pattern.timeframe}) with ${Math.round(pattern.confidence)}% confidence. ${trendNote} ${technicals.summary} ${fundamentals.summary}`;
}

function buildSignal(
  symbol: string,
  category: MarketAssetCategory,
  timeframe: MarketAgentAnalysisTimeframe,
  pattern: MarketPatternSignal,
  candles: { t: number; o: number; h: number; l: number; c: number }[],
  source: HistorySource,
  liveSpotPrice?: number | null
): MarketAgentTimeframeSignal {
  const latestCandle = candles[candles.length - 1] ?? null;
  const currentPrice = liveSpotPrice ?? latestCandle?.c ?? pattern.latestClose;
  const lastOccurrenceAt = latestCandle ? formatTimestamp(latestCandle.t > 1e12 ? latestCandle.t : latestCandle.t * 1000) : new Date().toISOString();
  const confidence = Math.round(pattern.confidence);
  const strategiesApplied = strategiesForPattern(pattern.pattern, pattern.direction, category, symbol);
  const tradePlan = buildTradePlan(currentPrice, pattern.support, pattern.resistance, pattern.direction, pattern.pattern, confidence, timeframe, category);
  const technicals = buildTechnicalAnalysis(symbol, timeframe, candles, pattern.support, pattern.resistance);
  const fundamentals = buildFundamentalAnalysis(category, symbol, pattern.direction);
  const deepDive = buildDeepDiveDimension(technicals, fundamentals, pattern, strategiesApplied);

  return {
    timeframe,
    pattern: pattern.pattern,
    confidence,
    direction: pattern.direction,
    currentPrice: roundTo(currentPrice),
    lastOccurrenceAt,
    source,
    strategySummary: strategySummary(pattern, pattern.direction, technicals, fundamentals),
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

function pickBestSignal(signals: MarketAgentTimeframeSignal[]) {
  return signals.reduce((best, signal) => {
    const score = signal.confidence + TIMEFRAME_WEIGHTS[signal.timeframe] + signal.deepDive.confluenceScore / 10;
    const bestScore = best.confidence + TIMEFRAME_WEIGHTS[best.timeframe] + best.deepDive.confluenceScore / 10;
    if (score > bestScore) {
      return signal;
    }
    return best;
  }, signals[0]);
}

function categoryName(category: MarketAssetCategory) {
  if (category === "forex") {
    return "Forex";
  }
  if (category === "commodity") {
    return "Commodities";
  }
  return "Oil";
}

export async function getMarketAgentsAnalysis(): Promise<MarketAgentsResponse> {
  const reports: MarketAgentReport[] = [];
  const sources = new Set<HistorySource>();
  const generatedAt = new Date().toISOString();

  for (const config of AGENT_CONFIG) {
    const history = await getMarketHistory(config.symbols, ANALYSIS_TIMEFRAMES, 5);
    const symbolReports: MarketAgentSymbolReport[] = [];
    const agentSignals: MarketAgentTimeframeSignal[] = [];

    for (const symbol of config.symbols) {
      const liveSpotPrice = config.category === "forex" ? await getLiveForexSpotPrice(symbol) : null;
      const symbolHistory = history.data[symbol] ?? {};
      const timeframeSignals = ANALYSIS_TIMEFRAMES
        .map((timeframe) => {
          const frame = symbolHistory[timeframe];
          const pattern = history.patterns.find((item) => item.symbol === symbol && item.timeframe === timeframe);
          if (!frame || !pattern) {
            return null;
          }

          sources.add(frame.source);
          return buildSignal(symbol, config.category, timeframe, pattern, frame.candles, frame.source, liveSpotPrice);
        })
        .filter((signal): signal is MarketAgentTimeframeSignal => Boolean(signal));

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
    const summary = `${config.summaryPrefix} ${categoryName(config.category)} currently leans ${marketBias.toUpperCase()} with ${bestSignal.pattern} structure on ${bestSignal.timeframe}. Confluence ${bestSignal.deepDive.confluenceScore} with ${bestSignal.deepDive.setupQuality} setup quality.`;
    const ragContext = `RAG placeholder: ${categoryName(config.category)} signal set built from live and derived price history, enriched with EMA20, EMA50, SMA50, Bollinger bands, MACD, support/resistance, and macro catalyst mapping for ${config.symbols.join(", ")}.`;
    const knowledgeGraph = {
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
    };

    reports.push({
      agent: config.agent,
      category: config.category,
      symbols: symbolReports,
      bestSignal,
      summary,
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
      knowledgeGraph,
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

function evaluateTradeStatusByLevels(direction: "up" | "down" | "neutral", stopLoss: number, takeProfit: number, currentPrice: number): ForexTradeMonitoringStatus {
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

function upsertSimulatedTradesFromForexAgent(forex: MarketAgentReport, generatedAt: string) {
  normalizeTradeLedger();

  for (const symbolReport of forex.symbols) {
    for (const signal of symbolReport.timeframeSignals) {
      if (signal.direction === "neutral") {
        continue;
      }

      const tradeId = buildSimulatedTradeId(symbolReport.symbol, signal);
      const existing = forexTradeLedger.get(tradeId);

      if (!existing) {
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
  }

  trimTradeLedger();
}

function updateOpenTradesWithCurrentPrices(forex: MarketAgentReport, generatedAt: string) {
  const priceBySymbol = new Map<string, number>();
  for (const symbolReport of forex.symbols) {
    priceBySymbol.set(symbolReport.symbol, symbolReport.currentPrice);
  }

  for (const [tradeId, trade] of forexTradeLedger.entries()) {
    if (trade.status !== "open") {
      continue;
    }

    const price = priceBySymbol.get(trade.symbol);
    if (typeof price !== "number" || !Number.isFinite(price)) {
      continue;
    }

    const currentPrice = price;
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

export async function getForexTradeMonitoringReport(): Promise<ForexTradeMonitoringReport> {
  const agents = await getMarketAgentsAnalysis();
  const forex = agents.data.find((agent) => agent.agent === "Forex");
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

  upsertSimulatedTradesFromForexAgent(forex, generatedAt);
  updateOpenTradesWithCurrentPrices(forex, generatedAt);

  const items = Array.from(forexTradeLedger.values()).sort((left, right) => {
    return new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime();
  });

  const tpHitCount = items.filter((item) => item.status === "tp-hit").length;
  const slHitCount = items.filter((item) => item.status === "sl-hit").length;
  const openCount = items.filter((item) => item.status === "open").length;
  const closedTrades = tpHitCount + slHitCount;
  const resolvedTrades = tpHitCount + slHitCount;
  const winRatePercent = resolvedTrades > 0 ? roundTo((tpHitCount / resolvedTrades) * 100, 2) : 0;

  return {
    totalTrades: items.length,
    tpHitCount,
    slHitCount,
    openCount,
    closedTrades,
    activeTrades: openCount,
    resolvedTrades,
    winRatePercent,
    generatedAt,
    items
  };
}

function buildHistoryDateRange(daysRequested: number) {
  const end = new Date();
  const days: string[] = [];

  for (let index = daysRequested - 1; index >= 0; index -= 1) {
    const current = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    current.setUTCDate(current.getUTCDate() - index);
    days.push(current.toISOString().slice(0, 10));
  }

  return days;
}

export async function getForexTradeMonitoringHistoryReport(days = 10): Promise<ForexTradeMonitoringHistoryReport> {
  const daysRequested = clamp(Math.round(days), 1, 30);

  // Refresh/open simulated trades before building rolling history.
  await getForexTradeMonitoringReport();

  const dayKeys = buildHistoryDateRange(daysRequested);
  const daily = dayKeys.map((dayKey): ForexTradeMonitoringDailySnapshot => {
    const openedTrades = Array.from(forexTradeLedger.values()).filter((item) => toUtcDayKey(item.openedAt) === dayKey).length;
    const tpHitCount = Array.from(forexTradeLedger.values()).filter((item) => item.status === "tp-hit" && item.closedAt && toUtcDayKey(item.closedAt) === dayKey).length;
    const slHitCount = Array.from(forexTradeLedger.values()).filter((item) => item.status === "sl-hit" && item.closedAt && toUtcDayKey(item.closedAt) === dayKey).length;
    const openCount = Array.from(forexTradeLedger.values()).filter((item) => item.status === "open" && toUtcDayKey(item.openedAt) === dayKey).length;
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
  const totalTpHitCount = daily.reduce((sum, item) => sum + item.tpHitCount, 0);
  const totalSlHitCount = daily.reduce((sum, item) => sum + item.slHitCount, 0);
  const totalResolvedTrades = totalTpHitCount + totalSlHitCount;
  const overallWinRatePercent = totalResolvedTrades > 0 ? roundTo((totalTpHitCount / totalResolvedTrades) * 100, 2) : null;

  return {
    daysRequested,
    observedDays,
    totalTpHitCount,
    totalSlHitCount,
    totalResolvedTrades,
    overallWinRatePercent,
    generatedAt: new Date().toISOString(),
    daily
  };
}
