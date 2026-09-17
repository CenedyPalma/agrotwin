import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { colorSchemes, type ThemeColors } from "@/constants/theme";
import { useSettingsStore } from "@/stores/settingsStore";

export interface Theme {
  colors: ThemeColors;
  isDark: boolean;
  scheme: "light" | "dark";
}

/** Resolves the user's theme preference (system / light / dark) to concrete colours. */
export function useTheme(): Theme {
  const preference = useSettingsStore((s) => s.theme);
  const system = useColorScheme();
  const scheme: "light" | "dark" = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
  return useMemo(() => ({ colors: colorSchemes[scheme], isDark: scheme === "dark", scheme }), [scheme]);
}
