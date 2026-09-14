import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { BarChart3, Camera, Globe2, Map as MapIcon, Sparkles } from "lucide-react-native";
import { spacing, status } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useRefresh } from "@/hooks/useRefresh";
import { useField, useFieldSurveys } from "@/features/fields/hooks";
import { useAnalysis } from "@/features/analysis/hooks";
import { useProcessingJob } from "@/features/processing/hooks";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { cropLabel, formatDate, formatMonthYear, formatNumber, seasonOf } from "@/utils/format";
import { sharesFromPercents } from "@/utils/health";
import { Button, Card, Chip, ErrorState, LoadingState, Screen, SectionHeader, AppText } from "@/components/ui";
import { FieldHealthSummary } from "@/components/fields/FieldHealthSummary";
import { FieldStats } from "@/components/fields/FieldStats";
import { SurveyStatus } from "@/components/surveys/SurveyStatus";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";
import { AskAiFab } from "@/components/ai/AskAiFab";

export default function FieldDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const advanced = useSettingsStore((s) => s.advancedMode);
  const setActiveSurvey = useUiStore((s) => s.setActiveSurvey);
  const setActiveField = useUiStore((s) => s.setActiveField);

  const field = useField(id);
  const surveys = useFieldSurveys(id);
  const latest = surveys.data?.[0] ?? null;
  const analysis = useAnalysis(latest?.id);
  const { job, active: processing } = useProcessingJob(latest?.id);
  const { refreshing, onRefresh } = useRefresh(field.refetch, surveys.refetch, analysis.refetch);

  useEffect(() => {
    setActiveField(id ?? null);
    if (latest) setActiveSurvey(latest.id);
  }, [id, latest, setActiveField, setActiveSurvey]);

  const seasons = useMemo(() => {
    const groups = new Map<string, typeof surveys.data>();
    for (const s of surveys.data ?? []) {
      const key = seasonOf(s.survey_date ?? s.created_at);
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return Array.from(groups.entries());
  }, [surveys.data]);

  if (field.isPending) {
    return (
      <Screen>
        <LoadingState cards={3} />
      </Screen>
    );
  }
  if (field.isError || !field.data) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <ErrorState error={field.error} onRetry={() => field.refetch()} />
      </Screen>
    );
  }

  const f = field.data;
  const shares = sharesFromPercents(f.healthy_area_percent, f.attention_area_percent, f.problem_area_percent);
  const go = (pathname: "/map/[surveyId]" | "/analysis/[surveyId]" | "/twin/[surveyId]") =>
    latest && router.push({ pathname, params: { surveyId: latest.id } });

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} bottomInset={64}>
      <Stack.Screen options={{ title: f.name }} />
      <View style={styles.header}>
        <AppText variant="display">{f.name}</AppText>
        <View style={styles.chips}>
          <Chip label={cropLabel(f.crop_type)} selected />
          {latest ? <Chip label={seasonOf(latest.survey_date ?? latest.created_at)} /> : null}
        </View>
      </View>

      <FieldHealthSummary shares={shares} method={f.analysis_method} isMock={f.analysis_is_mock} advanced={advanced} />

      {processing && job ? <ProcessingProgress job={job} compact /> : null}

      <FieldStats field={f} surveys={surveys.data} zoneCount={analysis.data ? analysis.data.detections.length : null} />

      <View>
        <SectionHeader title="Latest survey" />
        {surveys.isPending ? (
          <LoadingState cards={1} />
        ) : latest ? (
          <Card onPress={() => router.push({ pathname: "/survey/[id]", params: { id: latest.id } })} accessibilityLabel={`Open survey ${latest.name}`}>
            <AppText variant="heading">{formatMonthYear(latest.survey_date ?? latest.created_at)}</AppText>
            <AppText variant="caption" tone="muted">
              {latest.name}
            </AppText>
            <View style={styles.metaRow}>
              <View style={styles.meta}>
                <Camera size={14} color={colors.textMuted} />
                <AppText variant="caption" tone="muted">
                  {formatNumber(latest.frame_count || latest.image_count)} images
                </AppText>
              </View>
              <SurveyStatus status={latest.status} size="sm" />
            </View>
            <Button label="View survey" variant="outline" onPress={() => router.push({ pathname: "/survey/[id]", params: { id: latest.id } })} style={styles.cta} />
          </Card>
        ) : (
          <Card>
            <AppText variant="body" tone="muted">
              No surveys of this field yet.
            </AppText>
            <Button label="Upload a survey" variant="outline" onPress={() => router.push({ pathname: "/upload", params: { fieldId: f.id } })} style={styles.cta} />
          </Card>
        )}
      </View>

      <View style={styles.actions}>
        <Button label="View field map" icon={<MapIcon size={18} color={colors.onBrand} />} onPress={() => go("/map/[surveyId]")} disabled={!latest} fullWidth size="lg" />
        <Button label="View analysis" variant="outline" icon={<BarChart3 size={18} color={colors.text} />} onPress={() => go("/analysis/[surveyId]")} disabled={!latest} fullWidth size="lg" />
        <Button label="View Digital Twin" variant="outline" icon={<Globe2 size={18} color={colors.text} />} onPress={() => go("/twin/[surveyId]")} disabled={!latest} fullWidth size="lg" />
        <Button
          label="Ask AgroTwin AI"
          variant="outline"
          icon={<Sparkles size={18} color={colors.text} />}
          onPress={() => router.push(latest ? { pathname: "/ai/chat", params: { surveyId: latest.id } } : "/ai/chat")}
          fullWidth
          size="lg"
        />
      </View>

      {seasons.length > 0 ? (
        <View>
          <SectionHeader title="Field history" subtitle="Surveys by season — compare them over time" />
          <Card>
            {seasons.map(([season, list], si) => (
              <View key={season} style={si > 0 ? { marginTop: spacing.lg } : undefined}>
                <AppText variant="label" tone="muted" style={{ marginBottom: spacing.sm }}>
                  {season}
                </AppText>
                {(list ?? []).map((s, i) => (
                  <View key={s.id} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={[styles.dot, { backgroundColor: s.status === "COMPLETED" ? status.healthy : s.status === "FAILED" ? status.problem : status.info }]} />
                      {i < (list?.length ?? 0) - 1 ? <View style={[styles.rail, { backgroundColor: colors.border }]} /> : null}
                    </View>
                    <Card
                      tone="surface2"
                      style={styles.timelineCard}
                      onPress={() => router.push({ pathname: "/survey/[id]", params: { id: s.id } })}
                      accessibilityLabel={`Survey ${s.name}, ${formatDate(s.survey_date ?? s.created_at)}`}
                    >
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {formatDate(s.survey_date ?? s.created_at)}
                      </AppText>
                      <AppText variant="caption" tone="muted" numberOfLines={1}>
                        {s.name} · {formatNumber(s.frame_count || s.image_count)} images
                      </AppText>
                    </Card>
                  </View>
                ))}
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <AskAiFab surveyId={latest?.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md, flexWrap: "wrap" },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  cta: { marginTop: spacing.md },
  actions: { gap: spacing.sm },
  timelineRow: { flexDirection: "row", gap: spacing.md },
  timelineRail: { width: 16, alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 14 },
  rail: { width: 2, flex: 1, marginTop: 2 },
  timelineCard: { flex: 1, marginBottom: spacing.sm, padding: spacing.md },
});
