import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Map as MapIcon, Play } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useRefresh } from "@/hooks/useRefresh";
import { useField } from "@/features/fields/hooks";
import { useSurvey } from "@/features/surveys/hooks";
import { useAnalysis } from "@/features/analysis/hooks";
import { countBySeverity, countByType, enrichZones } from "@/features/analysis/zones";
import { useProcessingJob, useRecomputeAnalysis } from "@/features/processing/hooks";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { detectionTypeLabel, METHOD_DESCRIPTION, METHOD_LABEL } from "@/constants/labels";
import { parseGeometry } from "@/utils/geo";
import { formatDate, formatNumber } from "@/utils/format";
import { Button, Card, Chip, Disclosure, EmptyState, ErrorState, KeyValueRow, LoadingState, Screen, SectionHeader, AppText } from "@/components/ui";
import { HealthSummary } from "@/components/analysis/HealthSummary";
import { DetectionZoneCard } from "@/components/analysis/DetectionZoneCard";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";
import { AskAiFab } from "@/components/ai/AskAiFab";

type SeverityFilter = "all" | "high" | "medium" | "low";

export default function AnalysisScreen() {
  const { surveyId } = useLocalSearchParams<{ surveyId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const advanced = useSettingsStore((s) => s.advancedMode);
  const setActiveSurvey = useUiStore((s) => s.setActiveSurvey);
  const [filter, setFilter] = useState<SeverityFilter>("all");

  const survey = useSurvey(surveyId);
  const field = useField(survey.data?.field_id);
  const analysis = useAnalysis(surveyId);
  const { job, active: processing } = useProcessingJob(surveyId);
  const recompute = useRecomputeAnalysis(surveyId ?? "");
  const { refreshing, onRefresh } = useRefresh(analysis.refetch, survey.refetch);

  useEffect(() => {
    if (surveyId) setActiveSurvey(surveyId);
  }, [surveyId, setActiveSurvey]);

  const zones = useMemo(() => {
    if (!analysis.data) return [];
    const f = field.data;
    return enrichZones(analysis.data.detections, {
      center: f?.center_lat != null && f.center_lon != null ? { latitude: f.center_lat, longitude: f.center_lon } : null,
      boundary: parseGeometry(f?.boundary_geojson),
    });
  }, [analysis.data, field.data]);
  const visible = filter === "all" ? zones : zones.filter((z) => z.zone.severity === filter);
  const counts = useMemo(() => countBySeverity(analysis.data?.detections ?? []), [analysis.data]);
  const typeCounts = useMemo(() => countByType(analysis.data?.detections ?? []), [analysis.data]);

  const title = field.data ? `${field.data.name} · Analysis` : "Analysis";

  if (analysis.isPending || survey.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <LoadingState cards={3} />
      </Screen>
    );
  }
  if (analysis.isError) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Stack.Screen options={{ title }} />
        <ErrorState error={analysis.error} onRetry={() => analysis.refetch()} />
      </Screen>
    );
  }
  if (!analysis.data) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <Stack.Screen options={{ title }} />
        {processing && job ? (
          <ProcessingProgress job={job} />
        ) : (
          <EmptyState
            title="No analysis yet"
            message={
              survey.data && survey.data.image_count > 0
                ? "This survey has images but has not been analysed. Start the analysis on your computer from here."
                : "Upload drone images to this survey first, then run processing."
            }
            actionLabel={survey.data && survey.data.image_count > 0 ? "Recompute analysis" : undefined}
            onAction={survey.data && survey.data.image_count > 0 ? () => recompute.mutate() : undefined}
            secondaryLabel="Open survey"
            onSecondary={() => surveyId && router.push({ pathname: "/survey/[id]", params: { id: surveyId } })}
          />
        )}
      </Screen>
    );
  }

  const a = analysis.data;
  const toMap = (zoneId?: string) => surveyId && router.push({ pathname: "/map/[surveyId]", params: zoneId ? { surveyId, zone: zoneId } : { surveyId } });

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} bottomInset={64}>
      <Stack.Screen options={{ title }} />
      {survey.data ? (
        <AppText variant="caption" tone="muted">
          {survey.data.name} · {formatDate(survey.data.survey_date ?? survey.data.created_at)}
        </AppText>
      ) : null}

      <HealthSummary analysis={a} advanced={advanced} />

      {processing && job ? <ProcessingProgress job={job} compact /> : null}

      <Button label="View on field map" icon={<MapIcon size={18} color={colors.onBrand} />} onPress={() => toMap()} fullWidth size="lg" />

      <View>
        <SectionHeader title="Problem areas" subtitle={a.detections.length === 0 ? "Nothing was flagged in this survey" : `${a.detections.length} flagged · sorted by priority`} />
        {a.detections.length > 0 ? (
          <View style={styles.filters}>
            <Chip label={`All (${a.detections.length})`} selected={filter === "all"} onPress={() => setFilter("all")} />
            <Chip label={`High (${counts.high})`} selected={filter === "high"} onPress={() => setFilter("high")} disabled={counts.high === 0} color={colors.problem} />
            <Chip label={`Medium (${counts.medium})`} selected={filter === "medium"} onPress={() => setFilter("medium")} disabled={counts.medium === 0} color={colors.problem} />
            <Chip label={`Low (${counts.low})`} selected={filter === "low"} onPress={() => setFilter("low")} disabled={counts.low === 0} color={colors.attention} />
          </View>
        ) : null}
        {a.detections.length === 0 ? (
          <Card>
            <AppText variant="body">🟢 Vegetation cover looked consistent across the field — no zones were flagged.</AppText>
          </Card>
        ) : (
          <View style={styles.list}>
            {visible.map((v) => (
              <DetectionZoneCard key={v.zone.id} zone={v.zone} areaM2={v.areaM2} locationLabel={v.locationLabel} advanced={advanced} onViewOnMap={() => toMap(v.zone.id)} />
            ))}
          </View>
        )}
      </View>

      <Disclosure title="Advanced details" subtitle="How this analysis was produced" defaultOpen={advanced}>
        <KeyValueRow label="Method" value={METHOD_LABEL[a.method] ?? a.method} />
        <AppText variant="caption" tone="muted">
          {METHOD_DESCRIPTION[a.method] ?? ""}
        </AppText>
        <KeyValueRow label="Tier rule" value="≥80% healthy · 50–80% attention · <50% problem" />
        <KeyValueRow label="Demonstration data" value={a.is_mock ? "Yes" : "No — measured from imagery"} />
        <KeyValueRow label="Flagged zones" value={formatNumber(a.detections.length)} />
        {Object.entries(typeCounts).map(([type, n]) => (
          <KeyValueRow key={type} label={detectionTypeLabel(type)} value={formatNumber(n)} />
        ))}
        <KeyValueRow label="Zone areas" value="Approximate, computed from zone outlines" />
        <KeyValueRow label="Survey ID" value={a.survey_id} mono />
        <Button label="Recompute analysis" variant="outline" icon={<Play size={16} color={colors.text} />} onPress={() => recompute.mutate()} loading={recompute.isPending} disabled={processing} fullWidth />
      </Disclosure>

      <AskAiFab surveyId={surveyId} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  list: { gap: spacing.md },
});
