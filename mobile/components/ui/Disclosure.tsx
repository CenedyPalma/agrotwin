import { useState, type PropsWithChildren } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { radius, spacing, touchTarget } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { AppText } from "./Text";

interface DisclosureProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
}

/** Collapsible section — where technical/advanced details live. */
export function Disclosure({ title, subtitle, defaultOpen = false, children }: DisclosureProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const Icon = open ? ChevronUp : ChevronDown;
  return (
    <View style={[styles.wrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}, ${open ? "collapse" : "expand"}`}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.7 }]}
      >
        <View style={styles.titles}>
          <AppText variant="bodyStrong">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" tone="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <Icon size={20} color={colors.textMuted} />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: touchTarget + 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  titles: { flex: 1, gap: 2 },
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
});
