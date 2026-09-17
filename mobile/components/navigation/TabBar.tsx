import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, Home, Sprout, User, type LucideIcon } from "lucide-react-native";
import { fonts, iconStroke, layout } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "@/components/ui";

const ICONS: Record<string, LucideIcon> = { index: Home, fields: Sprout, surveys: Camera, profile: User };

/**
 * Canvas tab bar: top hairline, four equal cells, 23 px icon over an 11 px
 * label, a 26×2 accent bar under the active tab, no rounding.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: colors.bg, borderTopColor: colors.divider, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.cells}>
        {state.routes.map((route, index) => {
          const active = state.index === index;
          const options = descriptors[route.key]?.options ?? {};
          const label = typeof options.title === "string" ? options.title : route.name;
          const Icon = ICONS[route.name] ?? Home;
          const color = active ? colors.accent : colors.muted;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={() => {
                const evt = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!active && !evt.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.cell}
            >
              <Icon size={23} color={color} strokeWidth={iconStroke} />
              <AppText variant="label" style={{ color, fontFamily: active ? fonts.bodySemiBold : fonts.body }}>
                {label}
              </AppText>
              <View style={[styles.indicator, { backgroundColor: active ? colors.accent : "transparent" }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export const TAB_BAR_HEIGHT = layout.tabBarHeight;

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1 },
  cells: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: layout.tabBarHeight, paddingTop: 6, paddingBottom: 4 },
  indicator: { width: 26, height: 2 },
});
