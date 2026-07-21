import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { fetchForexCandles, fetchGlobalNews } from "../api/client";
import { REFRESH_INTERVAL_MS } from "../constants";
import { usePollingData } from "../hooks/usePollingData";
import { theme } from "../theme";
import { SectionCard } from "../components/SectionCard";
import { ForexTimeframe, NewsImpact, OhlcCandle } from "../types";

type TrendBias = "up" | "down" | "neutral";
type TradeDirection = "Buy" | "Sell" | "Hold";
type Candle = { open: number; high: number; low: number; close: number; time: number };

const CHART_WIDTH = 228;
const CHART_HEIGHT = 106;
const EXPANDED_CHART_WIDTH = 328;
const EXPANDED_CHART_HEIGHT = 186;

const TIMEFRAME_OPTIONS: {
  key: ForexTimeframe;
  label: string;
  points: number;
  driftScale: number;
  volatilityScale: number;
}[] = [
  {
    key: "1minute",
    label: "1minute",
    points: 160,
    driftScale: 1,
    volatilityScale: 1.7
  },
  {
    key: "5minute",
    label: "5 minute",
    points: 140,
    driftScale: 1,
    volatilityScale: 1.5
  },
  {
    key: "1hour",
    label: "1hour",
    points: 120,
    driftScale: 1,
    volatilityScale: 1.3
  },
  {
    key: "4hour",
    label: "4 hour",
    points: 110,
    driftScale: 1,
    volatilityScale: 1.15
  },
  {
    key: "1Day",
    label: "1Day",
    points: 100,
    driftScale: 1,
    volatilityScale: 1
  },
  {
    key: "1Week",
    label: "1Week",
    points: 90,
    driftScale: 1,
    volatilityScale: 0.85
  },
  {
    key: "1Month",
    label: "1Month",
    points: 75,
    driftScale: 1,
    volatilityScale: 0.7
  },
  {
    key: "3Months",
    label: "3Months",
    points: 65,
    driftScale: 1,
    volatilityScale: 0.6
  },
  {
    key: "1Year",
    label: "1Year",
    points: 60,
    driftScale: 1,
    volatilityScale: 0.5
  }
];

const PAIR_BASE_PRICE: Record<string, number> = {
  "EUR/USD": 1.09,
  "GBP/USD": 1.28,
  "USD/JPY": 158.2,
  "USD/CHF": 0.89,
  "USD/CAD": 1.36,
  "AUD/USD": 0.67,
  "NZD/USD": 0.61,
  "EUR/JPY": 171.9,
  "GBP/JPY": 202.4,
  "EUR/GBP": 0.85,
  "USD/SEK": 10.61,
  "USD/NOK": 10.73
};

const REQUIRED_IMPACT_ASSETS: NewsImpact["asset"][] = ["forex", "crypto", "commodities", "oil", "shares"];

function defaultImpact(asset: NewsImpact["asset"]): NewsImpact {
  if (asset === "forex") {
    return {
      asset,
      direction: "Neutral",
      confidence: 50,
      note: "Default FX impact view",
      pairsUp: ["EUR/USD", "USD/JPY"],
      pairsDown: ["GBP/USD"]
    };
  }

  return {
    asset,
    direction: "Neutral",
    confidence: 50,
    note: "Default impact view"
  };
}

function normalizeImpacts(impacts: NewsImpact[] | undefined): NewsImpact[] {
  const byAsset = new Map<NewsImpact["asset"], NewsImpact>();
  for (const impact of impacts ?? []) {
    byAsset.set(impact.asset, impact);
  }

  return REQUIRED_IMPACT_ASSETS.map((asset) => byAsset.get(asset) ?? defaultImpact(asset));
}

function focusHint(asset: NewsImpact["asset"], direction: NewsImpact["direction"]) {
  if (asset === "forex") {
    return direction === "Up"
      ? "Focus on long bias pairs listed in Up"
      : direction === "Down"
        ? "Focus on defensive/short bias pairs listed in Down"
        : "Focus on range strategy until breakout";
  }

  if (asset === "commodities") {
    return direction === "Up"
      ? "Focus on bullish commodity momentum"
      : direction === "Down"
        ? "Focus on downside risk in metals/baskets"
        : "Focus on mixed signals and confirmation";
  }

  if (asset === "oil") {
    return direction === "Up"
      ? "Focus on supply-tightening upside"
      : direction === "Down"
        ? "Focus on demand/cycle weakness"
        : "Focus on inventory and headline catalysts";
  }

  if (asset === "shares") {
    return direction === "Up"
      ? "Focus on risk-on sectors"
      : direction === "Down"
        ? "Focus on protection and lower-beta names"
        : "Focus on stock selection over index direction";
  }

  return "Focus on balanced risk management";
}

