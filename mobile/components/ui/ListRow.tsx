import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/hooks/useTheme";
import { IconBox } from "./IconBox";
import { AppText } from "./Text";

/** Hairline container for ListRow / CheckRow groups (canvas: `border:1px solid var(--color-divider)`). */
export function ListGroup({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useTheme();
  return <View style={[styles.group, { borderColor: colors.divider }, style]}>{children}</View>;
}

interface ListRowProps {
  icon?: ReactNode;
  label: string;
  note?: string | null;
  onPress?: () => void;
  last?: boolean;
  disabled?: boolean;
  /** Replace the chevron (e.g. a tag). */
  right?: ReactNode;
}

/** 56 px navigation row: accent icon, label + note, chevron at 45 %. */
export function ListRow({ icon, label, note, onPress, last = false, disabled = false, right }: ListRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={note ? `${label}. ${note}` : label}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: 1, borderBottomColor: colors.hairline }, pressed && { backgroundColor: colors.pressed }, disabled && { opacity: 0.45 }]}
    >
      {icon ? <View style={[styles.icon, { alignItems: "center", justifyContent: "center" }]}>{icon}</View> : null}
      <View style={styles.text}>
        <AppText variant={note ? "bodyStrong" : "body"} numberOfLines={1}>
          {label}
        </AppText>
        {note ? (
          <AppText variant="small" tone="muted" numberOfLines={2}>
            {note}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={colors.text} strokeWidth={1.5} style={{ opacity: 0.45 }} /> : null)}
    </Pressable>
  );
}

interface CheckRowProps {
  label: string;
  note?: string | null;
  checked: boolean;
  onPress: () => void;
  last?: boolean;
  /** Framed variant with its own border (design: field / drone pickers). */
  framed?: boolean;
  minHeight?: number;
  /** Larger condensed label (design: field picker). */
  emphasis?: boolean;
  disabled?: boolean;
}

/** 54 px selectable row with a 20 px square check mark; selected rows tint accent 12 %. */
export function CheckRow({ label, note, checked, onPress, last = false, framed = false, minHeight = 54, emphasis = false, disabled = false }: CheckRowProps) {
  const { colors } = useTheme();
  const mark = checked ? colors.accent : colors.divider;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={framed ? "radio" : "checkbox"}
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={note ? `${label}. ${note}` : label}
      style={({ pressed }) => [
        styles.row,
        { minHeight, backgroundColor: checked ? colors.accentTint : "transparent" },
        framed ? { borderWidth: 1, borderColor: mark } : !last && { borderBottomWidth: 1, borderBottomColor: colors.hairline },
        pressed && !checked && { backgroundColor: colors.pressed },
        disabled && { opacity: 0.45 },
      ]}
    >
      <IconBox size={framed ? 20 : 22} borderColor={mark}>
        {checked ? <Check size={framed ? 14 : 15} color={colors.accent} strokeWidth={2.2} /> : null}
      </IconBox>
      <View style={styles.text}>
        <AppText variant={emphasis ? "heading" : "body"} numberOfLines={1}>
          {label}
        </AppText>
        {note ? (
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {note}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 8 },
  icon: { width: 24 },
  text: { flex: 1, minWidth: 0 },
});
