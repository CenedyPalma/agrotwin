import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { WifiOff, AlertTriangle, ServerOff, Settings2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { describeError, isApiError } from "@/services/errors";
import { Button } from "./Button";
import { AppText } from "./Text";

interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  /** Smaller inline variant for sections inside a screen. */
  compact?: boolean;
  title?: string;
}

/** Farmer-friendly failure message with Retry; the technical detail is behind a tap. */
export function ErrorState({ error, onRetry, compact = false, title }: ErrorStateProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [showTech, setShowTech] = useState(false);
  const d = describeError(error);
  const kind = isApiError(error) ? error.kind : "unknown";
  const Icon = kind === "offline" ? WifiOff : kind === "not_configured" ? Settings2 : kind === "timeout" ? ServerOff : AlertTriangle;

  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={[styles.icon, { backgroundColor: `${colors.problem}1a` }]}>
        <Icon size={compact ? 22 : 28} color={colors.problem} />
      </View>
      <AppText variant={compact ? "heading" : "title"} style={styles.center}>
        {title ?? d.title}
      </AppText>
      <AppText variant="body" tone="muted" style={styles.center}>
        {d.message}
      </AppText>
      <View style={styles.actions}>
        {onRetry && d.retryable ? <Button label="Retry" onPress={onRetry} /> : null}
        {(kind === "offline" || kind === "not_configured") && (
          <Button label="Open Settings" variant="outline" onPress={() => router.push("/settings")} />
        )}
      </View>
      {d.technical ? (
        <Pressable onPress={() => setShowTech((v) => !v)} accessibilityRole="button" accessibilityLabel="Toggle technical details">
          <AppText variant="caption" tone="muted" style={styles.center}>
            {showTech ? d.technical : "Show technical details"}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  compact: { paddingVertical: spacing.lg },
  icon: { width: 56, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm, marginTop: spacing.xs },
});
