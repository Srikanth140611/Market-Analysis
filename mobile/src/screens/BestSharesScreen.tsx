import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { fetchBestShares } from "../api/client";
import { REFRESH_INTERVAL_MS } from "../constants";
import { usePollingData } from "../hooks/usePollingData";
import { theme } from "../theme";
import { SectionCard } from "../components/SectionCard";

function scoreTone(score?: number) {
  if (typeof score !== "number") {
    return "#9ec4d6";
  }

  if (score >= 75) {
    return theme.colors.positive;
  }

  if (score >= 55) {
    return theme.colors.warning;
  }

  return theme.colors.negative;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

function FactorBar({ label, value, color }: { label: string; value: number; color: string }) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: clampScore(value),
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false
    }).start();
  }, [animatedValue, value]);

  const width = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"]
  });

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { backgroundColor: color, width }]} />
      </View>
    </View>
  );
}

export function BestSharesScreen() {
  const { data, loading, error, notice } = usePollingData(fetchBestShares, REFRESH_INTERVAL_MS, "best-shares");

  return (
    <View>
      <SectionCard title="Top Trending Shares" subtitle="Suggestions based on momentum and participation">
        {loading ? <Text style={styles.muted}>Loading share ideas...</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error && !(data && data.length > 0) ? <Text style={styles.error}>{error}</Text> : null}

        {(data ?? []).map((item) => (
          <View key={item.symbol} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <View style={styles.rowTopRight}>
                <Text style={[styles.sourceBadge, item.source === "fallback" ? styles.sourceFallback : styles.sourceLive]}>
                  {(item.source ?? "live").toUpperCase()}
                </Text>
                <Text style={styles.change}>{item.changePercent.toFixed(2)}%</Text>
              </View>
            </View>
            <Text style={styles.name}>{item.name}</Text>
            {typeof item.score === "number" ? (
              <Text style={[styles.totalScore, { color: scoreTone(item.score) }]}>Signal Score: {item.score.toFixed(1)}</Text>
            ) : null}

            {item.factorScores ? (
              <>
                <View style={styles.scoreGrid}>
                  <View style={styles.scoreChip}>
                    <Text style={styles.scoreLabel}>MOM</Text>
                    <Text style={styles.scoreValue}>{item.factorScores.momentum.toFixed(0)}</Text>
                  </View>
                  <View style={styles.scoreChip}>
                    <Text style={styles.scoreLabel}>SENT</Text>
                    <Text style={styles.scoreValue}>{item.factorScores.sentiment.toFixed(0)}</Text>
                  </View>
                  <View style={styles.scoreChip}>
                    <Text style={styles.scoreLabel}>VOL</Text>
                    <Text style={styles.scoreValue}>{item.factorScores.volatility.toFixed(0)}</Text>
                  </View>
                  <View style={styles.scoreChip}>
                    <Text style={styles.scoreLabel}>PART</Text>
                    <Text style={styles.scoreValue}>{item.factorScores.participation.toFixed(0)}</Text>
                  </View>
                </View>

                <View style={styles.barGroup}>
                  <View style={styles.barAxisRow}>
                    <View style={styles.barAxisSpacer} />
                    <View style={styles.barAxisTrack}>
                      <Text style={styles.barAxisLabel}>0</Text>
                      <Text style={styles.barAxisLabel}>50</Text>
                      <Text style={styles.barAxisLabel}>100</Text>
                    </View>
                  </View>
                  <FactorBar label="Momentum" value={item.factorScores.momentum} color="#5cf2b5" />
                  <FactorBar label="Sentiment" value={item.factorScores.sentiment} color="#7dc4ff" />
                  <FactorBar label="Volatility" value={item.factorScores.volatility} color="#ffd166" />
                  <FactorBar label="Participation" value={item.factorScores.participation} color="#d3a6ff" />
                </View>
              </>
            ) : null}
            <Text style={styles.rationale}>{item.rationale}</Text>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f4358"
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  rowTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  sourceBadge: {
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden"
  },
  sourceLive: {
    color: "#0e2f20",
    backgroundColor: "#63e2a5"
  },
  sourceFallback: {
    color: "#3c2a07",
    backgroundColor: "#ffd166"
  },
  symbol: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 15
  },
  change: {
    color: theme.colors.positive,
    fontWeight: "700"
  },
  name: {
    color: "#cde9f6",
    marginTop: 3
  },
  totalScore: {
    marginTop: 4,
    fontWeight: "700",
    fontSize: 12
  },
  scoreGrid: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  scoreChip: {
    backgroundColor: "#123246",
    borderWidth: 1,
    borderColor: "#24566f",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  scoreLabel: {
    color: theme.colors.muted,
    fontSize: 10,
    fontWeight: "700"
  },
  scoreValue: {
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: "700"
  },
  barGroup: {
    marginTop: 8,
    gap: 7
  },
  barAxisRow: {
    flexDirection: "row",
    alignItems: "center"
  },
  barAxisSpacer: {
    width: 84
  },
  barAxisTrack: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2
  },
  barAxisLabel: {
    color: "#7ea9bc",
    fontSize: 10,
    fontWeight: "600"
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  barLabel: {
    width: 84,
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "600"
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1b4257",
    overflow: "hidden"
  },
  barFill: {
    height: "100%",
    borderRadius: 999
  },
  rationale: {
    color: theme.colors.muted,
    marginTop: 5,
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
  }
});
