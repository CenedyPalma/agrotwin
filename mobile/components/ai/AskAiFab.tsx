import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkles } from "lucide-react-native";
import { radius, shadow, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useUiStore } from "@/stores/uiStore";
import { AppText } from "@/components/ui";

interface AskAiFabProps {
  /** Ground the assistant in this survey (defaults to the most recently viewed one). */
  surveyId?: string | null;
  /** Extra bottom offset, e.g. when shown above a tab bar. */
  bottomOffset?: number;
}

/** Floating "Ask AI" button available on every main screen. */
export function AskAiFab({ surveyId, bottomOffset = 0 }: AskAiFabProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeSurveyId = useUiStore((s) => s.activeSurveyId);
  const target = surveyId ?? activeSurveyId;

  return (
    <Pressable
      onPress={() => router.push(target ? { pathname: "/ai/chat", params: { surveyId: target } } : "/ai/chat")}
      accessibilityRole="button"
      accessibilityLabel="Ask AgroTwin AI"
      accessibilityHint="Opens the assistant to ask about your field"
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: colors.brand, bottom: insets.bottom + spacing.lg + bottomOffset },
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
    >
      <Sparkles size={20} color={colors.onBrand} />
      <AppText variant="bodyStrong" tone="onBrand">
        Ask AI
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    ...shadow.card,
    elevation: 6,
  },
});
