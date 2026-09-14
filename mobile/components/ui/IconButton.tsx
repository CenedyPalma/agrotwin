import type { ReactNode } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { radius, touchTarget } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface IconButtonProps {
  icon: ReactNode;
  /** Required: icon-only controls must still be described for screen readers. */
  accessibilityLabel: string;
  onPress?: () => void;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Translucent dark surface for use over maps and imagery. */
  overlay?: boolean;
  size?: number;
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  selected = false,
  disabled = false,
  style,
  overlay = false,
  size = touchTarget,
}: IconButtonProps) {
  const { colors } = useTheme();
  const bg = overlay ? "rgba(11, 15, 12, 0.72)" : selected ? `${colors.brand}22` : colors.surface;
  const border = selected ? colors.brand : overlay ? "rgba(255,255,255,0.18)" : colors.border;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.btn,
        { width: size, height: size, backgroundColor: bg, borderColor: border },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
