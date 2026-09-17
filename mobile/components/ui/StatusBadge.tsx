import { StyleSheet, View } from "react-native";
import { TIER_LABEL } from "@/constants/labels";
import type { StatusTier } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

interface StatusBadgeProps {
  tier: StatusTier;
  /** Overrides the default tier label (e.g. "Medium priority", "Completed"). */
  label?: string;
  /** Uppercase variant used in the twin chrome. */
  upper?: boolean;
}

/**
 * Outlined tag: 11 px text, 4×9 padding, border and text in the tier colour
 * (canvas: `border:1px solid {{ color }};color:{{ color }}`). The text
 * always carries the meaning, so colour is never the only signal.
 */
export function StatusBadge({ tier, label, upper = false }: StatusBadgeProps) {
  const { colors } = useTheme();
  const color = colors[tier];
  const text = label ?? TIER_LABEL[tier];
  return (
    <View style={[styles.tag, { borderColor: color }]} accessibilityRole="text" accessibilityLabel={`Status: ${text}`}>
      <AppText variant={upper ? "tagUpper" : "tag"} style={{ color }} numberOfLines={1}>
        {text}
      </AppText>
    </View>
  );
}

export const Tag = StatusBadge;

const styles = StyleSheet.create({
  tag: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderRadius: 0 },
});
