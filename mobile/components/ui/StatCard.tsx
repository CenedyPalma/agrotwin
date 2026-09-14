import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "@/constants/theme";
import { Card } from "./Card";
import { AppText } from "./Text";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  color?: string;
  onPress?: () => void;
}

/** Big number with a small uppercase label — the dashboard's building block. */
export function StatCard({ label, value, hint, icon, color, onPress }: StatCardProps) {
  return (
    <Card style={styles.card} onPress={onPress} accessibilityLabel={`${label}: ${value}${hint ? `. ${hint}` : ""}`}>
      <View style={styles.header}>
        <AppText variant="label" tone="muted">
          {label}
        </AppText>
        {icon}
      </View>
      <AppText variant="stat" style={color ? { color } : undefined}>
        {value}
      </AppText>
      {hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, gap: spacing.xs, minWidth: 140 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
