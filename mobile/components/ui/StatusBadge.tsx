import { StyleSheet, View } from "react-native";
import { TIER_EMOJI, TIER_LABEL } from "@/constants/labels";
import { radius, spacing, status, type StatusTier } from "@/constants/theme";
import { AppText } from "./Text";

interface StatusBadgeProps {
  tier: StatusTier;
  /** Overrides the default tier label (e.g. "Mostly Healthy", "Completed"). */
  label?: string;
  size?: "sm" | "md";
  /** Show the coloured emoji marker in front of the text (default true). */
  showMarker?: boolean;
}

/** Pill that pairs a colour with an emoji marker and text — never colour alone. */
export function StatusBadge({ tier, label, size = "md", showMarker = true }: StatusBadgeProps) {
  const color = status[tier];
  const text = label ?? TIER_LABEL[tier];
  return (
    <View
      style={[styles.badge, size === "sm" && styles.sm, { backgroundColor: `${color}22`, borderColor: `${color}66` }]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${text}`}
    >
      {showMarker && <AppText variant={size === "sm" ? "caption" : "body"}>{TIER_EMOJI[tier]}</AppText>}
      <AppText variant={size === "sm" ? "caption" : "bodyStrong"} style={{ color, fontWeight: "600" }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  sm: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
});
