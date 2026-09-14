import { Text, type TextProps } from "react-native";
import { typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

export type TextVariant = keyof typeof typography;
export type TextTone = "default" | "muted" | "brand" | "onBrand" | "healthy" | "attention" | "problem" | "info";

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
}

/** Themed text. Always use this instead of the bare RN Text so colours follow the theme. */
export function AppText({ variant = "body", tone = "default", style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const color =
    tone === "muted"
      ? colors.textMuted
      : tone === "brand"
        ? colors.brand
        : tone === "onBrand"
          ? colors.onBrand
          : tone === "default"
            ? colors.text
            : colors[tone];
  return <Text {...rest} style={[typography[variant], { color }, style]} />;
}
