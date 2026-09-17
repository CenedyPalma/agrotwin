import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** Square shimmer block (canvas `agroShim`: opacity .45 → .9, 1.3 s). */
export function Skeleton({ width = "100%", height = 16, delay = 0, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withRepeat(withTiming(0.9, { duration: 650 }), -1, true);
    }, delay);
    return () => clearTimeout(t);
  }, [opacity, delay]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ width, height, backgroundColor: colors.skeleton }, animated, style]} />;
}

interface LoadingStateProps {
  message?: string;
  /** Page skeleton (design "Loading state"): a title bar, a tall card, two cards, a row. */
  skeleton?: boolean;
  /** Shorter skeleton for a section. */
  cards?: number;
}

export function LoadingState({ message = "Loading…", skeleton = false, cards }: LoadingStateProps) {
  const { colors } = useTheme();
  if (skeleton) {
    return (
      <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel={message}>
        <Skeleton width="60%" height={30} />
        <Skeleton height={190} delay={100} />
        <Skeleton height={118} delay={200} />
        <Skeleton height={118} delay={300} />
        <Skeleton height={56} delay={400} />
      </View>
    );
  }
  if (cards) {
    return (
      <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel={message}>
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} height={i === 0 ? 196 : 120} delay={i * 150} />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.accent} />
      <AppText variant="small" tone="muted">
        {message}
      </AppText>
    </View>
  );
}

/** Design: "Pull to refresh · updating" line under the shimmer blocks. */
export function RefreshingNote() {
  return (
    <AppText variant="kicker" tone="muted" style={{ textAlign: "center", letterSpacing: 1.2, fontSize: 12 }}>
      Pull to refresh · updating
    </AppText>
  );
}

const styles = StyleSheet.create({
  list: { gap: 14, paddingTop: 6 },
  center: { alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 40 },
});
