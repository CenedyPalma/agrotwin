import { StyleSheet, View } from "react-native";
import { Button } from "./Button";
import { AppText } from "./Text";

interface SectionHeaderProps {
  title: string;
  /** Muted caption on the right (design: "4 found"). */
  meta?: string;
  /** Ghost button on the right (design: "All 4"). */
  actionLabel?: string;
  onAction?: () => void;
}

/** The canvas `h6`: 13 px uppercase, 0.08em tracking, 10 px below. */
export function SectionHeader({ title, meta, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText variant="h6" accessibilityRole="header">
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="ghost" minHeight={36} onPress={onAction} />
      ) : meta ? (
        <AppText variant="small" tone="muted">
          {meta}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 24, marginBottom: 10 },
});
