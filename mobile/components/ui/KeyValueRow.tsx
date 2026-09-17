import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

interface KeyValueRowProps {
  label: string;
  value?: string | null;
  /** Colour of the value text (design: status rows). */
  valueColor?: string;
  children?: ReactNode;
  mono?: boolean;
  last?: boolean;
}

/** Canvas metadata row: 7 px vertical padding, muted key, bold right-aligned value, 8 % rule. */
export function KeyValueRow({ label, value, valueColor, children, mono = false, last = false }: KeyValueRowProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: colors.hairline, borderBottomWidth: 1 }]}>
      <AppText variant="bodySm" tone="muted" style={styles.label}>
        {label}
      </AppText>
      {children ?? (
        <AppText variant="bodySmStrong" tabular style={[styles.value, mono && styles.mono, valueColor ? { color: valueColor } : null]} selectable>
          {value ?? "—"}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 7, minHeight: 36 },
  label: { flexShrink: 0 },
  value: { flex: 1, textAlign: "right" },
  mono: { fontFamily: "monospace", fontSize: 12 },
});
