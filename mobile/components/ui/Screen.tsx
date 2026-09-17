import type { PropsWithChildren } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

interface ScreenProps extends PropsWithChildren {
  /** Scrollable content with optional pull-to-refresh (default). Set false for lists that scroll themselves. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Extra bottom padding (the canvas pads 120 under the FAB). */
  bottomInset?: number;
  /** Apply the top safe-area inset (tab screens with no header). */
  safeTop?: boolean;
  /** Side padding; 0 when the screen draws its own header edge-to-edge. */
  padded?: boolean;
}

/** Page ground with safe-area handling and pull-to-refresh. */
export function Screen({ children, scroll = true, refreshing = false, onRefresh, style, contentStyle, bottomInset = 0, safeTop = false, padded = true }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const background = { backgroundColor: colors.bg };
  const padding = {
    paddingTop: safeTop ? insets.top + 8 : 0,
    paddingBottom: insets.bottom + 24 + bottomInset,
    paddingHorizontal: padded ? layout.pagePadding : 0,
  };
  if (!scroll) {
    return <View style={[styles.flex, background, safeTop && { paddingTop: insets.top }, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={[styles.flex, background, style]}
      contentContainerStyle={[padding, contentStyle]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} progressBackgroundColor={colors.bg} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
