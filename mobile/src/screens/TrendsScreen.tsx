import { StyleSheet, Text, View } from "react-native";
import { fetchMarketTrends } from "../api/client";
import { REFRESH_INTERVAL_MS } from "../constants";
import { usePollingData } from "../hooks/usePollingData";
import { theme } from "../theme";
import { SectionCard } from "../components/SectionCard";

function trendColor(direction: "up" | "down") {
  if (direction === "up") {
    return theme.colors.positive;
  }
  return theme.colors.negative;
}

function suggestionColor(direction: "up" | "down", confidence: number) {
  if (confidence < 65) {
    return theme.colors.warning;
  }

  return direction === "up" ? theme.colors.positive : theme.colors.negative;
}

export function TrendsScreen() {
  const { data, loading, error, notice } = usePollingData(fetchMarketTrends, REFRESH_INTERVAL_MS, "market-trends");

  return (
    <View>
      <SectionCard title="Forex, Commodities and Oil Trends" subtitle="Live momentum and confidence signals">
        {loading ? <Text style={styles.muted}>Loading trend data...</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error && !data ? <Text style={styles.error}>{error}</Text> : null}
        {data ? (
          <Text style={[styles.source, data.source === "live" ? styles.sourceLive : styles.sourceFallback]}>
            Data Source: {data.source === "live" ? "Live" : "Fallback"}
            {data.reason ? ` (${data.reason})` : ""}
          </Text>
        ) : null}

        {(data?.data ?? []).map((item) => (
          <View key={item.symbol} style={styles.row}>
            <View>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <Text style={styles.name}>{item.name}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.price}>{item.price.toFixed(2)}</Text>
              <Text style={[styles.change, { color: trendColor(item.direction) }]}>
                {item.changePercent.toFixed(2)}%
              </Text>
              <Text style={[styles.momentum, { color: trendColor(item.direction) }]}>Momentum {item.momentum}</Text>
              <Text style={[styles.suggestion, { color: suggestionColor(item.direction, item.confidence) }]}>
                Suggestion {item.momentumSuggestion}
                {item.confidence < 65 ? " (Weak)" : ""}
              </Text>
              <Text style={styles.confidence}>Signal {item.confidence}%</Text>
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f4358"
  },
  symbol: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 15
  },
  name: {
    color: theme.colors.muted,
    marginTop: 2
  },
  right: {
    alignItems: "flex-end"
  },
  price: {
    color: theme.colors.text,
    fontWeight: "700"
  },
  change: {
    marginTop: 2,
    fontWeight: "700"
  },
  momentum: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700"
  },
  suggestion: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: "700"
  },
  confidence: {
    color: theme.colors.muted,
    fontSize: 12
  },
  muted: {
    color: theme.colors.muted
  },
  error: {
    color: theme.colors.negative,
    marginBottom: 8
  },
  notice: {
    color: theme.colors.warning,
    marginBottom: 8
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
  }
});
