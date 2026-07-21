import { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

type SectionCardProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

export function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.panel,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1f4358"
  },
  title: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "700"
  },
  subtitle: {
    color: theme.colors.muted,
    marginTop: 4,
    fontSize: 12
  },
  content: {
    marginTop: 12
  }
});
