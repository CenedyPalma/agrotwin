import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "./Button";
import { AppText } from "./Text";

interface EmptyStateProps {
  /** 52 px thin-stroke icon in the accent colour. */
  icon?: ReactNode;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  compact?: boolean;
}

/** Canvas "Empty state": centred icon, 26 px condensed title, 15 px muted copy, 52 px primary button. */
export function EmptyState({ icon, title, message, actionLabel, onAction, secondaryLabel, onSecondary, compact = false }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, compact && styles.compact]} accessibilityRole="summary">
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <AppText variant={compact ? "cardTitle" : "title"} style={[styles.center, !compact && { fontSize: 26, lineHeight: 30 }]}>
        {title}
      </AppText>
      {message ? (
        <AppText variant={compact ? "bodySm" : "body"} tone="muted" style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} size="lg" onPress={onAction} style={styles.button} /> : null}
      {secondaryLabel && onSecondary ? <Button label={secondaryLabel} variant="ghost" size="md" onPress={onSecondary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8, paddingVertical: 60, paddingHorizontal: 16 },
  compact: { paddingVertical: 50, paddingHorizontal: 20 },
  icon: { marginBottom: 8 },
  center: { textAlign: "center" },
  button: { marginTop: 12, paddingHorizontal: 22, minWidth: 200 },
});
