import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";
import { describeError, isApiError } from "@/services/errors";
import { Button } from "./Button";
import { AppText } from "./Text";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
  title?: string;
  /** Extra ghost action (design: "Use offline data"). */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/** The canvas error glyph: a crossed reticle in the problem colour. */
function ErrorGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.2}>
      <Path d="M2 12h3M19 12h3M12 2v3M12 19v3" />
      <Circle cx="12" cy="12" r="6" />
      <Path d="m9.5 9.5 5 5" />
    </Svg>
  );
}

/** Canvas "Error state": farmer-friendly copy, Retry, technical detail behind a tap. */
export function ErrorState({ error, onRetry, compact = false, title, secondaryLabel, onSecondary }: ErrorStateProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [showTech, setShowTech] = useState(false);
  const d = describeError(error);
  const kind = isApiError(error) ? error.kind : "unknown";
  const showSettings = kind === "offline" || kind === "not_configured";

  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <ErrorGlyph size={compact ? 36 : 52} color={colors.problem} />
      <AppText variant="title" style={[styles.center, styles.title, compact && { fontSize: 22, lineHeight: 25 }]}>
        {title ?? d.title}
      </AppText>
      <AppText variant="body" tone="muted" style={styles.center}>
        {d.message}
      </AppText>
      {onRetry && d.retryable ? <Button label="Retry" size="lg" onPress={onRetry} style={styles.retry} /> : null}
      {secondaryLabel && onSecondary ? <Button label={secondaryLabel} variant="ghost" size="md" onPress={onSecondary} /> : null}
      {showSettings ? <Button label="Open Settings" variant="ghost" size="md" onPress={() => router.push("/settings")} /> : null}
      {d.technical ? (
        <Pressable onPress={() => setShowTech((v) => !v)} accessibilityRole="button" accessibilityLabel="Toggle technical details" hitSlop={8}>
          <AppText variant="small" tone="muted" style={styles.center}>
            {showTech ? d.technical : "Show technical details"}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8, paddingVertical: 60, paddingHorizontal: 16 },
  compact: { paddingVertical: 28 },
  center: { textAlign: "center" },
  title: { fontSize: 26, lineHeight: 30, marginTop: 8 },
  retry: { marginTop: 12, paddingHorizontal: 30, minWidth: 160 },
});
