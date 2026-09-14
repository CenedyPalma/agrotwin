import type { PropsWithChildren } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface ScreenProps extends PropsWithChildren {
  /** Scrollable content with optional pull-to-refresh (default). Set false for lists that scroll themselves. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra bottom padding, e.g. to clear a floating action button. */
  bottomInset?: number;
  /** Whether the top safe-area inset should be applied (false under a native header). */
  safeTop?: boolean;
}

/** Themed page background with safe-area handling and pull-to-refresh. */
export function Screen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  style,
  contentStyle,
  bottomInset = 0,
  safeTop = false,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const background = { backgroundColor: colors.background };
  const padding = {
    paddingTop: safeTop ? insets.top + spacing.md : spacing.md,
    paddingBottom: insets.bottom + spacing.xl + bottomInset,
  };

  if (!scroll) {
    return <View style={[styles.flex, background, safeTop && { paddingTop: insets.top }, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={[styles.flex, background, style]}
      contentContainerStyle={[styles.content, padding, contentStyle]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} /> : undefined
      }
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
});
