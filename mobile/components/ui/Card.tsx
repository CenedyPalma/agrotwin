import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, shadow, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface CardProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  padded?: boolean;
  /** Use the secondary surface (for nested cards). */
  tone?: "surface" | "surface2";
  testID?: string;
}

/** Rounded surface container; becomes a large touch target when `onPress` is given. */
export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  padded = true,
  tone = "surface",
  testID,
}: CardProps) {
  const { colors } = useTheme();
  const base = [
    styles.card,
    padded && styles.padded,
    { backgroundColor: tone === "surface" ? colors.surface : colors.surface2, borderColor: colors.border },
    style,
  ];
  if (!onPress) {
    return (
      <View style={base} testID={testID}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [base, pressed && styles.pressed]}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow.card,
  },
  padded: { padding: spacing.lg },
  pressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
});
