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
  source?: "live" | "fallback";
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

export type MarketHistoryTimeframe = "1hour" | "4hour" | "12hour" | "1Day" | "1Week";

export type MarketHistorySource = "live" | "derived" | "fallback" | "mixed";

export type MarketPatternKind = "trend" | "range" | "breakout" | "reversal" | "momentum" | "compression";

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

export type MarketPatternSignal = {
  symbol: string;
  name: string;
  category: "forex" | "commodity" | "oil";
  timeframe: MarketHistoryTimeframe;
  pattern: MarketPatternKind;
  direction: "up" | "down" | "neutral";
  confidence: number;
  support: number;
  resistance: number;
  latestClose: number;
  sampleSize: number;
  source: MarketHistorySource;
  candlestickPattern?: CandlestickPattern;
  candlestickBias?: "up" | "down" | "neutral";
  candlestickImpactScore?: number;
  volumeRatio?: number | null;
  volumeImpactScore?: number;
  trendImpactScore?: number;
  historicalRecurrenceScore?: number;
  historicalRecurrenceSummary?: string;
  volumeConfirmation?: "strong" | "weak" | "neutral" | "unavailable";
  isAtSupport?: boolean;
  isAtResistance?: boolean;
  note: string;
};

export type MarketHistoryFrame = {
  candles: OhlcCandle[];
  source: MarketHistorySource;
  note?: string;
};

export type MarketHistoryResponse = {
  data: Record<string, Partial<Record<MarketHistoryTimeframe, MarketHistoryFrame>>>;
  patterns: MarketPatternSignal[];
  source: MarketHistorySource;
  reason?: string;
  years: number;
  timeframes: MarketHistoryTimeframe[];
};

export type MarketAgentName = "Forex" | "Commodities" | "Oil";

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
  timeframe: MarketHistoryTimeframe;
  pattern: MarketPatternKind;
  confidence: number;
  calibratedConfidence?: number;
  calibrationSampleSize?: number;
  calibrationBucket?: string;
  candlestickPattern?: CandlestickPattern;
  candlestickBias?: "up" | "down" | "neutral";
  candlestickImpactScore?: number;
  volumeRatio?: number | null;
  volumeImpactScore?: number;
  trendImpactScore?: number;
  sentimentFlowImpactScore?: number;
  sentimentFlowSummary?: string;
  sentimentFlowBreakdown?: {
    cotReport: number;
    interestRateDifferential: number;
    centralBankCommentary: number;
    riskOnRiskOff: number;
    optionsMarket: number;
    retailPositioning: number;
    economicCalendar: number;
    source: "proxy";
  };
  volumeConfirmation?: "strong" | "weak" | "neutral" | "unavailable";
  isAtSupport?: boolean;
  isAtResistance?: boolean;
  direction: "up" | "down" | "neutral";
  currentPrice: number;
  lastOccurrenceAt: string;
  source: MarketHistorySource;
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
  category: "forex" | "commodity" | "oil";
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
  source: MarketHistorySource;
  reason?: string;
  generatedAt: string;
};

export type ForexTradeMonitoringStatus = "tp-hit" | "sl-hit" | "open";

export type ForexTradeMonitoringItem = {
  tradeId: string;
  symbol: string;
  timeframe: MarketHistoryTimeframe;
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
  monitoringDayKey: string;
  monitoringTimeZone: string;
  confidenceThreshold: number;
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

export type Mt4Position = {
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  profit: number;
  stopLoss?: number;
  takeProfit?: number;
};

export type Mt4PendingOrder = {
  symbol: string;
  type: "BUY_LIMIT" | "BUY_STOP" | "SELL_LIMIT" | "SELL_STOP";
  price: number;
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
};

export type Mt4Quote = {
  symbol: string;
  bid: number;
  ask: number;
  spread?: number;
  timestamp: string;
};

export type Mt4Snapshot = {
  accountId: string;
  terminalId: string;
  server?: string;
  timestamp: string;
  heartbeat?: number;
  balance?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  positions?: Mt4Position[];
  pendingOrders?: Mt4PendingOrder[];
  quotes?: Mt4Quote[];
};

export type Mt4SnapshotResponse = Mt4Snapshot & {
  source: "mt4";
  receivedAt: string;
  ageSeconds: number;
  healthStatus: "fresh" | "stale" | "offline";
  healthNote: string;
};

export type Mt4QuoteFeedResponse = {
  source: "mt4";
  receivedAt: string;
  timestamp: string;
  heartbeat?: number;
  ageSeconds: number;
  healthStatus: "fresh" | "stale" | "offline";
  healthNote: string;
  quotes: Mt4Quote[];
};
