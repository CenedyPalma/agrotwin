import { Pressable, StyleSheet, View } from "react-native";
import { fonts } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

interface SegmentedBarProps<T extends string> {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
  /** 44 (appearance picker) or 46 (survey filters). */
  height?: number;
}

/** Equal-width cells in a hairline frame; the active cell is a solid accent fill. */
export function SegmentedBar<T extends string>({ options, value, onChange, height = 46 }: SegmentedBarProps<T>) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { borderColor: colors.divider }]} accessibilityRole="tablist">
      {options.map((o, i) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [
              styles.cell,
              { minHeight: height, backgroundColor: active ? colors.accent : pressed ? colors.pressed : "transparent" },
              i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.divider },
            ]}
          >
            <AppText variant="bodySm" style={{ color: active ? colors.onAccent : colors.text, fontFamily: active ? fonts.bodySemiBold : fonts.body }} numberOfLines={1}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderWidth: 1, borderRadius: 0 },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
});
