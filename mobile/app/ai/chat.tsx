import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkles } from "lucide-react-native";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useFields } from "@/features/fields/hooks";
import { useSurvey, useSurveys } from "@/features/surveys/hooks";
import { useField } from "@/features/fields/hooks";
import { useChat } from "@/features/ai/hooks";
import { useUiStore } from "@/stores/uiStore";
import { formatDate } from "@/utils/format";
import { Button, Card, Chip, EmptyState, ErrorState, LoadingState, AppText } from "@/components/ui";
import { ChatBubble } from "@/components/ai/ChatBubble";
import { ChatComposer } from "@/components/ai/ChatComposer";
import { SuggestedQuestions } from "@/components/ai/SuggestedQuestions";

export default function AiChatScreen() {
  const { surveyId: surveyParam } = useLocalSearchParams<{ surveyId?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const activeSurveyId = useUiStore((s) => s.activeSurveyId);
  const setActiveSurvey = useUiStore((s) => s.setActiveSurvey);

  const surveys = useSurveys();
  const fields = useFields();
  const [picking, setPicking] = useState(false);
  const [chosen, setChosen] = useState<string | null>(surveyParam ?? activeSurveyId ?? null);
  const surveyId = chosen ?? surveys.data?.[0]?.id ?? null;

  const survey = useSurvey(surveyId);
  const field = useField(survey.data?.field_id);
  const { messages, pending, send, retryLast, clear } = useChat(surveyId);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (surveyId) setActiveSurvey(surveyId);
  }, [surveyId, setActiveSurvey]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length, pending]);

  const fieldName = useMemo(() => new Map((fields.data ?? []).map((f) => [f.id, f.name])), [fields.data]);

  if (surveys.isPending) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <LoadingState />
      </View>
    );
  }
  if (surveys.isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ErrorState error={surveys.error} onRetry={() => surveys.refetch()} />
      </View>
    );
  }
  if (!surveyId) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <EmptyState
          icon={<Sparkles size={28} color={colors.brand} />}
          title="Nothing to talk about yet"
          message="The assistant explains the measured results of a survey. Upload and process a survey first."
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          headerRight: () => (messages.length > 0 ? <Button label="Clear" size="sm" variant="ghost" onPress={clear} /> : null),
        }}
      />
      <View style={[styles.context, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" tone="muted">
            Grounded in
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {field.data?.name ?? fieldName.get(survey.data?.field_id ?? "") ?? "Field"} · {survey.data ? formatDate(survey.data.survey_date ?? survey.data.created_at) : "…"}
          </AppText>
        </View>
        {(surveys.data?.length ?? 0) > 1 ? <Button label={picking ? "Done" : "Change"} size="sm" variant="ghost" onPress={() => setPicking((v) => !v)} /> : null}
      </View>
      {picking ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker} style={{ flexGrow: 0 }}>
          {(surveys.data ?? []).map((s) => (
            <Chip
              key={s.id}
              label={`${fieldName.get(s.field_id) ?? "Field"} · ${formatDate(s.survey_date ?? s.created_at)}`}
              selected={s.id === surveyId}
              onPress={() => {
                setChosen(s.id);
                setPicking(false);
              }}
            />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent} keyboardShouldPersistTaps="handled">
        <Card tone="surface2">
          <AppText variant="bodyStrong">Ask about this field</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
            Answers come from the measured analysis of the selected survey (vegetation cover, flagged zones, earlier surveys). The assistant does not look at raw
            images and never recommends specific chemicals — it points you to areas worth inspecting on the ground.
          </AppText>
        </Card>
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} onRetry={m.status === "error" ? retryLast : undefined} />
        ))}
      </ScrollView>

      <View style={[styles.suggestions, { backgroundColor: colors.background }]}>
        <SuggestedQuestions onPick={(q) => void send(q)} disabled={pending} />
      </View>
      <View style={{ paddingBottom: insets.bottom }}>
        <ChatComposer onSend={(t) => void send(t)} disabled={pending} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  context: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  picker: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  messages: { flex: 1 },
  messagesContent: { padding: spacing.lg, gap: spacing.md, borderRadius: radius.lg },
  suggestions: { paddingVertical: spacing.sm },
});
