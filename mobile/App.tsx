import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View, Pressable } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { GlobalUpdatesScreen } from "./src/screens/GlobalUpdatesScreen";
import { TrendsScreen } from "./src/screens/TrendsScreen";
import { BestSharesScreen } from "./src/screens/BestSharesScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { theme } from "./src/theme";

type TabKey = "updates" | "trends" | "shares" | "notify";

const tabs: { key: TabKey; label: string }[] = [
  { key: "updates", label: "Updates" },
  { key: "trends", label: "Trends" },
  { key: "shares", label: "Best Shares" },
  { key: "notify", label: "Slack" }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("updates");

  const content = useMemo(() => {
    if (activeTab === "updates") {
      return <GlobalUpdatesScreen />;
    }
    if (activeTab === "trends") {
      return <TrendsScreen />;
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
