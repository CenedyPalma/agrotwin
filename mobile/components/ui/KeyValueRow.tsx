import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

interface KeyValueRowProps {
  label: string;
  value?: string | null;
  children?: ReactNode;
  mono?: boolean;
  last?: boolean;
}

/** Label on the left, value on the right; used for metadata lists. */
export function KeyValueRow({ label, value, children, mono = false, last = false }: KeyValueRowProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <AppText variant="caption" tone="muted" style={styles.label}>
        {label}
      </AppText>
      {children ?? (
        <AppText variant="bodyStrong" style={[styles.value, mono && styles.mono]} selectable>
          {value ?? "—"}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    minHeight: 40,
  },
  label: { flexShrink: 0 },
  value: { flex: 1, textAlign: "right" },
  mono: { fontFamily: "monospace", fontSize: 13 },
});
