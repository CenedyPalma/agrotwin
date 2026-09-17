import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { accentRamp, layout, typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** Text size: 14 (default), 15, 16 — the canvas mixes all three. */
  size?: "sm" | "md" | "lg";
  /** Minimum height; the canvas uses 36–52. Defaults by size: 44 / 48 / 52. */
  minHeight?: number;
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Left-align the label (design: ghost "Show advanced details"). */
  align?: "center" | "start";
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * Industry button: square, condensed-heading label. The primary is the one
 * solid object on the board (accent fill, page-background text); secondary
 * is a hairline outline; ghost is accent text with no border.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "sm",
  minHeight,
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  align = "center",
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors, isDark } = useTheme();
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: colors.accent, border: colors.accent, text: colors.onAccent, pressed: isDark ? accentRamp[400] : accentRamp[600] },
    secondary: { bg: "transparent", border: colors.divider, text: colors.text, pressed: colors.pressed },
    ghost: { bg: "transparent", border: "transparent", text: colors.accent, pressed: colors.accentTintSoft },
    danger: { bg: "transparent", border: colors.problem, text: colors.problem, pressed: colors.pressed },
  }[variant];
  const height = minHeight ?? { sm: layout.touch, md: 48, lg: 52 }[size];
  const textStyle = { sm: typography.button, md: typography.buttonMd, lg: typography.buttonLg }[size];

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
        { minHeight: height, backgroundColor: pressed && !isDisabled ? palette.pressed : palette.bg, borderColor: palette.border },
        variant === "ghost" && styles.ghostPadding,
        align === "start" && styles.start,
        fullWidth && styles.fullWidth,
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
          <AppText style={[textStyle, { color: palette.text }]}>{label}</AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 0, borderWidth: 1, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  ghostPadding: { paddingHorizontal: 4 },
  start: { alignItems: "flex-start" },
  content: { flexDirection: "row", alignItems: "center", gap: 6 },
  fullWidth: { alignSelf: "stretch", width: "100%" },
  disabled: { opacity: 0.45 },
});
