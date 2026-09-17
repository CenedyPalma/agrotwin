import { useEffect, type PropsWithChildren, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { layout } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "./Button";
import { AppText } from "./Text";

interface BottomSheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  /** 22 px condensed title with a "Done" ghost button (design: Map layers). */
  title?: string;
  /** Custom header instead of the title row (design: zone sheet). */
  header?: ReactNode;
  accessibilityLabel?: string;
}

/**
 * Canvas bottom sheet: 45 % black backdrop, page-background panel with a
 * top hairline, 44×4 handle, slides up in 220 ms.
 */
export function BottomSheet({ visible, onClose, title, header, accessibilityLabel, children }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(400);
  useEffect(() => {
    y.value = visible ? withTiming(0, { duration: 220 }) : 400;
  }, [visible, y]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.backdrop }]}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <Animated.View
          style={[styles.sheet, { backgroundColor: colors.bg, borderTopColor: colors.divider, paddingBottom: 26 + insets.bottom }, colors.shadowLg, slide]}
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel ?? title}
        >
          <View style={[styles.handle, { backgroundColor: colors.corner }]} />
          {header ??
            (title ? (
              <View style={styles.titleRow}>
                <AppText variant="cardTitle" style={{ fontSize: 22 }}>
                  {title}
                </AppText>
                <Button label="Done" variant="ghost" onPress={onClose} />
              </View>
            ) : null)}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end" },
  dismiss: { flex: 1 },
  sheet: { borderTopWidth: 1, paddingTop: 10, paddingHorizontal: layout.pagePadding },
  handle: { width: 44, height: 4, alignSelf: "center", marginBottom: 14, opacity: 0.5 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
});
