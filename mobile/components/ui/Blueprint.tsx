import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { cornerMark, layout } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

/**
 * The blueprint frame every card, figure and primary object wears in the
 * Industry system: square, transparent, hairline-bordered, with "+"
 * registration marks at the four corners (styles.css `.blueprint`).
 */
export function CornerMarks() {
  const { colors } = useTheme();
  const c = { color: colors.corner };
  return (
    <>
      <Mark style={styles.tl} color={c.color} />
      <Mark style={styles.tr} color={c.color} />
      <Mark style={styles.bl} color={c.color} />
      <Mark style={styles.br} color={c.color} />
    </>
  );
}

function Mark({ style, color }: { style: StyleProp<ViewStyle>; color: string }) {
  return (
    <View pointerEvents="none" style={[styles.mark, style]}>
      <View style={[styles.vertical, { backgroundColor: color }]} />
      <View style={[styles.horizontal, { backgroundColor: color }]} />
    </View>
  );
}

interface BlueprintProps extends PropsWithChildren {
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Inner padding; the canvas uses 14–18. Default 15. */
  padding?: number;
  /** Draw the frame without the corner marks (plain hairline box). */
  plain?: boolean;
  testID?: string;
}

export function Blueprint({ children, style, onPress, accessibilityLabel, accessibilityHint, padding = layout.cardPadding, plain = false, testID }: BlueprintProps) {
  const { colors } = useTheme();
  const frame = [styles.frame, { borderColor: colors.divider, padding }, style];
  if (!onPress) {
    return (
      <View style={frame} testID={testID}>
        {!plain && <CornerMarks />}
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [frame, pressed && { backgroundColor: colors.pressed }]}
      testID={testID}
    >
      {!plain && <CornerMarks />}
      {children}
    </Pressable>
  );
}

/** Backwards-compatible alias: the app's cards are blueprint frames. */
export const Card = Blueprint;

const styles = StyleSheet.create({
  frame: { position: "relative", borderWidth: 1, borderRadius: 0, backgroundColor: "transparent" },
  mark: { position: "absolute", width: cornerMark.size, height: cornerMark.size },
  vertical: { position: "absolute", left: cornerMark.arm, top: 0, width: 1, height: "100%" },
  horizontal: { position: "absolute", top: cornerMark.arm, left: 0, height: 1, width: "100%" },
  tl: { top: cornerMark.offset, left: cornerMark.offset },
  tr: { top: cornerMark.offset, right: cornerMark.offset },
  bl: { bottom: cornerMark.offset, left: cornerMark.offset },
  br: { bottom: cornerMark.offset, right: cornerMark.offset },
});
