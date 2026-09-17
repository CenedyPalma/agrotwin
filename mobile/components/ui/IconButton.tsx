import type { ReactNode } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { immersive, layout } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface IconButtonProps {
  icon: ReactNode;
  /** Required: icon-only controls must still be described for screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * `plain` — hairline box on the page (back buttons, refresh).
   * `raised` — page-background box with a shadow, for use over the map.
   * `dark` — translucent dark panel, for the Digital Twin / image viewer.
   * `primary` — solid accent (the "+" on My fields, the chat send).
   */
  tone?: "plain" | "raised" | "dark" | "primary";
  size?: number;
}

/** Square icon button; 44–50 px like the canvas. */
export function IconButton({ icon, accessibilityLabel, onPress, selected = false, disabled = false, style, tone = "plain", size = layout.backButton }: IconButtonProps) {
  const { colors } = useTheme();
  const look = {
    plain: { bg: selected ? colors.accentTint : "transparent", border: selected ? colors.accent : colors.divider, shadow: null },
    raised: { bg: selected ? colors.accentTint : colors.bg, border: selected ? colors.accent : colors.divider, shadow: colors.shadowMd },
    dark: { bg: immersive.panel, border: selected ? immersive.text : immersive.border, shadow: null },
    primary: { bg: colors.accent, border: colors.accent, shadow: null },
  }[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, backgroundColor: look.bg, borderColor: look.border },
        look.shadow,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 0, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
