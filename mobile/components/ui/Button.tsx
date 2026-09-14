import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, spacing, touchTarget } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: "md" | "lg" | "sm";
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

/** Large-touch-target button. Icon + label are always shown together (never icon-only for actions). */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const palette = {
    primary: { bg: colors.brand, border: colors.brand, text: colors.onBrand },
    secondary: { bg: colors.surface2, border: colors.surface2, text: colors.text },
    outline: { bg: "transparent", border: colors.border, text: colors.text },
    ghost: { bg: "transparent", border: "transparent", text: colors.brand },
    danger: { bg: "transparent", border: colors.problem, text: colors.problem },
  }[variant];

  const height = size === "lg" ? 56 : size === "sm" ? 40 : touchTarget;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        { height, backgroundColor: palette.bg, borderColor: palette.border },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.content}>
          {icon}
          <AppText variant={size === "sm" ? "caption" : "bodyStrong"} style={{ color: palette.text, fontWeight: "600" }}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  fullWidth: { alignSelf: "stretch" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
