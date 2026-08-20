import { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { fetchMarketAgents, fetchMt4Quotes } from "../api/client";
import { API_BASE_URL, REFRESH_INTERVAL_MS } from "../constants";
import { usePollingData } from "../hooks/usePollingData";
import { theme } from "../theme";
import { SectionCard } from "../components/SectionCard";
import { MarketAgentReport, MarketAgentTimeframeSignal, Mt4Quote } from "../types";

const TIMEFRAME_ORDER: Record<string, number> = {
  "1hour": 1,
  "4hour": 2,
  "12hour": 3,
  "1Day": 4,
  "1Week": 5
};

const AGENT_MENU = [
  { key: "forex", label: "Forex Signal Analysis", match: "Forex" },
  { key: "commodities", label: "Commodities Analysis", match: "Commodities" },
  { key: "oil", label: "Oil Analysis", match: "Oil" }
] as const;
const MT4_QUOTES_REFRESH_MS = Platform.OS === "web" ? 5_000 : 3_000;

function sourceColor(source: string) {
  if (source === "live") {
    return theme.colors.positive;
  }

  if (source === "derived") {
    return theme.colors.warning;
  }

  if (source === "mixed") {
    return theme.colors.accent;
  }

  return theme.colors.negative;
}

function directionColor(direction: string) {
  if (direction === "up") {
    return theme.colors.positive;
  }

  if (direction === "down") {
    return theme.colors.negative;
  }

  return theme.colors.warning;
}

function formatPrice(value: number) {
  return value > 20 ? value.toFixed(2) : value.toFixed(4);
}

function normalizeForexSymbol(symbol: string) {
  return symbol.toUpperCase().replace(/[^A-Z]/g, "");
}

function findMt4Quote(symbol: string, quotesBySymbol: Map<string, Mt4Quote>) {
  const normalized = normalizeForexSymbol(symbol);
  const direct = quotesBySymbol.get(normalized);
  if (direct) {
    return direct;
  }

  for (const [key, quote] of quotesBySymbol.entries()) {
    if (key.startsWith(normalized) || normalized.startsWith(key)) {
      return quote;
    }
  }

  return null;
}

function formatForexQuote(symbol: string, value: number) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  if (symbol.includes("JPY")) {
    return value.toFixed(3);
  }

  return value.toFixed(5);
}

