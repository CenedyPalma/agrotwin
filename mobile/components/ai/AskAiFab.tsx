import { Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bot } from "lucide-react-native";
import { layout } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useUiStore } from "@/stores/uiStore";

interface AskAiFabProps {
  /** Ground the assistant in this survey (defaults to the most recently viewed one). */
  surveyId?: string | null;
  /** True on tab screens so the button clears the tab bar (canvas: bottom 98 px). */
  aboveTabBar?: boolean;
}

/** Canvas FAB: 60 px solid accent square with the bot icon, right 18 px. */
export function AskAiFab({ surveyId, aboveTabBar = false }: AskAiFabProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const activeSurveyId = useUiStore((s) => s.activeSurveyId);
  const target = surveyId ?? activeSurveyId;
  const bottom = aboveTabBar ? Math.max(insets.bottom, 10) + layout.tabBarHeight + 26 : insets.bottom + 24;

  return (
    <Pressable
      onPress={() => router.push(target ? { pathname: "/ai/chat", params: { surveyId: target } } : "/ai/chat")}
      accessibilityRole="button"
      accessibilityLabel="Ask AgroTwin AI"
      accessibilityHint="Opens the assistant to ask about your field"
      style={({ pressed }) => [styles.fab, { backgroundColor: colors.accent, borderColor: colors.accent, bottom }, colors.shadowLg, pressed && { opacity: 0.85 }]}
    >
      <Bot size={27} color={colors.onAccent} strokeWidth={1.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: { position: "absolute", right: layout.pagePadding, width: layout.fabSize, height: layout.fabSize, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
