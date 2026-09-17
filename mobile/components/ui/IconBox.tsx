import type { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "@/hooks/useTheme";

interface IconBoxProps extends PropsWithChildren {
  /** 22 (legend glyphs), 38/40 (row icons), 58 (avatar), 74 (processing). */
  size?: number;
  /** Border colour; defaults to text at 18 % like the canvas. */
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}

/** Square hairline box that frames an icon or glyph. */
export function IconBox({ size = 40, borderColor, style, children }: IconBoxProps) {
  const { colors } = useTheme();
  return <View style={[styles.box, { width: size, height: size, borderColor: borderColor ?? colors.boxBorder }, style]}>{children}</View>;
}

/** Small solid square — the status swatch used before "Mostly healthy" etc. */
export function Swatch({ color, size = 12 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, backgroundColor: color, flexShrink: 0 }} />;
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 0, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
