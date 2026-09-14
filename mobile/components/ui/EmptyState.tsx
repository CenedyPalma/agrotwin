import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "./Button";
import { AppText } from "./Text";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
}: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="summary">
      {icon ? <View style={[styles.icon, { backgroundColor: colors.surface2 }]}>{icon}</View> : null}
      <AppText variant={compact ? "heading" : "title"} style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" tone="muted" style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={styles.button} /> : null}
      {secondaryLabel && onSecondary ? (
        <Button label={secondaryLabel} onPress={onSecondary} variant="ghost" style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl },
  compact: { paddingVertical: spacing.lg },
  icon: { width: 64, height: 64, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
  button: { marginTop: spacing.sm, minWidth: 180 },
});
