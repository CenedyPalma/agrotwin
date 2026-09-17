import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}

/** Square hairline chip (design: AI suggestion buttons, 44 px tall). Selected = accent fill. */
export function Chip({ label, selected = false, onPress, icon, disabled = false }: ChipProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? colors.accent : pressed ? colors.pressed : "transparent", borderColor: selected ? colors.accent : colors.divider },
        disabled && { opacity: 0.45 },
      ]}
    >
      {icon}
      <AppText variant="bodySm" style={{ color: selected ? colors.onAccent : colors.text }} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderRadius: 0 },
});
