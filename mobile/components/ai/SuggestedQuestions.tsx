import { ScrollView, StyleSheet } from "react-native";
import { SUGGESTED_QUESTIONS } from "@/constants/labels";
import { spacing } from "@/constants/theme";
import { Chip } from "@/components/ui";

interface SuggestedQuestionsProps {
  onPick: (question: string) => void;
  disabled?: boolean;
}

export function SuggestedQuestions({ onPick, disabled }: SuggestedQuestionsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled" accessibilityLabel="Suggested questions">
      {SUGGESTED_QUESTIONS.map((q) => (
        <Chip key={q} label={q} onPress={() => onPick(q)} disabled={disabled} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ row: { gap: spacing.sm, paddingHorizontal: spacing.lg } });
