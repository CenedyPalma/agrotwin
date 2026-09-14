import { StyleSheet, View } from "react-native";
import { TIER_EMOJI } from "@/constants/labels";
import { radius, spacing, status, type StatusTier } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { formatPercent } from "@/utils/format";
import type { HealthShares } from "@/utils/health";
import { AppText } from "./Text";

interface HealthBarProps {
  shares: HealthShares;
  height?: number;
}

/** Stacked bar of the three measured area shares. */
export function HealthBar({ shares, height = 12 }: HealthBarProps) {
  const total = Math.max(shares.healthy + shares.attention + shares.problem, 0.0001);
  const seg = (v: number) => ({ flex: Math.max(v / total, 0) });
  return (
    <View
      style={[styles.bar, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Healthy ${formatPercent(shares.healthy)}, needs attention ${formatPercent(shares.attention)}, problem ${formatPercent(shares.problem)}`}
    >
      <View style={[seg(shares.healthy), { backgroundColor: status.healthy }]} />
      <View style={[seg(shares.attention), { backgroundColor: status.attention }]} />
      <View style={[seg(shares.problem), { backgroundColor: status.problem }]} />
    </View>
  );
}

interface HealthLegendProps {
  shares: HealthShares;
  layout?: "row" | "column";
  compact?: boolean;
}

/** The three tiers with emoji, label and percentage. */
export function HealthLegend({ shares, layout = "row", compact = false }: HealthLegendProps) {
  const items: Array<{ tier: StatusTier; label: string; value: number }> = [
    { tier: "healthy", label: "Healthy", value: shares.healthy },
    { tier: "attention", label: "Needs Attention", value: shares.attention },
    { tier: "problem", label: "Problem", value: shares.problem },
  ];
  return (
    <View style={layout === "row" ? styles.legendRow : styles.legendColumn}>
      {items.map((item) => (
        <View key={item.tier} style={layout === "row" ? styles.legendItemRow : styles.legendItemColumn}>
          <AppText variant={compact ? "caption" : "body"} tone="muted">
            {TIER_EMOJI[item.tier]} {item.label}
          </AppText>
          <AppText variant={compact ? "bodyStrong" : "heading"} style={{ color: status[item.tier] }}>
            {formatPercent(item.value)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

interface HealthDotProps {
  tier: StatusTier;
  label: string;
  size?: "sm" | "md" | "lg";
}

/** Coloured dot + emoji + text, e.g. "🟢 Mostly Healthy". */
export function HealthIndicator({ tier, label, size = "md" }: HealthDotProps) {
  const { colors } = useTheme();
  const variant = size === "lg" ? "title" : size === "sm" ? "caption" : "heading";
  return (
    <View style={styles.indicator} accessibilityRole="text" accessibilityLabel={`Overall health: ${label}`}>
      <View style={[styles.dot, { backgroundColor: status[tier], borderColor: colors.surface }]} />
      <AppText variant={variant}>
        {TIER_EMOJI[tier]} {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", overflow: "hidden", width: "100%" },
  legendRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  legendColumn: { gap: spacing.sm },
  legendItemRow: { flex: 1, gap: 2 },
  legendItemColumn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  indicator: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: radius.pill, borderWidth: 2 },
});
