import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
  /** Stroke colour when selected (defaults to brand). */
  color?: string;
}

/** Selectable filter / toggle chip with a 40 px touch height. */
export function Chip({ label, selected = false, onPress, icon, disabled = false, color }: ChipProps) {
  const { colors } = useTheme();
  const accent = color ?? colors.brand;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? `${accent}22` : colors.surface,
          borderColor: selected ? accent : colors.border,
        },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.45 },
      ]}
    >
      {icon}
      <AppText variant="caption" style={{ color: selected ? accent : colors.text, fontWeight: "600" }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
