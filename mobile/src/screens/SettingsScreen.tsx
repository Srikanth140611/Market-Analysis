import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fetchNotifierStatus, postSlackAlert } from "../api/client";
import { REFRESH_INTERVAL_MS } from "../constants";
import { usePollingData } from "../hooks/usePollingData";
import { theme } from "../theme";
import { SectionCard } from "../components/SectionCard";

export function SettingsScreen() {
  const [message, setMessage] = useState("Alert: Review USD volatility and energy exposure before next session.");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const notifier = usePollingData(fetchNotifierStatus, REFRESH_INTERVAL_MS);

  async function sendAlert() {
    setSending(true);
    setStatus(null);
    try {
      await postSlackAlert(message);
      setStatus("Notification sent to Slack.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Slack notification failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <View>
      <SectionCard title="Slack Notifications" subtitle="Push market updates directly to your trading channel">
        <Text style={styles.label}>Alert message</Text>
        <TextInput
          multiline
          value={message}
          onChangeText={setMessage}
          style={styles.input}
          placeholder="Write a market alert"
          placeholderTextColor="#7ea3b5"
        />
        <Pressable style={styles.button} onPress={() => void sendAlert()} disabled={sending}>
          {sending ? <ActivityIndicator color="#06222e" /> : <Text style={styles.buttonText}>Send to Slack</Text>}
        </Pressable>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </SectionCard>

      <SectionCard title="Notifier Health" subtitle="Auto news-to-Slack runtime status">
        {notifier.loading ? <Text style={styles.neutral}>Loading notifier status...</Text> : null}
        {notifier.error ? <Text style={styles.error}>{notifier.error}</Text> : null}

        {notifier.data ? (
          <>
            <Text style={styles.statusLine}>Enabled: {notifier.data.enabled ? "Yes" : "No"}</Text>
            <Text style={styles.statusLine}>Running: {notifier.data.running ? "Yes" : "No"}</Text>
            <Text style={styles.statusLine}>Targets: {notifier.data.targets}</Text>
            <Text style={styles.statusLine}>Poll Interval: {notifier.data.intervalMs ?? 0} ms</Text>
            <Text style={styles.statusLine}>Last Source: {notifier.data.lastSource ?? "-"}</Text>
            <Text style={styles.statusLine}>Last Sent Batch: {notifier.data.lastSentCount}</Text>
            <Text style={styles.statusLine}>Total Sent: {notifier.data.totalSentCount}</Text>
            <Text style={styles.statusLine}>
              Last Success: {notifier.data.lastSuccessAt ? new Date(notifier.data.lastSuccessAt).toLocaleString() : "-"}
            </Text>
            <Text style={styles.statusLine}>
              Last Error: {notifier.data.lastError ? notifier.data.lastError : "None"}
            </Text>

            <Pressable style={styles.secondaryButton} onPress={() => void notifier.reload()}>
              <Text style={styles.secondaryButtonText}>Refresh Status</Text>
            </Pressable>
          </>
        ) : null}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: theme.colors.text,
    marginBottom: 6,
    fontWeight: "600"
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#275269",
    color: theme.colors.text,
    backgroundColor: theme.colors.panelAlt,
    padding: 10,
    minHeight: 100,
    textAlignVertical: "top"
  },
  button: {
    marginTop: 12,
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  buttonText: {
    color: "#06222e",
    fontWeight: "700"
  },
  status: {
    marginTop: 10,
    color: theme.colors.muted
  },
  neutral: {
    color: theme.colors.muted
  },
  error: {
    color: theme.colors.negative,
    marginBottom: 8
  },
  statusLine: {
    color: theme.colors.text,
    marginBottom: 4,
    fontSize: 12
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: "#1d4f66",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontWeight: "700"
  }
});
