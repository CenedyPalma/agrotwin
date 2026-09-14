import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Calendar, Camera, Upload } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useRefresh } from "@/hooks/useRefresh";
import { useFields } from "@/features/fields/hooks";
import { useSurveys } from "@/features/surveys/hooks";
import { useAnalysis } from "@/features/analysis/hooks";
import { useProcessingJob } from "@/features/processing/hooks";
import { enrichZones } from "@/features/analysis/zones";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { formatDate, formatNumber, greeting } from "@/utils/format";
import { aggregateShares, overallHealth, sharesFromPercents } from "@/utils/health";
import { parseGeometry } from "@/utils/geo";
import { Button, Card, EmptyState, ErrorState, HealthBar, HealthIndicator, HealthLegend, LoadingState, Screen, SectionHeader, StatCard, AppText } from "@/components/ui";
import { FieldCard } from "@/components/fields/FieldCard";
import { SurveyStatus } from "@/components/surveys/SurveyStatus";
import { DetectionZoneCard } from "@/components/analysis/DetectionZoneCard";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";
import { AskAiFab } from "@/components/ai/AskAiFab";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const advanced = useSettingsStore((s) => s.advancedMode);
  const setActiveSurvey = useUiStore((s) => s.setActiveSurvey);

  const fields = useFields();
  const surveys = useSurveys();
  const recentSurvey = surveys.data?.[0] ?? null;
  const recentField = useMemo(() => fields.data?.find((f) => f.id === recentSurvey?.field_id) ?? null, [fields.data, recentSurvey]);
  const analysis = useAnalysis(recentSurvey?.id);
  const { job, active: processing } = useProcessingJob(recentSurvey?.id);
  const { refreshing, onRefresh } = useRefresh(fields.refetch, surveys.refetch, analysis.refetch);

  useEffect(() => {
    if (recentSurvey) setActiveSurvey(recentSurvey.id);
  }, [recentSurvey, setActiveSurvey]);

  const totals = useMemo(() => {
    const list = fields.data ?? [];
    const shares = aggregateShares(
      list.map((f) => ({ shares: sharesFromPercents(f.healthy_area_percent, f.attention_area_percent, f.problem_area_percent), weight: f.area_hectares }))
    );
    return { fields: list.length, surveys: surveys.data?.length ?? 0, shares, analysed: list.filter((f) => f.healthy_area_percent != null).length };
  }, [fields.data, surveys.data]);

  const attentionZones = useMemo(() => {
    if (!analysis.data) return [];
    const boundary = parseGeometry(recentField?.boundary_geojson);
    const center = recentField?.center_lat != null && recentField.center_lon != null ? { latitude: recentField.center_lat, longitude: recentField.center_lon } : null;
    return enrichZones(analysis.data.detections, { center, boundary }).slice(0, 3);
  }, [analysis.data, recentField]);

  const header = (
    <View style={styles.header}>
      <AppText variant="display">{greeting()} 👋</AppText>
      <AppText variant="body" tone="muted">
        Welcome back to AgroTwin.
      </AppText>
    </View>
  );

  if (fields.isPending || surveys.isPending) {
    return (
      <Screen safeTop>
        {header}
        <LoadingState cards={3} />
      </Screen>
    );
  }

  if (fields.isError) {
    return (
      <Screen safeTop refreshing={refreshing} onRefresh={onRefresh}>
        {header}
        <ErrorState error={fields.error} onRetry={() => fields.refetch()} />
      </Screen>
    );
  }

  const fieldList = fields.data ?? [];
  if (fieldList.length === 0) {
    return (
      <Screen safeTop refreshing={refreshing} onRefresh={onRefresh}>
        {header}
        <EmptyState
          icon={<Upload size={28} color={colors.brand} />}
          title="No fields yet"
          message="Create a field and upload a drone survey to see its health here. Large flights are best uploaded from the AgroTwin web app on your computer."
          actionLabel="Upload a survey"
          onAction={() => router.push("/upload")}
        />
      </Screen>
    );
  }

  const overall = overallHealth(totals.shares);

  return (
    <Screen safeTop refreshing={refreshing} onRefresh={onRefresh} bottomInset={64}>
      {header}

      <View>
        <SectionHeader title="Your field overview" />
        <View style={styles.statsRow}>
          <StatCard label="Total fields" value={formatNumber(totals.fields)} hint={totals.analysed < totals.fields ? `${totals.analysed} analysed` : undefined} onPress={() => router.push("/(tabs)/fields")} />
          <StatCard label="Surveys" value={formatNumber(totals.surveys)} hint={recentSurvey ? `latest ${formatDate(recentSurvey.survey_date ?? recentSurvey.created_at)}` : undefined} onPress={() => router.push("/(tabs)/surveys")} />
        </View>
      </View>

      <View>
        <SectionHeader title="Field health" subtitle={totals.fields > 1 ? "Area-weighted across your analysed fields" : undefined} />
        <Card>
          <HealthIndicator tier={overall.tier} label={overall.label} size="lg" />
          {totals.shares ? (
            <View style={styles.healthBody}>
              <HealthBar shares={totals.shares} height={14} />
              <HealthLegend shares={totals.shares} />
            </View>
          ) : (
            <AppText variant="body" tone="muted" style={styles.healthBody}>
              {processing ? "Your latest survey is still being processed." : "Process a survey to see measured field health."}
            </AppText>
          )}
        </Card>
      </View>

      {processing && job ? (
        <View>
          <SectionHeader title="Processing" actionLabel="Open survey" onAction={() => recentSurvey && router.push({ pathname: "/survey/[id]", params: { id: recentSurvey.id } })} />
          <ProcessingProgress job={job} compact />
        </View>
      ) : null}

      <View>
        <SectionHeader title="My fields" actionLabel={fieldList.length > 3 ? "See all" : undefined} onAction={() => router.push("/(tabs)/fields")} />
        <View style={styles.list}>
          {fieldList.slice(0, 3).map((field) => (
            <FieldCard key={field.id} field={field} onPress={() => router.push({ pathname: "/field/[id]", params: { id: field.id } })} compact />
          ))}
        </View>
      </View>

      {recentSurvey ? (
        <View>
          <SectionHeader title="Recent survey" />
          <Card>
            <AppText variant="heading">{recentSurvey.name}</AppText>
            {recentField ? (
              <AppText variant="caption" tone="muted">
                {recentField.name}
              </AppText>
            ) : null}
            <View style={styles.metaRow}>
              <View style={styles.meta}>
                <Calendar size={14} color={colors.textMuted} />
                <AppText variant="caption" tone="muted">
                  {formatDate(recentSurvey.survey_date ?? recentSurvey.created_at)}
                </AppText>
              </View>
              <View style={styles.meta}>
                <Camera size={14} color={colors.textMuted} />
                <AppText variant="caption" tone="muted">
                  {formatNumber(recentSurvey.frame_count || recentSurvey.image_count)} images
                </AppText>
              </View>
              <SurveyStatus status={recentSurvey.status} size="sm" />
            </View>
            <Button
              label={analysis.data ? "View results" : "Open survey"}
              onPress={() =>
                analysis.data
                  ? router.push({ pathname: "/analysis/[surveyId]", params: { surveyId: recentSurvey.id } })
                  : router.push({ pathname: "/survey/[id]", params: { id: recentSurvey.id } })
              }
              style={styles.cta}
            />
          </Card>
        </View>
      ) : null}

      {recentSurvey ? (
        <View>
          <SectionHeader
            title="Areas requiring attention"
            subtitle={analysis.data ? `${analysis.data.detections.length} flagged in the latest analysis` : undefined}
            actionLabel={analysis.data && analysis.data.detections.length > 3 ? "See all" : undefined}
            onAction={() => router.push({ pathname: "/analysis/[surveyId]", params: { surveyId: recentSurvey.id } })}
          />
          {analysis.isPending ? (
            <LoadingState cards={1} />
          ) : analysis.isError ? (
            <ErrorState error={analysis.error} onRetry={() => analysis.refetch()} compact />
          ) : !analysis.data ? (
            <Card>
              <AppText variant="body" tone="muted">
                {processing ? "Zones appear here once the analysis finishes." : "No analysis yet for the latest survey. Open it to start processing."}
              </AppText>
            </Card>
          ) : attentionZones.length === 0 ? (
            <Card>
              <AppText variant="body">🟢 No areas were flagged in the latest survey.</AppText>
            </Card>
          ) : (
            <View style={styles.list}>
              {attentionZones.map((v) => (
                <DetectionZoneCard
                  key={v.zone.id}
                  zone={v.zone}
                  areaM2={v.areaM2}
                  locationLabel={v.locationLabel}
                  compact
                  advanced={advanced}
                  onPress={() => router.push({ pathname: "/map/[surveyId]", params: { surveyId: recentSurvey.id, zone: v.zone.id } })}
                  onViewOnMap={() => router.push({ pathname: "/map/[surveyId]", params: { surveyId: recentSurvey.id, zone: v.zone.id } })}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      <AskAiFab surveyId={recentSurvey?.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginBottom: spacing.xs },
  statsRow: { flexDirection: "row", gap: spacing.md },
  healthBody: { marginTop: spacing.lg, gap: spacing.md },
  list: { gap: spacing.md },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md, marginTop: spacing.md },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  cta: { marginTop: spacing.lg },
});
