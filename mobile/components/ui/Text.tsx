import { Text, type TextProps } from "react-native";
import { typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { immersive } from "@/constants/theme";

export type TextVariant = keyof typeof typography;
export type TextTone =
  | "default"
  | "muted"
  | "soft"
  | "faint"
  | "accent"
  | "onAccent"
  | "healthy"
  | "attention"
  | "problem"
  | "inverse"
  | "inverseMuted";

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Tabular figures for numbers that change. */
  tabular?: boolean;
}

/** Themed text. Always use this instead of the bare RN Text so fonts and colours follow the tokens. */
export function AppText({ variant = "body", tone = "default", tabular, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const color = {
    default: colors.text,
    muted: colors.muted,
    soft: colors.soft,
    faint: colors.faint,
    accent: colors.accent,
    onAccent: colors.onAccent,
    healthy: colors.healthy,
    attention: colors.attention,
    problem: colors.problem,
    inverse: immersive.text,
    inverseMuted: immersive.textMuted,
  }[tone];
  return <Text {...rest} style={[typography[variant], { color }, tabular && { fontVariant: ["tabular-nums"] }, style]} />;
}
