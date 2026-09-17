import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Bot, Camera, Check, Cuboid, Map as MapIcon, RefreshCw, Sprout } from "lucide-react-native";
import { iconStroke, layout } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useRefresh } from "@/hooks/useRefresh";
import { useFields } from "@/features/fields/hooks";
import { useSurveys } from "@/features/surveys/hooks";
import { useAnalysis } from "@/features/analysis/hooks";
import { useProcessingJob } from "@/features/processing/hooks";
import { enrichZones } from "@/features/analysis/zones";
import { useAuth } from "@/providers/AuthProvider";
import { useUiStore } from "@/stores/uiStore";
import { formatDate, formatDateTime, formatNumber, formatShortDate, greeting, relativeDay } from "@/utils/format";
import { aggregateShares, overallHealth, sharesFromPercents } from "@/utils/health";
import { parseGeometry } from "@/utils/geo";
import { Blueprint, Button, EmptyState, ErrorState, HealthBar, HealthDonut, HealthLegendRows, IconButton, LoadingState, RefreshingNote, Screen, SectionHeader, Swatch, AppText } from "@/components/ui";
import { FieldCard } from "@/components/fields/FieldCard";
import { AttentionRow } from "@/components/analysis/DetectionZoneCard";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";
import { AskAiFab } from "@/components/ai/AskAiFab";

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { userName } = useAuth();
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

  const lastSurveyByField = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of surveys.data ?? []) if (!map.has(s.field_id)) map.set(s.field_id, s.survey_date ?? s.created_at);
    return map;
  }, [surveys.data]);

  const totals = useMemo(() => {
    const list = fields.data ?? [];
    const analysed = list.filter((f) => f.healthy_area_percent != null);
    const shares = aggregateShares(analysed.map((f) => ({ shares: sharesFromPercents(f.healthy_area_percent, f.attention_area_percent, f.problem_area_percent), weight: f.area_hectares })));
    const hectares = analysed.reduce((sum, f) => sum + (f.area_hectares ?? 0), 0);
    const latest = (surveys.data ?? []).map((s) => s.created_at).sort().at(-1) ?? null;
    return { fields: list.length, analysed: analysed.length, surveys: surveys.data?.length ?? 0, shares, hectares, latest };
  }, [fields.data, surveys.data]);

  const attention = useMemo(() => {
    if (!analysis.data) return [];
    const boundary = parseGeometry(recentField?.boundary_geojson);
    const center = recentField?.center_lat != null && recentField.center_lon != null ? { latitude: recentField.center_lat, longitude: recentField.center_lon } : null;
    return enrichZones(analysis.data.detections, { center, boundary }).filter((z) => z.zone.severity !== "low").slice(0, 2);
  }, [analysis.data, recentField]);

  const header = (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <AppText variant="greeting">
          {greeting()}
          {userName ? `, ${userName}` : ""}
        </AppText>
        <AppText variant="bodySm" tone="muted" style={{ marginTop: 2 }}>
          Here's how your fields are doing today.
        </AppText>
      </View>
      <IconButton icon={<RefreshCw size={20} color={colors.text} strokeWidth={iconStroke} />} accessibilityLabel="Refresh fields" onPress={() => void onRefresh()} />
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
          icon={<Sprout size={52} color={colors.accent} strokeWidth={1.2} />}
          title="No fields yet"
          message="Add a field and fly it once — we'll take it from there."
          actionLabel="Add your first field"
          onAction={() => router.push("/upload")}
        />
      </Screen>
    );
  }

  const overall = overallHealth(totals.shares);
  const zoneCount = analysis.data?.detections.length ?? null;

  return (
    <Screen safeTop refreshing={refreshing} onRefresh={onRefresh} bottomInset={layout.bottomClearance}>
      {header}

      {refreshing ? (
        <View style={{ gap: 14 }}>
          <LoadingState cards={3} />
          <RefreshingNote />
        </View>
      ) : (
        <>
          <Blueprint padding={18} style={{ marginBottom: 22 }}>
            <AppText variant="kicker" tone="accent">
              Field health · all fields
            </AppText>
            {totals.shares ? (
              <>
                <View style={styles.donutRow}>
                  <HealthDonut shares={totals.shares} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.statusRow}>
                      <Swatch color={colors[overall.tier]} />
                      <AppText variant="number" style={{ lineHeight: 25 }}>
                        {overall.label}
                      </AppText>
                    </View>
                    <View style={{ marginTop: 12 }}>
                      <HealthLegendRows shares={totals.shares} />
                    </View>
                  </View>
                </View>
                <View style={{ marginTop: 16 }}>
                  <HealthBar shares={totals.shares} height={10} />
                </View>
                <AppText variant="small" tone="muted" style={{ marginTop: 10 }}>
                  Based on {totals.analysed} analysed {totals.analysed === 1 ? "field" : "fields"} across {totals.hectares.toFixed(1)} ha
                  {totals.latest ? ` · last updated ${relativeDay(totals.latest)}` : ""}
                </AppText>
              </>
            ) : (
              <AppText variant="bodySm" tone="muted" style={{ marginTop: 10 }}>
                {processing ? "Your latest survey is still being processed — health appears here when it finishes." : "Process a survey to see measured field health."}
              </AppText>
            )}
          </Blueprint>

          {processing && job && recentSurvey ? (
            <View style={{ marginBottom: 24 }}>
              <SectionHeader title="Processing" actionLabel="See steps" onAction={() => router.push({ pathname: "/processing/[surveyId]", params: { surveyId: recentSurvey.id } })} />
              <ProcessingProgress job={job} compact surveyName={recentSurvey.name} imageCount={recentSurvey.image_count} />
            </View>
          ) : null}

          {recentSurvey ? (
            <View style={{ marginBottom: 24 }}>
              <SectionHeader
                title="Needs your attention"
                actionLabel={zoneCount ? `All ${zoneCount}` : undefined}
                onAction={() => router.push({ pathname: "/analysis/[surveyId]", params: { surveyId: recentSurvey.id } })}
                meta={!zoneCount && analysis.data ? "Nothing flagged" : undefined}
              />
              {analysis.isPending ? (
                <LoadingState cards={1} />
              ) : analysis.isError ? (
                <ErrorState error={analysis.error} onRetry={() => analysis.refetch()} compact />
              ) : !analysis.data ? (
                <Blueprint padding={14}>
                  <AppText variant="bodySm" tone="muted">
                    {processing ? "Zones appear here once the analysis finishes." : "No analysis yet for the latest survey. Open it to start processing."}
                  </AppText>
                </Blueprint>
              ) : attention.length === 0 ? (
                <Blueprint padding={14}>
                  <View style={styles.statusRow}>
                    <Check size={18} color={colors.healthy} strokeWidth={1.8} />
                    <AppText variant="bodySm">{zoneCount ? "Only low-priority areas were flagged in the latest survey." : "No areas were flagged in the latest survey."}</AppText>
                  </View>
                </Blueprint>
              ) : (
                <View style={{ gap: 10 }}>
                  {attention.map((v) => (
                    <AttentionRow
                      key={v.zone.id}
                      zone={v.zone}
                      locationLabel={v.locationLabel}
                      areaM2={v.areaM2}
                      fieldName={recentField?.name}
                      onViewOnMap={() => router.push({ pathname: "/map/[surveyId]", params: { surveyId: recentSurvey.id, zone: v.zone.id } })}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : null}

          <View style={{ marginBottom: 24 }}>
            <SectionHeader title="Your fields" actionLabel={fieldList.length > 3 ? `All ${fieldList.length}` : undefined} onAction={() => router.push("/(tabs)/fields")} />
            <View style={{ gap: 10 }}>
              {fieldList.slice(0, 3).map((field) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  zoneCount={field.id === recentField?.id ? zoneCount : undefined}
                  lastSurveyLabel={lastSurveyByField.has(field.id) ? relativeDay(lastSurveyByField.get(field.id)) : null}
                  onPress={() => router.push({ pathname: "/field/[id]", params: { id: field.id } })}
                />
              ))}
            </View>
          </View>

          {recentSurvey ? (
            <View style={{ marginBottom: 24 }}>
              <SectionHeader title="Recent survey" />
              <Blueprint padding={16}>
                <AppText variant="cardTitle" numberOfLines={2}>
                  {recentSurvey.name}
                </AppText>
                <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {formatDateTime(recentSurvey.survey_date ?? recentSurvey.created_at)}
                </AppText>
                <View style={styles.factGrid}>
                  <View style={styles.fact}>
                    <Cuboid size={18} color={colors.accent} strokeWidth={iconStroke} />
                    <AppText variant="bodySm" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {recentSurvey.drone_model ?? "Unknown drone"}
                    </AppText>
                  </View>
                  <View style={styles.fact}>
                    <Camera size={18} color={colors.accent} strokeWidth={iconStroke} />
                    <AppText variant="bodySm">{formatNumber(recentSurvey.frame_count || recentSurvey.image_count)} images</AppText>
                  </View>
                </View>
                <View style={[styles.statusRow, { marginTop: 14 }]}>
                  {analysis.data ? (
                    <>
                      <Check size={18} color={colors.healthy} strokeWidth={1.8} />
                      <AppText variant="bodySmStrong" tone="healthy">
                        Analysis complete
                      </AppText>
                    </>
                  ) : (
                    <>
                      <Swatch color={processing ? colors.accent : colors.neutral} size={10} />
                      <AppText variant="bodySmStrong" tone="muted">
                        {processing ? "Processing" : "No analysis yet"}
                      </AppText>
                    </>
                  )}
                </View>
                <Button
                  label={analysis.data ? "View results" : "Open survey"}
                  size="md"
                  fullWidth
                  style={{ marginTop: 7 }}
                  onPress={() =>
                    analysis.data
                      ? router.push({ pathname: "/analysis/[surveyId]", params: { surveyId: recentSurvey.id } })
                      : router.push({ pathname: "/survey/[id]", params: { id: recentSurvey.id } })
                  }
                />
              </Blueprint>
            </View>
          ) : null}

          <View>
            <SectionHeader title="Quick actions" />
            <View style={styles.quickGrid}>
              {[
                { label: "View map", icon: MapIcon, go: () => recentSurvey && router.push({ pathname: "/map/[surveyId]", params: { surveyId: recentSurvey.id } }) },
                { label: "Ask AI", icon: Bot, go: () => router.push(recentSurvey ? { pathname: "/ai/chat", params: { surveyId: recentSurvey.id } } : "/ai/chat") },
                { label: "Survey images", icon: Camera, go: () => recentSurvey && router.push({ pathname: "/gallery/[surveyId]", params: { surveyId: recentSurvey.id } }) },
                { label: "Digital twin", icon: Cuboid, go: () => recentSurvey && router.push({ pathname: "/twin/[surveyId]", params: { surveyId: recentSurvey.id } }) },
              ].map((q) => (
                <Blueprint key={q.label} padding={14} style={styles.quick} onPress={q.go} accessibilityLabel={q.label}>
                  <q.icon size={24} color={colors.accent} strokeWidth={iconStroke} />
                  <AppText variant="headingSm">{q.label}</AppText>
                </Blueprint>
              ))}
            </View>
          </View>
        </>
      )}

      <AskAiFab surveyId={recentSurvey?.id} aboveTabBar />
    </Screen>
  );
}

// Keep formatShortDate / formatDate imported for the timeline labels used by other screens.
void formatShortDate;
void formatDate;

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 20, marginTop: 14 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  factGrid: { flexDirection: "row", gap: 12, marginTop: 14 },
  fact: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quick: { width: "48%", flexGrow: 1, minHeight: 92, justifyContent: "space-between", alignItems: "flex-start", gap: 10, paddingVertical: 16 },
});
