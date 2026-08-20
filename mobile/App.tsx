import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { GlobalUpdatesScreen } from "./src/screens/GlobalUpdatesScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { AgentsScreen } from "./src/screens/AgentsScreen";
import { TrendsScreen } from "./src/screens/TrendsScreen";
import { BestSharesScreen } from "./src/screens/BestSharesScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { fetchMt4Quotes } from "./src/api/client";
import { usePollingData } from "./src/hooks/usePollingData";
import { theme } from "./src/theme";
import { Mt4Quote } from "./src/types";

type TabKey = "updates" | "trends" | "history" | "agents" | "shares" | "notify";

const tabs: { key: TabKey; label: string }[] = [
  { key: "updates", label: "Updates" },
  { key: "trends", label: "Trends" },
  { key: "history", label: "History" },
  { key: "agents", label: "Agents" },
  { key: "shares", label: "Best Shares" },
  { key: "notify", label: "Slack" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("updates");
  const mt4Quotes = usePollingData(fetchMt4Quotes, 15_000);

  const liveQuotes = mt4Quotes.data?.quotes ?? [];
  const feedHealth = mt4Quotes.data?.healthStatus ?? (mt4Quotes.error ? "offline" : "stale");
  const liveQuotesFresh = feedHealth === "fresh" && liveQuotes.length > 0;

  function formatQuote(quote: Mt4Quote) {
    const decimals = quote.symbol.toUpperCase().includes("JPY") ? 3 : 5;
    return `${quote.symbol} ${quote.bid.toFixed(decimals)}/${quote.ask.toFixed(decimals)}`;
  }

  const content = useMemo(() => {
    if (activeTab === "updates") {
      return <GlobalUpdatesScreen />;
    }
    if (activeTab === "trends") {
      return <TrendsScreen />;
    }
    if (activeTab === "history") {
      return <HistoryScreen />;
    }
    if (activeTab === "agents") {
      return <AgentsScreen />;
    }
    if (activeTab === "shares") {
      return <BestSharesScreen />;
    }
    return <SettingsScreen />;
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="light" />
      <StatusBar barStyle="light-content" />
      <View style={styles.hero}>
        <Text style={styles.title}>Global Market Analysis</Text>
        <Text style={styles.subtitle}>Actionable updates for faster trading decisions</Text>
      </View>

      <Pressable
        onPress={() => setActiveTab("notify")}
        style={[
          styles.liveStrip,
          feedHealth === "fresh"
            ? styles.liveStripFresh
            : feedHealth === "stale"
              ? styles.liveStripStale
              : styles.liveStripOffline
        ]}
        accessibilityRole="button"
        accessibilityLabel="Open MT4 feed details"
      >
        <Text style={styles.liveStripLabel}>MT4 Live Feed · {feedHealth.toUpperCase()}</Text>
        <Text style={styles.liveStripText}>
          {mt4Quotes.loading
            ? "Loading realtime quotes..."
            : mt4Quotes.error
              ? mt4Quotes.error
              : liveQuotes.length
                ? `${feedHealth.toUpperCase()} | ${liveQuotes.slice(0, 3).map(formatQuote).join("   ")}`
                : "No live quotes yet"}
        </Text>
        <Text style={styles.liveStripHint}>Tap to open the MT4 feed panel</Text>
      </Pressable>

      <View style={styles.tabRow}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={[styles.tabButton, activeTab === tab.key ? styles.tabButtonActive : null]}
          >
            <Text style={[styles.tabText, activeTab === tab.key ? styles.tabTextActive : null]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>{content}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 14,
    paddingTop: 20
  },
  hero: {
    marginBottom: 12
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: "800"
  },
  subtitle: {
    color: theme.colors.muted,
    marginTop: 4,
    fontSize: 14
  },
  liveStrip: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    paddingVertical: 10,
    paddingHorizontal: 12
  },
  liveStripFresh: {
    backgroundColor: "#0e2a1f",
    borderColor: "#2d7d5b"
  },
  liveStripStale: {
    backgroundColor: "#33250e",
    borderColor: "#c58b2a"
  },
  liveStripOffline: {
    backgroundColor: "#331515",
    borderColor: "#c44a4a"
  },
  liveStripLabel: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  liveStripText: {
    color: theme.colors.text,
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600"
  },
  liveStripHint: {
    color: theme.colors.muted,
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600"
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14
  },
  tabButton: {
    backgroundColor: "#123246",
    borderWidth: 1,
    borderColor: "#23546e",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  tabButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent
  },
  tabText: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  tabTextActive: {
    color: "#03222f"
  },
  content: {
    paddingBottom: 36
  }
});
