import { useState, type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "./Button";

interface DisclosureProps extends PropsWithChildren {
  /** Label when closed / open (design: "Show advanced details" / "Hide advanced details"). */
  showLabel?: string;
  hideLabel?: string;
  defaultOpen?: boolean;
}

/** Ghost toggle + rule-topped body: where technical details live (canvas `z.toggleAdv`). */
export function Disclosure({ showLabel = "Show advanced details", hideLabel = "Hide advanced details", defaultOpen = false, children }: DisclosureProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View>
      <Button label={open ? hideLabel : showLabel} variant="ghost" align="start" onPress={() => setOpen((v) => !v)} accessibilityHint={open ? "Collapses the details" : "Expands the details"} style={styles.toggle} />
      {open ? <View style={[styles.body, { borderTopColor: colors.divider }]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { marginTop: 6, alignSelf: "stretch" },
  body: { borderTopWidth: 1, paddingTop: 10, gap: 2 },
});
