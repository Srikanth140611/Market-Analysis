import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { fetchMarketHistory } from "../api/client";
import { SectionCard } from "../components/SectionCard";
import { theme } from "../theme";
import { MarketHistoryResponse, MarketHistoryTimeframe, OhlcCandle } from "../types";

const ASSET_SYMBOLS = {
  forex: ["EUR/USD", "GBP/USD", "USD/JPY"],
  commodity: ["XAU/USD", "XAG/USD"],
  oil: ["BRENT", "WTI"]
} as const;

const TIMEFRAMES: MarketHistoryTimeframe[] = ["1minute", "5minute", "1hour", "4hour", "8hour", "12hour", "1Day", "1Week"];

type AssetKey = keyof typeof ASSET_SYMBOLS;
type MarketSymbol = (typeof ASSET_SYMBOLS)[AssetKey][number];

function formatPrice(value: number) {
  return value > 20 ? value.toFixed(2) : value.toFixed(4);
}

function formatTimeframeLabel(timeframe: MarketHistoryTimeframe) {
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

function sourceColor(source: string) {
  if (source === "live") {
    return { color: theme.colors.positive };
  }

  if (source === "derived") {
    return { color: theme.colors.warning };
  }

  if (source === "mixed") {
    return { color: theme.colors.accent };
  }

  return { color: theme.colors.negative };
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

function buildSparkline(candles: OhlcCandle[], targetPoints = 24) {
  if (candles.length === 0) {
    return [] as number[];
  }

  const closes = candles.map((candle) => candle.c);
  if (closes.length <= targetPoints) {
    return closes;
  }

  const step = closes.length / targetPoints;
  const points: number[] = [];
  for (let index = 0; index < targetPoints; index += 1) {
    const start = Math.floor(index * step);
    const end = Math.min(closes.length, Math.floor((index + 1) * step));
    const chunk = closes.slice(start, Math.max(start + 1, end));
    points.push(chunk[chunk.length - 1]);
  }

  return points;
}

function MiniChart({ candles }: { candles: OhlcCandle[] }) {
  const points = useMemo(() => buildSparkline(candles), [candles]);

  if (points.length === 0) {
    return <Text style={styles.chartFallback}>No candle history returned.</Text>;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(max - min, 0.0000001);

  return (
    <View style={styles.chartWrap}>
      {points.map((point, index) => {
        const height = 20 + ((point - min) / span) * 52;
        return <View key={`spark-${index}`} style={[styles.sparkBar, { height }]} />;
      })}
    </View>
  );
}

export function HistoryScreen() {
  const [selectedAsset, setSelectedAsset] = useState<AssetKey>("forex");
  const [selectedSymbol, setSelectedSymbol] = useState<MarketSymbol>(ASSET_SYMBOLS.forex[0]);
  const [history, setHistory] = useState<MarketHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const symbols = ASSET_SYMBOLS[selectedAsset] as readonly MarketSymbol[];

  useEffect(() => {
    if (!symbols.includes(selectedSymbol)) {
      setSelectedSymbol(symbols[0]);
    }
  }, [selectedAsset, selectedSymbol, symbols]);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchMarketHistory([selectedSymbol], TIMEFRAMES, 5);
        if (cancelled) {
          return;
        }

        setHistory(response);
      } catch (loadError) {
        if (!cancelled) {
          setHistory(null);
          setError(loadError instanceof Error ? loadError.message : "Failed to load market history");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [selectedSymbol]);

  const symbolHistory = history?.data[selectedSymbol] ?? {};
  const patternRows = history?.patterns.filter((pattern) => pattern.symbol === selectedSymbol) ?? [];

  return (
    <View>
      <SectionCard title="Market History & Pattern Skills" subtitle="5-year historical candles and classification by timeframe">
        <Text style={styles.description}>
          Built for forex, commodities, and oil with live- or derived-backed historical series for the selected symbol.
        </Text>

        <View style={styles.assetRow}>
          {(Object.keys(ASSET_SYMBOLS) as AssetKey[]).map((asset) => (
            <Pressable
              key={asset}
              onPress={() => setSelectedAsset(asset)}
              style={[styles.assetChip, selectedAsset === asset ? styles.assetChipActive : null]}
            >
              <Text style={[styles.assetChipText, selectedAsset === asset ? styles.assetChipTextActive : null]}>
                {asset === "commodity" ? "Commodities" : asset === "oil" ? "Oil" : "Forex"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.symbolRow}>
          {symbols.map((symbol) => (
            <Pressable
              key={symbol}
              onPress={() => setSelectedSymbol(symbol)}
              style={[styles.symbolChip, selectedSymbol === symbol ? styles.symbolChipActive : null]}
            >
              <Text style={[styles.symbolChipText, selectedSymbol === symbol ? styles.symbolChipTextActive : null]}>
                {symbol}
              </Text>
            </Pressable>
          ))}
        </View>

        {loading ? <Text style={styles.muted}>Loading history and pattern signals...</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {history ? (
          <Text style={[styles.source, sourceColor(history.source)]}>
            Source: {history.source}
            {history.reason ? ` (${history.reason})` : ""}
          </Text>
        ) : null}

        {patternRows.length > 0 ? (
          <View style={styles.patternSummary}>
            {patternRows.slice(0, 3).map((pattern) => (
              <View key={`${pattern.symbol}-${pattern.timeframe}`} style={styles.patternBadge}>
                <Text style={[styles.patternBadgeTitle, { color: directionColor(pattern.direction) }]}>
                  {formatTimeframeLabel(pattern.timeframe)} {pattern.pattern}
                </Text>
                <Text style={styles.patternBadgeText}>
                  {pattern.direction.toUpperCase()} | Signal {pattern.confidence}%
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {TIMEFRAMES.map((timeframe) => {
          const frame = symbolHistory[timeframe];
          const pattern = patternRows.find((item) => item.timeframe === timeframe);
          const candles = frame?.candles ?? [];
          const latest = candles[candles.length - 1];

          return (
            <View key={`${selectedSymbol}-${timeframe}`} style={styles.frameCard}>
              <View style={styles.frameHeader}>
                <Text style={styles.frameTitle}>{formatTimeframeLabel(timeframe)}</Text>
                <Text style={[styles.frameSource, sourceColor(frame?.source ?? "fallback")]}> 
                  {frame?.source ?? "fallback"}
                </Text>
              </View>

              <MiniChart candles={candles} />

              <View style={styles.frameStats}>
                <Text style={styles.statText}>Candles {candles.length}</Text>
                <Text style={styles.statText}>Close {latest ? formatPrice(latest.c) : "-"}</Text>
                <Text style={styles.statText}>Support {pattern ? formatPrice(pattern.support) : "-"}</Text>
                <Text style={styles.statText}>Resistance {pattern ? formatPrice(pattern.resistance) : "-"}</Text>
              </View>

              <Text style={[styles.patternLine, { color: directionColor(pattern?.direction ?? "neutral") }]}>
                {pattern ? `${pattern.pattern.toUpperCase()} | ${pattern.direction.toUpperCase()} | ${pattern.confidence}%` : "Pattern unavailable"}
              </Text>
              <Text style={styles.note}>{frame?.note ?? pattern?.note ?? "No note available"}</Text>
            </View>
          );
        })}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    color: theme.colors.muted,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 18
  },
  assetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10
  },
  assetChip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#123246",
    borderWidth: 1,
    borderColor: "#23546e"
  },
  assetChipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent
  },
  assetChipText: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12
  },
  assetChipTextActive: {
    color: "#03222f"
  },
  symbolRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  symbolChip: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "#102b3b",
    borderWidth: 1,
    borderColor: "#1f4358"
  },
  symbolChipActive: {
    backgroundColor: "#163f57",
    borderColor: theme.colors.accent
  },
  symbolChipText: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 12
  },
  symbolChipTextActive: {
    color: theme.colors.accent
  },
  source: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10
  },
  patternSummary: {
    gap: 8,
    marginBottom: 12
  },
  patternBadge: {
    backgroundColor: "#102b3b",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f4358",
    padding: 10
  },
  patternBadgeTitle: {
    fontWeight: "800",
    fontSize: 13
  },
  patternBadgeText: {
    color: theme.colors.muted,
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700"
  },
  frameCard: {
    backgroundColor: "#0f2533",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1f4358"
  },
  frameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  frameTitle: {
    color: theme.colors.text,
    fontWeight: "800"
  },
  frameSource: {
    fontWeight: "700",
    fontSize: 11,
    textTransform: "uppercase"
  },
  chartWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 72,
    paddingVertical: 4,
    marginBottom: 10
  },
  sparkBar: {
    flex: 1,
    minWidth: 3,
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
    opacity: 0.88
  },
  chartFallback: {
    color: theme.colors.muted,
    fontSize: 12,
    marginBottom: 10
  },
  frameStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8
  },
  statText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  patternLine: {
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4
  },
  note: {
    color: theme.colors.text,
    fontSize: 12,
    lineHeight: 16
  },
  muted: {
    color: theme.colors.muted,
    marginBottom: 8
  },
  error: {
    color: theme.colors.negative,
    marginBottom: 8
  }
});
