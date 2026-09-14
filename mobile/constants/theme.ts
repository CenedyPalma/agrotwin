/**
 * Design tokens — mirrors DESIGN.md at the repository root so the mobile
 * client and the web client share one visual language. Never use raw hex
 * values in components; import from here.
 */
import type { TextStyle } from "react-native";

/** Semantic status colours. Their meaning never changes across the app. */
export const status = {
  healthy: "#22c55e",
  attention: "#eab308",
  problem: "#ef4444",
  info: "#3b82f6",
  neutral: "#5c6b5f",
} as const;

export type StatusTier = keyof typeof status;

export const brand = {
  primary: "#16a34a",
  dark: "#0f7a37",
  light: "#4ade80",
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textMuted: string;
  brand: string;
  onBrand: string;
  overlay: string;
  skeleton: string;
  healthy: string;
  attention: string;
  problem: string;
  info: string;
  neutral: string;
}

const lightColors: ThemeColors = {
  background: "#f6f8f6",
  surface: "#ffffff",
  surface2: "#f0f3f0",
  border: "#e2e8e2",
  text: "#121813",
  textMuted: "#5c6b5f",
  brand: brand.primary,
  onBrand: "#ffffff",
  overlay: "rgba(18, 24, 19, 0.55)",
  skeleton: "#e6ebe6",
  ...status,
};

const darkColors: ThemeColors = {
  background: "#0b0f0c",
  surface: "#121812",
  surface2: "#171f17",
  border: "#223022",
  text: "#edf2ed",
  textMuted: "#93a396",
  brand: brand.light,
  onBrand: "#0b0f0c",
  overlay: "rgba(0, 0, 0, 0.6)",
  skeleton: "#1d271d",
  ...status,
};

export const colorSchemes: Record<"light" | "dark", ThemeColors> = { light: lightColors, dark: darkColors };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/** Minimum touch target (WCAG 2.5.5 / Android guidance). */
export const touchTarget = 48;

export const typography = {
  display: { fontSize: 30, fontWeight: "700", letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: "600" },
  caption: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  label: { fontSize: 12, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  stat: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
} satisfies Record<string, TextStyle>;

export const shadow = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;

/** Colours used to draw geometry on the map, keyed by status tier. */
export const mapColors = {
  fieldStroke: brand.primary,
  fieldFill: "rgba(22, 163, 74, 0.08)",
  imagePoint: "rgba(59, 130, 246, 0.9)",
  zone: {
    healthy: { stroke: status.healthy, fill: "rgba(34, 197, 94, 0.35)" },
    attention: { stroke: status.attention, fill: "rgba(234, 179, 8, 0.4)" },
    problem: { stroke: status.problem, fill: "rgba(239, 68, 68, 0.45)" },
    info: { stroke: status.info, fill: "rgba(59, 130, 246, 0.3)" },
    neutral: { stroke: status.neutral, fill: "rgba(92, 107, 95, 0.3)" },
  } satisfies Record<StatusTier, { stroke: string; fill: string }>,
} as const;