function timeframeStepMs(timeframe: ForexTimeframe) {
  switch (timeframe) {
    case "1minute":
      return 60 * 1000;
    case "5minute":
      return 5 * 60 * 1000;
    case "1hour":
      return 60 * 60 * 1000;
    case "4hour":
      return 4 * 60 * 60 * 1000;
    case "1Day":
      return 24 * 60 * 60 * 1000;
    case "1Week":
      return 7 * 24 * 60 * 60 * 1000;
    case "1Month":
      return 30 * 24 * 60 * 60 * 1000;
    case "3Months":
      return 90 * 24 * 60 * 60 * 1000;
    case "1Year":
      return 365 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

function fullscreenLookbackMs(timeframe: ForexTimeframe) {
  switch (timeframe) {
    case "1Day":
      return 365 * 24 * 60 * 60 * 1000;
    case "4hour":
      return 120 * 24 * 60 * 60 * 1000;
    case "1hour":
      return 60 * 24 * 60 * 60 * 1000;
    case "5minute":
      return 14 * 24 * 60 * 60 * 1000;
    case "1minute":
      return 5 * 24 * 60 * 60 * 1000;
    case "1Week":
      return 3 * 365 * 24 * 60 * 60 * 1000;
    case "1Month":
      return 5 * 365 * 24 * 60 * 60 * 1000;
    case "3Months":
      return 5 * 365 * 24 * 60 * 60 * 1000;
    case "1Year":
      return 5 * 365 * 24 * 60 * 60 * 1000;
    default:
      return 365 * 24 * 60 * 60 * 1000;
  }
}

function fullscreenFallbackPoints(timeframe: ForexTimeframe) {
  switch (timeframe) {
    case "1Day":
      return 380;
    case "4hour":
      return 760;
    case "1hour":
      return 520;
    case "5minute":
      return 420;
    case "1minute":
      return 360;
    default:
      return 320;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashPair(pair: string) {
  return pair.split("").reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 1), 0);
}

function generateSeries(
  pair: string,
  bias: TrendBias,
  points = 60,
  driftScale = 1,
  volatilityScale = 1
) {
  const seed = hashPair(pair);
  const base = PAIR_BASE_PRICE[pair] ?? 1 + (seed % 100) / 100;
  const directionBias = (bias === "up" ? 0.0045 : bias === "down" ? -0.0045 : 0) * driftScale;
  const series: number[] = [];
  let current = base;

  for (let i = 0; i < points; i += 1) {
    const cycle = Math.sin((i + seed % 11) * 0.38) * 0.006 * volatilityScale;
    const ripple = Math.cos((i + seed % 7) * 0.19) * 0.0035 * volatilityScale;
    const move = directionBias + cycle + ripple;
    current = current * (1 + move);
    series.push(current);
  }

  return series;
}

function buildCandles(series: number[], pair: string, timeframe: ForexTimeframe): Candle[] {
  const seed = hashPair(`${pair}-${timeframe}`);
  const now = Date.now();
  const fiveYearsMs = 5 * 365 * 24 * 60 * 60 * 1000;
  const stepMs = Math.floor(fiveYearsMs / Math.max(series.length - 1, 1));
  const startTime = now - fiveYearsMs;

  return series.map((close, index) => {
    const open = index === 0 ? close * (1 - ((seed % 5) + 1) / 1000) : series[index - 1];
    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const wickBase = Math.max(Math.abs(close - open), close * 0.0006);
    const upper = wickBase * (0.55 + ((seed + index * 3) % 11) / 20);
    const lower = wickBase * (0.55 + ((seed + index * 7) % 13) / 20);

    return {
      open,
      close,
      high: bodyHigh + upper,
      low: Math.max(0.0001, bodyLow - lower),
      time: startTime + index * stepMs
    };
  });
}

function buildSteppedCandles(series: number[], pair: string, timeframe: ForexTimeframe): Candle[] {
  const seed = hashPair(`${pair}-${timeframe}`);
  const stepMs = timeframeStepMs(timeframe);
  const now = Date.now();
  const startTime = now - stepMs * Math.max(series.length - 1, 0);

  return series.map((close, index) => {
    const open = index === 0 ? close * (1 - ((seed % 5) + 1) / 1000) : series[index - 1];
    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const wickBase = Math.max(Math.abs(close - open), close * 0.0006);
    const upper = wickBase * (0.55 + ((seed + index * 3) % 11) / 20);
    const lower = wickBase * (0.55 + ((seed + index * 7) % 13) / 20);

    return {
      open,
      close,
      high: bodyHigh + upper,
      low: Math.max(0.0001, bodyLow - lower),
      time: startTime + index * stepMs
    };
  });
}

function fromOhlc(candles: OhlcCandle[]): Candle[] {
  return candles
    .filter((candle) => Number.isFinite(candle.o) && Number.isFinite(candle.h) && Number.isFinite(candle.l) && Number.isFinite(candle.c))
    .map((candle) => ({
      open: candle.o,
      high: candle.h,
      low: candle.l,
      close: candle.c,
      time: candle.t > 1e12 ? candle.t : candle.t * 1000
    }));
}

function compressCandles(candles: Candle[], targetCount = 180): Candle[] {
  if (candles.length <= targetCount) {
    return candles;
  }

  const step = candles.length / targetCount;
  const output: Candle[] = [];
  for (let i = 0; i < targetCount; i += 1) {
    const start = Math.floor(i * step);
    const end = Math.min(candles.length, Math.floor((i + 1) * step));
    const chunk = candles.slice(start, Math.max(start + 1, end));
    output.push({
      open: chunk[0].open,
      close: chunk[chunk.length - 1].close,
      high: Math.max(...chunk.map((candle) => candle.high)),
      low: Math.min(...chunk.map((candle) => candle.low)),
      time: chunk[0].time
    });
  }

  return output;
}

function sma(values: number[], period: number) {
  if (values.length < period) {
    return values[values.length - 1] ?? 0;
  }

  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function emaSeries(values: number[], period: number) {
  if (values.length === 0) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const output: number[] = [];
  let prev = values[0];
  output.push(prev);

  for (let i = 1; i < values.length; i += 1) {
    const next = (values[i] - prev) * multiplier + prev;
    output.push(next);
    prev = next;
  }

  return output;
}

function rsi(values: number[], period: number) {
  if (values.length <= period) {
    return 50;
  }

  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
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

function indicatorColor(value: number, compare: number) {
  return value >= compare ? theme.colors.positive : theme.colors.negative;
}

function buildTradeSuggestion(
  last: number,
  ma20: number,
  ma50: number,
  macd: number,
  signal: number,
  rsi14: number
): { direction: TradeDirection; note: string; score: number } {
  let score = 0;

  score += last >= ma20 ? 1 : -1;
  score += ma20 >= ma50 ? 1 : -1;
  score += macd >= signal ? 1 : -1;

  if (rsi14 <= 35) {
    score += 1;
  } else if (rsi14 >= 65) {
    score -= 1;
  }

  if (score >= 2) {
    return {
      direction: "Buy",
      note: "Trend and momentum are aligned upward. Consider long entries on pullbacks.",
      score
    };
  }

  if (score <= -2) {
    return {
      direction: "Sell",
      note: "Trend and momentum are aligned downward. Consider short bias or risk reduction.",
      score
    };
  }

  return {
    direction: "Hold",
    note: "Signals are mixed. Wait for MA and MACD confirmation before new entries.",
    score
  };
}

function suggestionColor(direction: TradeDirection) {
  if (direction === "Buy") {
    return theme.colors.positive;
  }
  if (direction === "Sell") {
    return theme.colors.negative;
  }
  return theme.colors.warning;
}

function formatPrice(value: number) {
  return value > 20 ? value.toFixed(2) : value.toFixed(4);
}

function formatTimeLabel(timestamp: number, timeframe: ForexTimeframe) {
  const date = new Date(timestamp);
  if (timeframe === "1minute" || timeframe === "5minute" || timeframe === "1hour" || timeframe === "4hour") {
    return date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return date.toLocaleDateString([], { day: "2-digit", month: "short", year: "2-digit" });
}

function ForexTechnicalPanel({ forexImpact }: { forexImpact: NewsImpact }) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<ForexTimeframe>("1Day");
  const [expandedPair, setExpandedPair] = useState<string | null>(null);
  const [fullscreenPair, setFullscreenPair] = useState<string | null>(null);
  const [liveCandlesByPair, setLiveCandlesByPair] = useState<Record<string, Candle[]>>({});
  const [liveSource, setLiveSource] = useState<"live" | "fallback" | null>(null);
  const [liveReason, setLiveReason] = useState<string | null>(null);
  const pairs = useMemo(() => {
    const merged = [...(forexImpact.pairsUp ?? []), ...(forexImpact.pairsDown ?? [])];
    const unique = Array.from(new Set(merged));
    return unique.slice(0, 8);
  }, [forexImpact.pairsDown, forexImpact.pairsUp]);

  if (pairs.length === 0) {
    return null;
  }

  const timeframe = TIMEFRAME_OPTIONS.find((option) => option.key === selectedTimeframe) ?? TIMEFRAME_OPTIONS[6];
  const yearAxis = useMemo(
    () => [
      new Date().getFullYear() - 4,
      new Date().getFullYear() - 3,
      new Date().getFullYear() - 2,
      new Date().getFullYear() - 1,
      new Date().getFullYear()
    ],
    []
  );

  useEffect(() => {
    let disposed = false;

    async function loadLiveCandles() {
      try {
        const response = await fetchForexCandles(pairs, selectedTimeframe, 5);
        if (disposed) {
          return;
        }

        const mapped: Record<string, Candle[]> = {};
        for (const pair of pairs) {
          const ohlc = response.data[pair] ?? [];
          mapped[pair] = fromOhlc(ohlc);
        }

        setLiveCandlesByPair(mapped);
        setLiveSource(response.source);
        setLiveReason(response.reason ?? null);
      } catch {
        if (!disposed) {
          setLiveCandlesByPair({});
          setLiveSource("fallback");
          setLiveReason("Live candles unavailable");
        }
      }
    }

    void loadLiveCandles();

    return () => {
      disposed = true;
    };
  }, [pairs, selectedTimeframe]);

  function candlesForPair(pair: string, bias: TrendBias, points: number) {
    const syntheticSeries = generateSeries(
      pair,
      bias,
      timeframe.points,
      timeframe.driftScale,
      timeframe.volatilityScale
    );
    const fallbackCandles = buildCandles(syntheticSeries, pair, selectedTimeframe);
    const candlesRaw = liveCandlesByPair[pair] && liveCandlesByPair[pair].length > 0 ? liveCandlesByPair[pair] : fallbackCandles;
    return compressCandles(candlesRaw, points);
  }

  function pairBias(pair: string): TrendBias {
    if ((forexImpact.pairsUp ?? []).includes(pair)) {
      return "up";
    }
    if ((forexImpact.pairsDown ?? []).includes(pair)) {
      return "down";
    }
    return "neutral";
  }

  const fullscreenCandles = useMemo(() => {
    if (!fullscreenPair) {
      return [];
    }

    const live = liveCandlesByPair[fullscreenPair] ?? [];
    if (live.length > 0) {
      return live;
    }

    const bias = pairBias(fullscreenPair);
    const points = fullscreenFallbackPoints(selectedTimeframe);
    const syntheticSeries = generateSeries(
      fullscreenPair,
      bias,
      points,
      timeframe.driftScale,
      timeframe.volatilityScale
    );
    return buildSteppedCandles(syntheticSeries, fullscreenPair, selectedTimeframe);
  }, [fullscreenPair, liveCandlesByPair, selectedTimeframe, timeframe.driftScale, timeframe.volatilityScale]);

  const visibleFullscreenCandles = useMemo(() => {
    if (fullscreenCandles.length === 0) {
      return [];
    }

    const latestTime = fullscreenCandles[fullscreenCandles.length - 1].time;
    const cutoff = latestTime - fullscreenLookbackMs(selectedTimeframe);
    const ranged = fullscreenCandles.filter((candle) => candle.time >= cutoff);
    if (ranged.length >= 40) {
      return ranged;
    }
    return fullscreenCandles.slice(-Math.max(40, ranged.length));
  }, [fullscreenCandles, selectedTimeframe]);

  const firstVisibleCandle = visibleFullscreenCandles[0] ?? null;
  const lastVisibleCandle = visibleFullscreenCandles[visibleFullscreenCandles.length - 1] ?? null;
  const latestVisibleCandle = lastVisibleCandle;

  return (
    <View style={styles.techPanel}>
      <Text style={styles.techPanelTitle}>Forex technical tools</Text>
      <View style={styles.timeframeRow}>
        {TIMEFRAME_OPTIONS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setSelectedTimeframe(option.key)}
            style={[styles.timeframeChip, selectedTimeframe === option.key ? styles.timeframeChipActive : null]}
          >
            <Text style={[styles.timeframeText, selectedTimeframe === option.key ? styles.timeframeTextActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {liveSource ? (
        <Text style={[styles.sourceBadge, liveSource === "live" ? styles.sourceBadgeLive : styles.sourceBadgeFallback]}>
          {liveSource === "live" ? "Candles source: Live (FINNHUB)" : `Candles source: Fallback${liveReason ? ` (${liveReason})` : ""}`}
        </Text>
      ) : null}

      {pairs.map((pair) => {
        const isExpanded = expandedPair === pair;
        const chartWidth = isExpanded ? EXPANDED_CHART_WIDTH : CHART_WIDTH;
        const chartHeight = isExpanded ? EXPANDED_CHART_HEIGHT : CHART_HEIGHT;
        const targetCandles = isExpanded ? 320 : 180;
        const bias: TrendBias = (forexImpact.pairsUp ?? []).includes(pair)
          ? "up"
          : (forexImpact.pairsDown ?? []).includes(pair)
            ? "down"
            : "neutral";
        const syntheticSeries = generateSeries(
          pair,
          bias,
          timeframe.points,
          timeframe.driftScale,
          timeframe.volatilityScale
        );
        const fallbackCandles = buildCandles(syntheticSeries, pair, selectedTimeframe);
        const candlesRaw = liveCandlesByPair[pair] && liveCandlesByPair[pair].length > 0 ? liveCandlesByPair[pair] : fallbackCandles;
        const candles = compressCandles(candlesRaw, targetCandles);
        const closeSeries = candles.map((candle) => candle.close);
        const min = Math.min(...candles.map((candle) => candle.low));
        const max = Math.max(...candles.map((candle) => candle.high));
        const last = closeSeries[closeSeries.length - 1] ?? 0;
        const ma20 = sma(closeSeries, 20);
        const ma50 = sma(closeSeries, 40);
        const ema12 = emaSeries(closeSeries, 12);
        const ema26 = emaSeries(closeSeries, 26);
        const macdLineSeries = ema12.map((value, index) => value - (ema26[index] ?? value));
        const signalSeries = emaSeries(macdLineSeries, 9);
        const macd = macdLineSeries[macdLineSeries.length - 1] ?? 0;
        const signal = signalSeries[signalSeries.length - 1] ?? 0;
        const rsi14 = rsi(closeSeries, 14);
        const suggestion = buildTradeSuggestion(last, ma20, ma50, macd, signal, rsi14);
        const priceSpan = Math.max(max - min, 0.0000001);
        const mapY = (price: number) => chartHeight - (clamp((price - min) / priceSpan, 0, 1) * chartHeight);
        const candleSlot = chartWidth / Math.max(candles.length, 1);
        const candleBodyWidth = clamp(candleSlot * 0.65, 1, 7);
        const yAxisTicks = [
          max,
          max - priceSpan * 0.25,
          max - priceSpan * 0.5,
          max - priceSpan * 0.75,
          min
        ];

        return (
          <View key={pair} style={styles.pairCard}>
            <View style={styles.pairHeader}>
              <Text style={styles.pairName}>{pair}</Text>
              <View style={styles.headerRight}>
                <Text style={styles.pairPrice}>{formatPrice(last)}</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => setExpandedPair((current) => (current === pair ? null : pair))}
                    style={[styles.expandButton, isExpanded ? styles.expandButtonActive : null]}
                  >
                    <Text style={[styles.expandButtonText, isExpanded ? styles.expandButtonTextActive : null]}>
                      {isExpanded ? "Collapse" : "Expand"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setFullscreenPair(pair);
                    }}
                    style={styles.fullscreenButton}
                  >
                    <Text style={styles.fullscreenButtonText}>Fullscreen</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <Text style={styles.timelineLabel}>5Y candlestick (Interval: {timeframe.label})</Text>
            <View style={styles.chartRow}>
              <View>
                <View style={[styles.candleChartWrap, { width: chartWidth, height: chartHeight }]}>
                  <View style={styles.candleChartGrid}>
                    {[0, 1, 2, 3, 4].map((line) => (
                      <View
                        key={`${pair}-h-${line}`}
                        style={[styles.gridLineH, { top: (chartHeight / 4) * line, width: chartWidth }]}
                      />
                    ))}
                    {[0, 1, 2, 3, 4, 5].map((line) => (
                      <View
                        key={`${pair}-v-${line}`}
                        style={[styles.gridLineV, { left: (chartWidth / 5) * line, height: chartHeight }]}
                      />
                    ))}
                  </View>
                  <View style={[styles.candleChart, { width: chartWidth, height: chartHeight }]}>
                    {candles.map((candle, index) => {
                      const x = index * candleSlot;
                      const centerX = x + candleSlot / 2;
                      const openY = mapY(candle.open);
                      const closeY = mapY(candle.close);
                      const highY = mapY(candle.high);
                      const lowY = mapY(candle.low);
                      const bodyTop = Math.min(openY, closeY);
                      const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
                      const candleUp = candle.close >= candle.open;
                      const wickHeight = Math.max(lowY - highY, 1);

                      return (
                        <View key={`${pair}-candle-${index}`}>
                          <View
                            style={[
                              styles.candleWick,
                              {
                                left: centerX,
                                top: highY,
                                height: wickHeight,
                                backgroundColor: candleUp ? "#009f40" : "#d32f2f"
                              }
                            ]}
                          />
                          <View
                            style={[
                              styles.candleBody,
                              {
                                left: centerX - candleBodyWidth / 2,
                                top: bodyTop,
                                width: candleBodyWidth,
                                height: bodyHeight,
                                backgroundColor: candleUp ? "#00b84d" : "#ff3d3d",
                                borderColor: candleUp ? "#006f2d" : "#a00000"
                              }
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.yearRow}>
                  {yearAxis.map((year, index) => (
                    <Text key={`${pair}-year-${index}`} style={styles.yearText}>
                      {year}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.yAxis}>
                {yAxisTicks.map((tick, index) => (
                  <Text key={`${pair}-tick-${index}`} style={styles.yAxisText}>
                    {formatPrice(tick)}
                  </Text>
                ))}
              </View>
            </View>

            <Text style={styles.rangeText}>
              Price range (5Y): {formatPrice(min)} - {formatPrice(max)}
            </Text>

            <View style={styles.metricGrid}>
              <Text style={[styles.metric, { color: indicatorColor(last, ma20) }]}>MA20 {formatPrice(ma20)}</Text>
              <Text style={[styles.metric, { color: indicatorColor(last, ma50) }]}>MA50 {formatPrice(ma50)}</Text>
              <Text style={[styles.metric, { color: indicatorColor(macd, signal) }]}>MACD {macd.toFixed(4)}</Text>
              <Text style={[styles.metric, { color: indicatorColor(signal, 0) }]}>Signal {signal.toFixed(4)}</Text>
              <Text
                style={[
                  styles.metric,
                  { color: rsi14 >= 70 ? theme.colors.negative : rsi14 <= 30 ? theme.colors.positive : theme.colors.warning }
                ]}
              >
                RSI {rsi14.toFixed(1)}
              </Text>
            </View>

            <View style={styles.suggestionBox}>
              <Text style={styles.suggestionLabel}>Technical direction call</Text>
              <Text style={[styles.suggestionValue, { color: suggestionColor(suggestion.direction) }]}>
                {suggestion.direction} (signal score {suggestion.score})
              </Text>
              <Text style={styles.suggestionNote}>{suggestion.note}</Text>
            </View>
          </View>
        );
      })}

      <Modal visible={Boolean(fullscreenPair)} transparent animationType="slide" onRequestClose={() => setFullscreenPair(null)}>
        <View style={styles.overlayBackdrop}>
          <View style={styles.overlayPanel}>
            <View style={styles.overlayHeader}>
              <Text style={styles.overlayTitle}>Granular View: {fullscreenPair ?? "-"}</Text>
              <Pressable onPress={() => setFullscreenPair(null)} style={styles.overlayCloseButton}>
                <Text style={styles.overlayCloseText}>Close</Text>
              </Pressable>
            </View>

            <Text style={styles.overlaySubtitle}>5Y candlestick (Interval: {timeframe.label})</Text>
            {firstVisibleCandle && lastVisibleCandle ? (
              <Text style={styles.overlayPeriodText}>
                Period: {formatTimeLabel(firstVisibleCandle.time, selectedTimeframe)} to {formatTimeLabel(lastVisibleCandle.time, selectedTimeframe)}
              </Text>
            ) : null}

            {latestVisibleCandle ? (
              <Text style={styles.overlayOhlcText}>
                {fullscreenPair?.replace("/", "")},{timeframe.label}  O {formatPrice(latestVisibleCandle.open)}  H {formatPrice(latestVisibleCandle.high)}  L {formatPrice(latestVisibleCandle.low)}  C {formatPrice(latestVisibleCandle.close)}
              </Text>
            ) : null}

            <Text style={styles.overlayPresetNote}>
              {selectedTimeframe === "1Day"
                ? "Preset view: Last 1 year (daily candles)"
                : selectedTimeframe === "4hour"
                  ? "Preset view: Last 4 months (4-hour candles)"
                  : "Preset view: Auto timeframe window"}
            </Text>

            {visibleFullscreenCandles.length > 0 ? (
              (() => {
                const fullWidth = 560;
                const fullHeight = 300;
                const min = Math.min(...visibleFullscreenCandles.map((candle) => candle.low));
                const max = Math.max(...visibleFullscreenCandles.map((candle) => candle.high));
                const span = Math.max(max - min, 0.0000001);
                const mapY = (price: number) => fullHeight - (clamp((price - min) / span, 0, 1) * fullHeight);
                const slot = fullWidth / Math.max(visibleFullscreenCandles.length, 1);
                const bodyWidth = clamp(slot * 0.74, 2, 10);
                const ticks = [
                  max,
                  max - span * 0.25,
                  max - span * 0.5,
                  max - span * 0.75,
                  min
                ];
                const tickIndexes = [0, 0.2, 0.4, 0.6, 0.8, 1].map((fraction) =>
                  Math.min(visibleFullscreenCandles.length - 1, Math.floor((visibleFullscreenCandles.length - 1) * fraction))
                );

                return (
                  <View style={styles.overlayChartRow}>
                    <View>
                      <View style={[styles.candleChartWrap, { width: fullWidth, height: fullHeight }]}>
                        <View style={styles.candleChartGrid}>
                          {[0, 1, 2, 3, 4].map((line) => (
                            <View key={`overlay-h-${line}`} style={[styles.gridLineH, { top: (fullHeight / 4) * line, width: fullWidth }]} />
                          ))}
                          {[0, 1, 2, 3, 4, 5].map((line) => (
                            <View key={`overlay-v-${line}`} style={[styles.gridLineV, { left: (fullWidth / 5) * line, height: fullHeight }]} />
                          ))}
                        </View>
                        <View style={[styles.candleChart, { width: fullWidth, height: fullHeight }]}>
                          {visibleFullscreenCandles.map((candle, index) => {
                            const x = index * slot;
                            const centerX = x + slot / 2;
                            const openY = mapY(candle.open);
                            const closeY = mapY(candle.close);
                            const highY = mapY(candle.high);
                            const lowY = mapY(candle.low);
                            const bodyTop = Math.min(openY, closeY);
                            const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
                            const up = candle.close >= candle.open;

                            return (
                              <View key={`overlay-candle-${index}`}>
                                <View
                                  style={[
                                    styles.candleWick,
                                    {
                                      left: centerX,
                                      top: highY,
                                      height: Math.max(lowY - highY, 1),
                                      backgroundColor: up ? "#009f40" : "#d32f2f"
                                    }
                                  ]}
                                />
                                <View
                                  style={[
                                    styles.candleBody,
                                    {
                                      left: centerX - bodyWidth / 2,
                                      top: bodyTop,
                                      width: bodyWidth,
                                      height: bodyHeight,
                                      backgroundColor: up ? "#00b84d" : "#ff3d3d",
                                      borderColor: up ? "#006f2d" : "#a00000"
                                    }
                                  ]}
                                />
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      <View style={[styles.overlayTimeRow, { width: fullWidth }]}> 
                        {tickIndexes.map((idx, labelIndex) => {
                          const candle = visibleFullscreenCandles[idx];
                          return (
                            <Text key={`overlay-time-${labelIndex}`} style={styles.overlayTimeText}>
                              {candle ? formatTimeLabel(candle.time, selectedTimeframe) : "-"}
                            </Text>
                          );
                        })}
                      </View>

                      <Text style={styles.overlayRangeText}>
                        Visible range: {formatPrice(min)} - {formatPrice(max)} | Candles: {visibleFullscreenCandles.length}
                      </Text>
                    </View>

                    <View style={[styles.yAxis, { height: fullHeight }]}> 
                      {ticks.map((tick, index) => (
                        <Text key={`overlay-tick-${index}`} style={styles.yAxisTextRight}>
                          {formatPrice(tick)}
                        </Text>
                      ))}
                    </View>
                  </View>
                );
              })()
            ) : (
              <Text style={styles.muted}>No candles available for fullscreen view.</Text>
            )}
          </View>
        </View>
      </Modal>

      <Text style={styles.techDisclaimer}>Technical panel uses synthetic OHLC over a fixed 5-year span; selected interval controls candle granularity (MT4-style view).</Text>
    </View>
  );
}

export function GlobalUpdatesScreen() {
  const [openForexForNewsId, setOpenForexForNewsId] = useState<string | null>(null);
  const { data, loading, error, lastUpdated } = usePollingData(fetchGlobalNews, REFRESH_INTERVAL_MS);
  const [newItemsCount, setNewItemsCount] = useState(0);
  const [lastSuccessAt, setLastSuccessAt] = useState<Date | null>(null);
  const [lastChangeAt, setLastChangeAt] = useState<Date | null>(null);
  const previousHeadlineIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!data || !lastUpdated) {
      return;
    }

    setLastSuccessAt(lastUpdated);
    const currentIds = new Set((data.data ?? []).map((item) => item.id));
    const prevIds = previousHeadlineIds.current;

    if (!prevIds) {
      previousHeadlineIds.current = currentIds;
      setNewItemsCount(0);
      return;
    }

    const incoming = Array.from(currentIds).filter((id) => !prevIds.has(id)).length;
    setNewItemsCount(incoming);
    if (incoming > 0) {
      setLastChangeAt(lastUpdated);
    }

    previousHeadlineIds.current = currentIds;
  }, [data, lastUpdated]);

  return (
    <View>
      <SectionCard
        title="Global Market Updates"
        subtitle="Auto-refreshes every 15s for latest decision-ready headlines"
      >
        {loading ? <Text style={styles.muted}>Loading news...</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {data ? (
          <Text style={[styles.source, data.source === "live" ? styles.sourceLive : styles.sourceFallback]}>
            {data.source === "live"
              ? `Real-time update stream active (${data.provider.toUpperCase()})`
              : "Update stream active (backup source)"}
          </Text>
        ) : null}
        {data ? (
          <View style={styles.refreshStatusBox}>
            <Text style={styles.refreshStatusText}>
              Last successful fetch: {lastSuccessAt ? lastSuccessAt.toLocaleTimeString() : "-"}
            </Text>
            <Text style={[styles.refreshStatusText, newItemsCount > 0 ? styles.newItemsPositive : styles.newItemsMuted]}>
              New items this refresh: {newItemsCount}
            </Text>
            <Text style={styles.refreshStatusSubtext}>
              {lastChangeAt
                ? `Last detected new headline: ${lastChangeAt.toLocaleTimeString()}`
                : "No new headlines detected yet in this session."}
            </Text>
          </View>
        ) : null}
        {lastUpdated ? <Text style={styles.refresh}>Last refreshed: {lastUpdated.toLocaleTimeString()}</Text> : null}

        {(data?.data ?? []).map((item) => (
          <View key={item.id} style={styles.row}>
            {(() => {
              const impacts = normalizeImpacts(item.impacts);
              const forexImpact = impacts.find((impact) => impact.asset === "forex") ?? defaultImpact("forex");
              const commoditiesImpact = impacts.find((impact) => impact.asset === "commodities") ?? null;
              const oilImpact = impacts.find((impact) => impact.asset === "oil") ?? null;
              const sharesImpact = impacts.find((impact) => impact.asset === "shares") ?? null;

              return (
                <>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.meta}>
                    {item.source} | {new Date(item.publishedAt).toLocaleString()}
                  </Text>
                  <Text style={styles.summary}>{item.summary}</Text>
                  <View style={styles.impactRow}>
                    {impacts.map((impact) => (
                      <Pressable
                        onPress={() => {
                          if (impact.asset === "forex") {
                            setOpenForexForNewsId((current) => (current === item.id ? null : item.id));
                          }
                        }}
                        key={`${item.id}-${impact.asset}`}
                        style={[
                          styles.impactChip,
                          impact.direction === "Up"
                            ? styles.impactUp
                            : impact.direction === "Down"
                              ? styles.impactDown
                              : styles.impactNeutral
                        ]}
                      >
                        <Text style={styles.impactText}>
                          {impact.asset.toUpperCase()}: {impact.direction}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.focusBox}>
                    <Text style={styles.focusTitle}>Focus direction</Text>
                    <Text style={styles.focusText}>
                      FOREX: {forexImpact.direction} - {focusHint("forex", forexImpact.direction)}
                    </Text>
                    <Text style={styles.focusText}>
                      COMMODITIES: {(commoditiesImpact?.direction ?? "Neutral")} - {focusHint("commodities", commoditiesImpact?.direction ?? "Neutral")}
                    </Text>
                    <Text style={styles.focusText}>
                      OIL: {(oilImpact?.direction ?? "Neutral")} - {focusHint("oil", oilImpact?.direction ?? "Neutral")}
                    </Text>
                    <Text style={styles.focusText}>
                      SHARES: {(sharesImpact?.direction ?? "Neutral")} - {focusHint("shares", sharesImpact?.direction ?? "Neutral")}
                    </Text>
                  </View>

                  <View key={`${item.id}-forex-breakdown`} style={styles.fxBox}>
                    <Text style={styles.fxTitle}>Forex pair direction</Text>
                    <Text style={styles.fxText}>
                      Up: {forexImpact.pairsUp && forexImpact.pairsUp.length > 0 ? forexImpact.pairsUp.join(", ") : "-"}
                    </Text>
                    <Text style={styles.fxText}>
                      Down: {forexImpact.pairsDown && forexImpact.pairsDown.length > 0 ? forexImpact.pairsDown.join(", ") : "-"}
                    </Text>
                    <Text style={styles.fxHint}>Tap FOREX chip to view graph, range, MA and MACD tools.</Text>
                    {openForexForNewsId === item.id ? <ForexTechnicalPanel forexImpact={forexImpact} /> : null}
                  </View>

                  {commoditiesImpact ? (
                    <View key={`${item.id}-commodities-breakdown`} style={styles.fxBox}>
                      <Text style={styles.fxTitle}>Commodities direction</Text>
                      <Text style={styles.fxText}>
                        Up: {commoditiesImpact.symbolsUp && commoditiesImpact.symbolsUp.length > 0 ? commoditiesImpact.symbolsUp.join(", ") : "-"}
                      </Text>
                      <Text style={styles.fxText}>
                        Down: {commoditiesImpact.symbolsDown && commoditiesImpact.symbolsDown.length > 0 ? commoditiesImpact.symbolsDown.join(", ") : "-"}
                      </Text>
                    </View>
                  ) : null}

                  {oilImpact ? (
                    <View key={`${item.id}-oil-breakdown`} style={styles.fxBox}>
                      <Text style={styles.fxTitle}>Oil direction</Text>
                      <Text style={styles.fxText}>
                        Up: {oilImpact.symbolsUp && oilImpact.symbolsUp.length > 0 ? oilImpact.symbolsUp.join(", ") : "-"}
                      </Text>
                      <Text style={styles.fxText}>
                        Down: {oilImpact.symbolsDown && oilImpact.symbolsDown.length > 0 ? oilImpact.symbolsDown.join(", ") : "-"}
                      </Text>
                    </View>
                  ) : null}

                  <Pressable onPress={() => void Linking.openURL(item.url)} style={styles.sourceBtn}>
                    <Text style={styles.sourceBtnText}>Open source article</Text>
                  </Pressable>
                </>
              );
            })()}
          </View>
        ))}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f4358"
  },
  title: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  meta: {
    color: theme.colors.muted,
    marginTop: 4,
    fontSize: 12
  },
  summary: {
    color: "#c4e4f3",
    marginTop: 4,
    fontSize: 13
  },
  muted: {
    color: theme.colors.muted
  },
  error: {
    color: theme.colors.negative,
    marginBottom: 8
  },
  refresh: {
    color: theme.colors.muted,
    marginBottom: 8,
    fontSize: 12
  },
  refreshStatusBox: {
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#265468",
    backgroundColor: "#102b39",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2
  },
  refreshStatusText: {
    color: "#d4ebf8",
    fontSize: 12,
    fontWeight: "700"
  },
  refreshStatusSubtext: {
    color: "#9cc2d3",
    fontSize: 11
  },
  newItemsPositive: {
    color: theme.colors.positive
  },
  newItemsMuted: {
    color: theme.colors.muted
  },
  source: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "700"
  },
  sourceLive: {
    color: theme.colors.positive
  },
  sourceFallback: {
    color: theme.colors.warning
  },
  impactRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  focusBox: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2b5f74",
    backgroundColor: "#112f3e",
    padding: 8
  },
  focusTitle: {
    color: "#d8eeff",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4
  },
  focusText: {
    color: "#b7d8e9",
    fontSize: 11,
    marginTop: 2
  },
  impactChip: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1
  },
  impactUp: {
    backgroundColor: "#104130",
    borderColor: "#3ddc97"
  },
  impactDown: {
    backgroundColor: "#4a1f24",
    borderColor: "#ff6b6b"
  },
  impactNeutral: {
    backgroundColor: "#3f3520",
    borderColor: "#ffd166"
  },
  impactText: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: "700"
  },
  fxBox: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#275269",
    backgroundColor: "#102836",
    padding: 8
  },
  fxTitle: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4
  },
  fxText: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 2
  },
  fxHint: {
    color: "#9fcae1",
    marginTop: 6,
    fontSize: 11,
    fontWeight: "600"
  },
  sourceBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2f6f8d",
    backgroundColor: "#103246",
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  sourceBtnText: {
    color: "#bfe8ff",
    fontSize: 11,
    fontWeight: "700"
  },
  techPanel: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a5e78",
    backgroundColor: "#0d2330",
    padding: 10
  },
  techPanelTitle: {
    color: theme.colors.text,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 8
  },
  timeframeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10
  },
  timeframeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2e657f",
    backgroundColor: "#102b38",
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  timeframeChipActive: {
    backgroundColor: "#14b894",
    borderColor: "#14b894"
  },
  timeframeText: {
    color: "#b4d9ea",
    fontSize: 10,
    fontWeight: "700"
  },
  timeframeTextActive: {
    color: "#05232d"
  },
  sourceBadge: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 8
  },
  sourceBadgeLive: {
    color: theme.colors.positive
  },
  sourceBadgeFallback: {
    color: theme.colors.warning
  },
  pairCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#244e64",
    backgroundColor: "#0f2a38",
    padding: 8,
    marginBottom: 8
  },
  pairHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 4
  },
  actionRow: {
    flexDirection: "row",
    gap: 6
  },
  pairName: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12
  },
  pairPrice: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12
  },
  expandButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3b7088",
    backgroundColor: "#143747",
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  expandButtonActive: {
    borderColor: "#0fbf91",
    backgroundColor: "#0fbf91"
  },
  expandButtonText: {
    color: "#a9d6e8",
    fontSize: 10,
    fontWeight: "700"
  },
  expandButtonTextActive: {
    color: "#03252f"
  },
  fullscreenButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3f6191",
    backgroundColor: "#1e3556",
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  fullscreenButtonText: {
    color: "#d9ecff",
    fontSize: 10,
    fontWeight: "700"
  },
  timelineLabel: {
    color: "#aad3e5",
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 5
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  yAxis: {
    height: EXPANDED_CHART_HEIGHT,
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: 52,
    paddingVertical: 2
  },
  yAxisText: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: "600"
  },
  yAxisTextRight: {
    color: "#4b4b4b",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "left"
  },
  candleChartWrap: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#b9b9b9",
    backgroundColor: "#ffffff",
    alignSelf: "center",
    marginBottom: 5,
    overflow: "hidden"
  },
  candleChartGrid: {
    ...StyleSheet.absoluteFillObject,
    position: "absolute"
  },
  candleChart: {
    width: CHART_WIDTH,
    height: CHART_HEIGHT,
    position: "relative"
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    width: CHART_WIDTH,
    height: 1,
    borderTopWidth: 1,
    borderColor: "#d3d3d3",
    borderStyle: "dashed"
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    height: CHART_HEIGHT,
    borderLeftWidth: 1,
    borderColor: "#d3d3d3",
    borderStyle: "dashed"
  },
  candleWick: {
    position: "absolute",
    width: 1
  },
  candleBody: {
    position: "absolute",
    borderWidth: 0.8
  },
  yearRow: {
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    width: EXPANDED_CHART_WIDTH,
    alignSelf: "center"
  },
  yearText: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: "600"
  },
  rangeText: {
    color: theme.colors.muted,
    fontSize: 11,
    marginBottom: 6
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  metric: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#30627a",
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "#112f3e"
  },
  suggestionBox: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2e647f",
    backgroundColor: "#0f2937",
    padding: 8
  },
  suggestionLabel: {
    color: "#9ec8dd",
    fontSize: 10,
    fontWeight: "700"
  },
  suggestionValue: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 3
  },
  suggestionNote: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 3
  },
  techDisclaimer: {
    color: theme.colors.muted,
    fontSize: 10,
    marginTop: 2
  },
  overlayBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 10, 17, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    padding: 12
  },
  overlayPanel: {
    width: "96%",
    maxWidth: 760,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2b5670",
    backgroundColor: "#0b2432",
    padding: 12
  },
  overlayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  overlayTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  overlayCloseButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3b7088",
    backgroundColor: "#143747",
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  overlayCloseText: {
    color: "#d7f2ff",
    fontSize: 11,
    fontWeight: "700"
  },
  overlaySubtitle: {
    color: "#9ec9dc",
    marginTop: 6,
    marginBottom: 4,
    fontSize: 11,
    fontWeight: "700"
  },
  overlayPeriodText: {
    color: "#b3d8ea",
    fontSize: 11,
    marginBottom: 4,
    fontWeight: "600"
  },
  overlayOhlcText: {
    color: "#dbf0fb",
    fontSize: 11,
    marginBottom: 8,
    fontWeight: "700"
  },
  overlayPresetNote: {
    color: "#a4d0e4",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 10
  },
  overlayChartRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  overlayTimeRow: {
    marginTop: 4,
    marginBottom: 2,
    flexDirection: "row",
    justifyContent: "space-between"
  },
  overlayTimeText: {
    color: "#7f98a8",
    fontSize: 10,
    fontWeight: "600"
  },
  overlayRangeText: {
    color: theme.colors.muted,
    fontSize: 11,
    marginTop: 6
  }
});
