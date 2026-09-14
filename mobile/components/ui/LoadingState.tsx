import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
  radiusSize?: number;
}

/** Pulsing placeholder block. */
export function Skeleton({ width = "100%", height = 16, style, radiusSize = radius.sm }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radiusSize, backgroundColor: colors.skeleton }, animated, style]}
    />
  );
}

/** Skeleton shaped like a list card. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton width="55%" height={20} />
      <Skeleton width="35%" height={14} />
      {Array.from({ length: Math.max(lines - 2, 0) }).map((_, i) => (
        <Skeleton key={i} width={`${80 - i * 15}%`} height={14} />
      ))}
    </View>
  );
}

interface LoadingStateProps {
  message?: string;
  /** Render N skeleton cards instead of a spinner. */
  cards?: number;
}

export function LoadingState({ message = "Loading…", cards }: LoadingStateProps) {
  const { colors } = useTheme();
  if (cards) {
    return (
      <View style={styles.list} accessibilityLabel={message} accessibilityRole="progressbar">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.brand} />
      <AppText variant="caption" tone="muted">
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.sm },
  list: { gap: spacing.md },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md, paddingVertical: spacing.xxl },
});
