import { Pressable, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { spacing, touchTarget } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, subtitle, actionLabel, onAction }: SectionHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <AppText variant="label" tone="muted" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="link"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
        >
          <AppText variant="caption" tone="brand" style={{ fontWeight: "600" }}>
            {actionLabel}
          </AppText>
          <ChevronRight size={16} color={colors.brand} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  titles: { flex: 1, gap: 2 },
  action: { flexDirection: "row", alignItems: "center", minHeight: touchTarget - 12, paddingLeft: spacing.md },
});
