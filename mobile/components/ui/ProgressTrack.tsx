import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

interface ProgressTrackProps {
  /** 0..1, or null for an indeterminate pulse. */
  fraction: number | null;
  height?: number;
  color?: string;
  accessibilityLabel?: string;
}

/** Flat progress bar: text-at-9 % track, accent fill (canvas processing / upload bars). */
export function ProgressTrack({ fraction, height = 8, color, accessibilityLabel }: ProgressTrackProps) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.35);
  useEffect(() => {
    if (fraction == null) pulse.value = withRepeat(withTiming(1, { duration: 500 }), -1, true);
  }, [fraction, pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: fraction == null ? pulse.value : 1 }));
  const pct = fraction == null ? 100 : Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <View
      style={[styles.track, { height, backgroundColor: colors.track }]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={fraction == null ? undefined : { min: 0, max: 100, now: pct }}
    >
      <Animated.View style={[{ height: "100%", width: `${pct}%`, backgroundColor: color ?? colors.accent }, animated]} />
    </View>
  );
}

const styles = StyleSheet.create({ track: { width: "100%", overflow: "hidden" } });