function formatSigned(value: number, decimals = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(decimals)}`;
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatAestTimestamp(timestamp?: string) {
  if (!timestamp) {
    return "-";
  }

  try {
    return new Date(timestamp).toLocaleString([], {
      timeZone: "Australia/Sydney",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

function quoteFreshnessColor(timestamp?: string) {
  if (!timestamp) {
    return theme.colors.muted;
  }

  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return theme.colors.muted;
  }

  const ageMs = Date.now() - parsed;
  if (ageMs <= 10_000) {
    return theme.colors.positive;
  }

  if (ageMs <= 30_000) {
    return theme.colors.warning;
  }

  return theme.colors.negative;
}

function estimateBuyPrice(signal: MarketAgentTimeframeSignal) {
  const spread = Math.max(0.00008, Math.min(0.00022, signal.currentPrice * 0.00012));
  return signal.currentPrice + spread / 2;
}

function estimateSellPrice(signal: MarketAgentTimeframeSignal) {
  const spread = Math.max(0.00008, Math.min(0.00022, signal.currentPrice * 0.00012));
  return signal.currentPrice - spread / 2;
}

function confidenceNarrative(signal: MarketAgentTimeframeSignal) {
  const pieces = [
    `${signal.pattern.toUpperCase()} pattern confidence ${signal.confidence}%`,
    `Confluence ${signal.deepDive.confluenceScore}`,
    `MACD histogram ${formatSigned(signal.technicals.macdHistogram, 4)}`,
    `EMA20 vs EMA50 ${formatPrice(signal.technicals.ema20)} / ${formatPrice(signal.technicals.ema50)}`,
    `Fundamental bias ${signal.fundamentals.bias.toUpperCase()} (${signal.fundamentals.macroScore})`
  ];
  return pieces.join(" | ");
}

function AgentSignalCard({ signal }: { signal: MarketAgentTimeframeSignal }) {
  return (
    <View style={styles.signalCard}>
      <View style={styles.signalTopRow}>
        <Text style={styles.signalTimeframe}>{signal.timeframe}</Text>
        <Text style={[styles.signalDirection, { color: directionColor(signal.direction) }]}>
          {signal.pattern.toUpperCase()} | {signal.direction.toUpperCase()} | {signal.confidence}%
        </Text>
      </View>
      <Text style={styles.signalMeta}>Occurred {formatTimestamp(signal.lastOccurrenceAt)}</Text>
      <Text style={styles.signalMeta}>Price {formatPrice(signal.currentPrice)} | Source {signal.source}</Text>
      <Text style={styles.signalNote}>{signal.strategySummary}</Text>
      <Text style={styles.signalNote}>
        Entry {formatPrice(signal.tradePlan.entry)} | SL {formatPrice(signal.tradePlan.stopLoss)} | TP {formatPrice(signal.tradePlan.takeProfit)} | Trailing SL {formatPrice(signal.tradePlan.trailingStopLoss)}
      </Text>
      <Text style={styles.signalMeta}>RR {signal.tradePlan.riskRewardRatio.toFixed(2)} | Trail {signal.tradePlan.trailingStopPercent.toFixed(2)}%</Text>
      <Text style={styles.signalMeta}>
        EMA20 {formatPrice(signal.technicals.ema20)} | EMA50 {formatPrice(signal.technicals.ema50)} | SMA50 {formatPrice(signal.technicals.sma50)}
      </Text>
      <Text style={styles.signalMeta}>
        MACD {formatSigned(signal.technicals.macdLine, 4)} / Signal {formatSigned(signal.technicals.macdSignal, 4)} / Hist {formatSigned(signal.technicals.macdHistogram, 4)}
      </Text>
      <Text style={styles.signalMeta}>
        Bollinger U {formatPrice(signal.technicals.bollingerUpper)} | M {formatPrice(signal.technicals.bollingerMiddle)} | L {formatPrice(signal.technicals.bollingerLower)}
      </Text>
      <Text style={styles.signalMeta}>
        Vol {signal.technicals.volatilityPercent.toFixed(2)}% | Trend strength {signal.technicals.trendStrength.toFixed(2)} | Confluence {signal.deepDive.confluenceScore}
      </Text>
      <Text style={styles.signalMeta}>Fundamental bias {signal.fundamentals.bias.toUpperCase()} | Macro {signal.fundamentals.macroScore}</Text>
      <Text style={styles.signalNote}>{signal.fundamentals.summary}</Text>
      <Text style={styles.signalMeta}>Drivers: {signal.fundamentals.drivers.join(" | ")}</Text>
      <Text style={styles.signalMeta}>Risks: {signal.fundamentals.risks.join(" | ")}</Text>
      <Text style={styles.signalMeta}>Catalyst window: {signal.fundamentals.catalystWindow}</Text>
      <Text style={styles.signalStrategies}>Strategies: {signal.strategiesApplied.join(" | ")}</Text>
    </View>
  );
}

function AgentCard({
  agent,
  expandedSymbols,
  onToggleSymbol,
  selectedAnalysisKey,
  onToggleAnalysis,
  quotesBySymbol,
  mt4QuotesFresh
}: {
  agent: MarketAgentReport;
  expandedSymbols: Record<string, boolean>;
  onToggleSymbol: (key: string) => void;
  selectedAnalysisKey: string | null;
  onToggleAnalysis: (key: string) => void;
  quotesBySymbol: Map<string, Mt4Quote>;
  mt4QuotesFresh: boolean;
}) {
  const isForexAgent = agent.agent === "Forex";

  return (
    <View style={styles.agentCard}>
      <View style={styles.agentHeader}>
        <View>
          <Text style={styles.agentLabel}>{agent.agent}</Text>
          <Text style={styles.agentSubtitle}>{agent.category.toUpperCase()} agent</Text>
        </View>
        <Text style={[styles.sourceBadge, { color: sourceColor(agent.bestSignal.source) }]}>
          {agent.bestSignal.source}
        </Text>
      </View>

      <Text style={[styles.bestSignal, { color: directionColor(agent.bestSignal.direction) }]}>
        Best: {agent.bestSignal.pattern.toUpperCase()} on {agent.bestSignal.timeframe} | {agent.bestSignal.confidence}%
      </Text>
      <Text style={styles.description}>{agent.summary}</Text>
      <Text style={styles.description}>{agent.strategySummary}</Text>
      <Text style={styles.description}>Setup quality {agent.deepDive.setupQuality.toUpperCase()} | Confluence {agent.deepDive.confluenceScore}</Text>

      <View style={styles.kpiRow}>
        <Text style={styles.kpi}>Support {formatPrice(agent.bestSignal.support)}</Text>
        <Text style={styles.kpi}>Resistance {formatPrice(agent.bestSignal.resistance)}</Text>
        <Text style={styles.kpi}>Occurred {formatTimestamp(agent.bestSignal.lastOccurrenceAt)}</Text>
      </View>

      <Text style={styles.riskText}>
        Entry {formatPrice(agent.bestSignal.tradePlan.entry)} | SL {formatPrice(agent.bestSignal.tradePlan.stopLoss)} | TP {formatPrice(agent.bestSignal.tradePlan.takeProfit)} | Trailing SL {formatPrice(agent.bestSignal.tradePlan.trailingStopLoss)}
      </Text>

      <View style={styles.placeholderRow}>
        <Text style={styles.placeholderTitle}>Technical Deep Dive</Text>
        <Text style={styles.placeholderText}>{agent.bestSignal.technicals.summary}</Text>
        <Text style={styles.placeholderText}>Focus: {agent.deepDive.technicalFocus.join(" | ")}</Text>
        <Text style={styles.placeholderTitle}>Fundamental Deep Dive</Text>
        <Text style={styles.placeholderText}>{agent.bestSignal.fundamentals.summary}</Text>
        <Text style={styles.placeholderText}>Drivers: {agent.bestSignal.fundamentals.drivers.join(" | ")}</Text>
        <Text style={styles.placeholderText}>Risks: {agent.bestSignal.fundamentals.risks.join(" | ")}</Text>
        <Text style={styles.placeholderText}>Catalyst window: {agent.bestSignal.fundamentals.catalystWindow}</Text>
      </View>

      {isForexAgent ? (
        <View style={styles.forexTableBlock}>
          <Text style={styles.forexTableTitle}>Forex Live Signals Agent</Text>
          <Text style={styles.forexTableHint}>Risk-reward profile: minimum 1:2, dynamic up to 1:5</Text>
          <Text style={styles.forexTableHint}>
            Bid/Ask source: {mt4QuotesFresh ? "MT4 realtime feed" : "derived from market signal price"}
          </Text>
          <View style={styles.forexTableHeaderRow}>
            <Text style={[styles.forexHeaderCell, styles.cellPair]}>Currency Pair</Text>
            <Text style={[styles.forexHeaderCell, styles.cellPrice]}>Live Buy Price</Text>
            <Text style={[styles.forexHeaderCell, styles.cellPrice]}>Live Sell Price</Text>
            <Text style={[styles.forexHeaderCell, styles.cellLiveTime]}>Live Time (AEST)</Text>
            <Text style={[styles.forexHeaderCell, styles.cellTimeframe]}>Time Frame</Text>
            <Text style={[styles.forexHeaderCell, styles.cellTrend]}>Trend</Text>
            <Text style={[styles.forexHeaderCell, styles.cellSignal]}>Signal</Text>
            <Text style={[styles.forexHeaderCell, styles.cellConfidence]}>Confidence</Text>
            <Text style={[styles.forexHeaderCell, styles.cellPrice]}>Entry</Text>
            <Text style={[styles.forexHeaderCell, styles.cellPrice]}>Stop loss</Text>
            <Text style={[styles.forexHeaderCell, styles.cellPrice]}>Take profit</Text>
            <Text style={[styles.forexHeaderCell, styles.cellRr]}>R:R</Text>
            <Text style={[styles.forexHeaderCell, styles.cellAnalysis]}>Analysis</Text>
          </View>

          {agent.symbols.map((symbol) => {
            const signal = symbol.bestSignal;
            const mt4Quote = findMt4Quote(symbol.symbol, quotesBySymbol);
            const liveBuy = mt4Quote?.ask ?? estimateBuyPrice(signal);
            const liveSell = mt4Quote?.bid ?? estimateSellPrice(signal);
            const analysisKey = `${agent.agent}:${symbol.symbol}:${signal.timeframe}`;
            const analysisOpen = selectedAnalysisKey === analysisKey;

            return (
              <View key={symbol.symbol} style={styles.forexRowWrap}>
                <View style={styles.forexTableRow}>
                  <Text style={[styles.forexCell, styles.cellPair]}>
                    {symbol.symbol}
                    {"\n"}
                    <Text style={styles.inlineLiveTime}>AEST {formatAestTimestamp(mt4Quote?.timestamp)}</Text>
                  </Text>
                  <Text style={[styles.forexCell, styles.cellPrice]}>{formatForexQuote(symbol.symbol, liveBuy)}</Text>
                  <Text style={[styles.forexCell, styles.cellPrice]}>{formatForexQuote(symbol.symbol, liveSell)}</Text>
                  <Text
                    style={[
                      styles.forexCell,
                      styles.cellLiveTime,
                      { color: quoteFreshnessColor(mt4Quote?.timestamp) }
                    ]}
                  >
                    {formatAestTimestamp(mt4Quote?.timestamp)}
                  </Text>
                  <Text style={[styles.forexCell, styles.cellTimeframe]}>{signal.timeframe}</Text>
                  <Text style={[styles.forexCell, styles.cellTrend, { color: directionColor(signal.direction) }]}>{signal.direction.toUpperCase()}</Text>
                  <Text style={[styles.forexCell, styles.cellSignal]}>{signal.pattern.toUpperCase()}</Text>
                  <Text style={[styles.forexCell, styles.cellConfidence]}>{signal.confidence}%</Text>
                  <Text style={[styles.forexCell, styles.cellPrice]}>{formatPrice(signal.tradePlan.entry)}</Text>
                  <Text style={[styles.forexCell, styles.cellPrice]}>{formatPrice(signal.tradePlan.stopLoss)}</Text>
                  <Text style={[styles.forexCell, styles.cellPrice]}>{formatPrice(signal.tradePlan.takeProfit)}</Text>
                  <Text style={[styles.forexCell, styles.cellRr]}>1:{signal.tradePlan.riskRewardRatio.toFixed(2)}</Text>
                  <Pressable
                    style={[styles.analysisButton, analysisOpen ? styles.analysisButtonActive : null]}
                    onPress={() => onToggleAnalysis(analysisKey)}
                  >
                    <Text style={[styles.analysisButtonText, analysisOpen ? styles.analysisButtonTextActive : null]}>
                      {analysisOpen ? "Hide" : "View"}
                    </Text>
                  </Pressable>
                </View>

                {analysisOpen ? (
                  <View style={styles.analysisPanel}>
                    <Text style={styles.analysisTitle}>{symbol.symbol} analysis</Text>
                    <Text style={styles.analysisText}>{confidenceNarrative(signal)}</Text>
                    <Text style={styles.analysisText}>Strategies: {signal.strategiesApplied.join(" | ")}</Text>
                    <Text style={styles.analysisText}>Technical: {signal.technicals.summary}</Text>
                    <Text style={styles.analysisText}>Fundamental: {signal.fundamentals.summary}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.symbolBlock}>
          {agent.symbols.map((symbol) => (
            <View key={symbol.symbol} style={styles.symbolCard}>
            <View style={styles.symbolHeader}>
              <Text style={styles.symbol}>{symbol.symbol}</Text>
              <Text style={styles.symbolPrice}>{formatPrice(symbol.currentPrice)}</Text>
            </View>
            <Text style={styles.symbolMeta}>Best timeframe {symbol.bestSignal.timeframe}</Text>
            <Text style={styles.symbolMeta}>
              {symbol.bestSignal.pattern.toUpperCase()} | {symbol.bestSignal.direction.toUpperCase()} | {symbol.bestSignal.confidence}%
            </Text>
            <Text style={styles.symbolMeta}>Occurred {formatTimestamp(symbol.bestSignal.lastOccurrenceAt)}</Text>
            <Text style={styles.symbolMeta}>
              Entry {formatPrice(symbol.bestSignal.tradePlan.entry)} | SL {formatPrice(symbol.bestSignal.tradePlan.stopLoss)} | TP {formatPrice(symbol.bestSignal.tradePlan.takeProfit)}
            </Text>
            <Text style={styles.symbolMeta}>
              EMA20 {formatPrice(symbol.bestSignal.technicals.ema20)} | EMA50 {formatPrice(symbol.bestSignal.technicals.ema50)} | SMA50 {formatPrice(symbol.bestSignal.technicals.sma50)}
            </Text>
            <Text style={styles.symbolMeta}>
              MACD Hist {formatSigned(symbol.bestSignal.technicals.macdHistogram, 4)} | Boll width {symbol.bestSignal.technicals.bollingerWidthPercent.toFixed(2)}%
            </Text>
            <Text style={styles.symbolMeta}>
              Fundamental {symbol.bestSignal.fundamentals.bias.toUpperCase()} | Macro {symbol.bestSignal.fundamentals.macroScore} | Setup {symbol.bestSignal.deepDive.setupQuality.toUpperCase()}
            </Text>

            {(() => {
              const symbolKey = `${agent.agent}:${symbol.symbol}`;
              const isExpanded = expandedSymbols[symbolKey] ?? false;
              const orderedSignals = [...symbol.timeframeSignals].sort((left, right) => {
                const leftOrder = TIMEFRAME_ORDER[left.timeframe] ?? 999;
                const rightOrder = TIMEFRAME_ORDER[right.timeframe] ?? 999;
                return leftOrder - rightOrder;
              });

              return (
                <View style={styles.timeframePanel}>
                  <Pressable
                    onPress={() => onToggleSymbol(symbolKey)}
                    style={[styles.toggleButton, isExpanded ? styles.toggleButtonActive : null]}
                  >
                    <Text style={[styles.toggleText, isExpanded ? styles.toggleTextActive : null]}>
                      {isExpanded ? "Hide timeframe details" : `Show all ${orderedSignals.length} timeframes`}
                    </Text>
                  </Pressable>

                  {isExpanded
                    ? orderedSignals.map((timeframeSignal) => (
                      <AgentSignalCard
                        key={`${symbol.symbol}:${timeframeSignal.timeframe}`}
                        signal={timeframeSignal}
                      />
                    ))
                    : <AgentSignalCard signal={symbol.bestSignal} />}
                </View>
              );
            })()}
            </View>
          ))}
        </View>
      )}

      <Text style={styles.minimizedContext}>RAG and knowledge graph context is condensed into the strategy and deep-dive panels above.</Text>
    </View>
  );
}

export function AgentsScreen() {
  const { data, loading, error } = usePollingData(fetchMarketAgents, REFRESH_INTERVAL_MS);
  const mt4QuotesFeed = usePollingData(fetchMt4Quotes, MT4_QUOTES_REFRESH_MS);
  const { width } = useWindowDimensions();
  const [expandedSymbols, setExpandedSymbols] = useState<Record<string, boolean>>({});
  const [selectedAnalysisKey, setSelectedAnalysisKey] = useState<string | null>(null);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>(AGENT_MENU[0].key);

  const agents = data?.data ?? [];
  const selectedMenu = AGENT_MENU.find((item) => item.key === selectedAgentKey) ?? AGENT_MENU[0];
  const selectedAgent = agents.find((agent) => agent.agent === selectedMenu.match) ?? agents[0] ?? null;
  const isCompactLayout = width < 900;
  const mt4Quotes = mt4QuotesFeed.data?.quotes ?? [];
  const mt4QuotesBySymbol = new Map(mt4Quotes.map((quote) => [normalizeForexSymbol(quote.symbol), quote] as const));
  const mt4QuotesFresh = mt4QuotesFeed.data?.healthStatus === "fresh" && mt4Quotes.length > 0;
  const monitoringReportLink = `${API_BASE_URL.replace(/\/$/, "")}/api/market/forex-monitoring-report?format=html`;
  const monitoringHistoryLink = `${API_BASE_URL.replace(/\/$/, "")}/api/market/forex-monitoring-history?days=10&format=html`;

  const toggleSymbol = (key: string) => {
    setExpandedSymbols((previous) => ({
      ...previous,
      [key]: !previous[key]
    }));
  };

  const toggleAnalysis = (key: string) => {
    setSelectedAnalysisKey((previous) => (previous === key ? null : key));
  };

  return (
    <View>
      <SectionCard title="3 Analysis Agents" subtitle="Forex, Commodities and Oil pattern intelligence with strategy levels">
        {loading ? <Text style={styles.muted}>Loading agent analysis...</Text> : null}
        {error && !data ? <Text style={styles.error}>{error}</Text> : null}
        {data ? (
          <Text style={[styles.source, { color: sourceColor(data.source) }]}>Source: {data.source}{data.reason ? ` (${data.reason})` : ""}</Text>
        ) : null}

        {agents.length > 0 ? (
          <View style={[styles.agentLayout, isCompactLayout ? styles.agentLayoutCompact : null]}>
            <View style={[styles.agentMenuPanel, isCompactLayout ? styles.agentMenuPanelCompact : null]}>
              {AGENT_MENU.map((item) => {
                const isActive = item.key === selectedMenu.key;
                const isAvailable = agents.some((agent) => agent.agent === item.match);

                return (
                  <Pressable
                    key={item.key}
                    style={[
                      styles.agentMenuButton,
                      isActive ? styles.agentMenuButtonActive : null,
                      !isAvailable ? styles.agentMenuButtonDisabled : null
                    ]}
                    onPress={() => setSelectedAgentKey(item.key)}
                    disabled={!isAvailable}
                  >
                    <Text style={[styles.agentMenuButtonText, isActive ? styles.agentMenuButtonTextActive : null]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.agentContentPanel}>
              {selectedAgent ? (
                <AgentCard
                  key={selectedAgent.agent}
                  agent={selectedAgent}
                  expandedSymbols={expandedSymbols}
                  onToggleSymbol={toggleSymbol}
                  selectedAnalysisKey={selectedAnalysisKey}
                  onToggleAnalysis={toggleAnalysis}
                  quotesBySymbol={mt4QuotesBySymbol}
                  mt4QuotesFresh={mt4QuotesFresh}
                />
              ) : (
                <Text style={styles.muted}>No agent data available.</Text>
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.monitoringLinksWrap}>
          <Text style={styles.monitoringLinksTitle}>Monitoring Links</Text>
          <Pressable onPress={() => void Linking.openURL(monitoringReportLink)}>
            <Text style={styles.monitoringLink} accessibilityRole="link">
              Forex Trade Monitoring Report (HTML)
            </Text>
          </Pressable>
          <Pressable onPress={() => void Linking.openURL(monitoringHistoryLink)}>
            <Text style={styles.monitoringLink} accessibilityRole="link">
              10-Day Forex Success Rate View (HTML)
            </Text>
          </Pressable>
        </View>
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: theme.colors.muted,
    marginBottom: 8
  },
  error: {
    color: theme.colors.negative,
    marginBottom: 8
  },
  source: {
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "700"
  },
  monitoringLinksWrap: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1f4358",
    paddingTop: 10
  },
  monitoringLinksTitle: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6
  },
  monitoringLink: {
    color: "#65b9ff",
    fontSize: 12,
    textDecorationLine: "underline",
    marginBottom: 6
  },
  agentLayout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  agentLayoutCompact: {
    flexDirection: "column"
  },
  agentMenuPanel: {
    width: 230,
    backgroundColor: "#0b1d29",
    borderWidth: 1,
    borderColor: "#1f4358",
    borderRadius: 12,
    padding: 10,
    gap: 8
  },
  agentMenuPanelCompact: {
    width: "100%"
  },
  agentMenuButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#24566f",
    backgroundColor: "#102b3b",
    paddingHorizontal: 10,
    paddingVertical: 10
  },
  agentMenuButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent
  },
  agentMenuButtonDisabled: {
    opacity: 0.45
  },
  agentMenuButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: "700"
  },
  agentMenuButtonTextActive: {
    color: "#03222f"
  },
  agentContentPanel: {
    flex: 1
  },
  agentCard: {
    borderWidth: 1,
    borderColor: "#1f4358",
    backgroundColor: "#0e2230",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12
  },
  agentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  agentLabel: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "800"
  },
  agentSubtitle: {
    color: theme.colors.muted,
    marginTop: 2,
    fontSize: 12
  },
  sourceBadge: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  bestSignal: {
    marginTop: 8,
    fontWeight: "800"
  },
  description: {
    color: theme.colors.text,
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17
  },
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  kpi: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  riskText: {
    color: theme.colors.accent,
    marginTop: 10,
    fontSize: 12,
    fontWeight: "700"
  },
  placeholderRow: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f4358",
    backgroundColor: "#0b1d29",
    gap: 4
  },
  placeholderTitle: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4
  },
  placeholderText: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 15
  },
  symbolBlock: {
    marginTop: 10,
    gap: 8
  },
  symbolCard: {
    backgroundColor: "#123246",
    borderWidth: 1,
    borderColor: "#24566f",
    borderRadius: 12,
    padding: 10
  },
  symbolHeader: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  symbol: {
    color: theme.colors.text,
    fontWeight: "800"
  },
  symbolPrice: {
    color: theme.colors.text,
    fontWeight: "800"
  },
  symbolMeta: {
    color: theme.colors.muted,
    marginTop: 2,
    fontSize: 12
  },
  forexTableBlock: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#24566f",
    borderRadius: 12,
    overflow: "hidden"
  },
  forexTableTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#102b3b"
  },
  forexTableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#0b1d29",
    borderTopWidth: 1,
    borderColor: "#17384b"
  },
  forexTableRow: {
    flexDirection: "row",
    backgroundColor: "#102b3b",
    borderTopWidth: 1,
    borderColor: "#17384b",
    alignItems: "center"
  },
  forexRowWrap: {
    backgroundColor: "#102b3b"
  },
  forexHeaderCell: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 8
  },
  forexCell: {
    color: theme.colors.text,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 8
  },
  cellPair: {
    flex: 1.3
  },
  cellPrice: {
    flex: 1.3
  },
  cellLiveTime: {
    flex: 1.8
  },
  cellTimeframe: {
    flex: 1.1
  },
  cellTrend: {
    flex: 0.9,
    fontWeight: "700"
  },
  cellSignal: {
    flex: 0.9,
    fontWeight: "700"
  },
  inlineLiveTime: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: "500"
  },
  forexTableHint: {
    color: theme.colors.muted,
    fontSize: 11,
    marginBottom: 8
  },
  cellConfidence: {
    flex: 0.9,
    fontWeight: "700"
  },
  cellRr: {
    flex: 0.85,
    fontWeight: "700"
  },
  cellAnalysis: {
    flex: 1,
    textAlign: "center"
  },
  analysisButton: {
    flex: 1,
    marginHorizontal: 6,
    marginVertical: 4,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#24566f",
    backgroundColor: "#0b1d29"
  },
  analysisButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent
  },
  analysisButtonText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center"
  },
  analysisButtonTextActive: {
    color: "#03222f"
  },
  analysisPanel: {
    borderTopWidth: 1,
    borderColor: "#17384b",
    backgroundColor: "#0b1d29",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  analysisTitle: {
    color: theme.colors.accent,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4
  },
  analysisText: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 3
  },
  timeframePanel: {
    marginTop: 8
  },
  toggleButton: {
    alignSelf: "flex-start",
    backgroundColor: "#0b1d29",
    borderWidth: 1,
    borderColor: "#24566f",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 6,
    marginBottom: 4
  },
  toggleButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent
  },
  toggleText: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "700"
  },
  toggleTextActive: {
    color: "#03222f"
  },
  minimizedContext: {
    marginTop: 10,
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 4
  },
  signalCard: {
    backgroundColor: "#102b3b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f4358",
    padding: 10,
    marginTop: 8
  },
  signalTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8
  },
  signalTimeframe: {
    color: theme.colors.text,
    fontWeight: "800",
    textTransform: "uppercase",
    fontSize: 12
  },
  signalDirection: {
    fontWeight: "800",
    fontSize: 12,
    textAlign: "right"
  },
  signalMeta: {
    color: theme.colors.muted,
    marginTop: 3,
    fontSize: 12
  },
  signalNote: {
    color: theme.colors.text,
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16
  },
  signalStrategies: {
    color: theme.colors.accent,
    marginTop: 6,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700"
  }
});
