import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { layout } from "@/constants/theme";
import { useRefresh } from "@/hooks/useRefresh";
import { useField } from "@/features/fields/hooks";
import { useDeleteSurvey, useSurvey, useSurveyAvailability } from "@/features/surveys/hooks";
import { useAnalysis } from "@/features/analysis/hooks";
import { useProcessingJob, useRebuildMosaic, useRecomputeAnalysis, useTriggerProcessing } from "@/features/processing/hooks";
import { useSplatAvailability } from "@/features/digitalTwin/hooks";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { describeError } from "@/services/errors";
import { surveyStatusLabel, surveyStatusTier } from "@/constants/labels";
import { useTheme } from "@/hooks/useTheme";
import { cropLabel, formatDate, formatNumber } from "@/utils/format";
import { Blueprint, Button, Disclosure, ErrorState, KeyValueRow, LoadingState, Screen, ScreenHeader, SectionHeader, AppText } from "@/components/ui";
import { SurveyAssetList } from "@/components/surveys/SurveyAssetList";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";
import { AskAiFab } from "@/components/ai/AskAiFab";

export default function SurveyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const advanced = useSettingsStore((s) => s.advancedMode);
  const setActiveSurvey = useUiStore((s) => s.setActiveSurvey);
  const [actionError, setActionError] = useState<string | null>(null);

  const survey = useSurvey(id);
  const field = useField(survey.data?.field_id);
  const availability = useSurveyAvailability(id);
  const analysis = useAnalysis(id);
  const splat = useSplatAvailability(id);
  const { job, active: processing } = useProcessingJob(id);
  const process = useTriggerProcessing(id ?? "");
  const recompute = useRecomputeAnalysis(id ?? "");
  const rebuild = useRebuildMosaic(id ?? "");
  const remove = useDeleteSurvey();
  const { refreshing, onRefresh } = useRefresh(survey.refetch, availability.refetch, analysis.refetch);

  useEffect(() => {
    if (id) setActiveSurvey(id);
  }, [id, setActiveSurvey]);

  const run = (m: { mutateAsync: () => Promise<unknown> }) => {
    setActionError(null);
    m.mutateAsync().catch((err) => {
      const d = describeError(err);
      setActionError(`${d.title}. ${d.message}`);
    });
  };

  if (survey.isPending) {
    return (
      <Screen safeTop>
        <LoadingState skeleton />
      </Screen>
    );
  }
  if (survey.isError || !survey.data) {
    return (
      <Screen safeTop refreshing={refreshing} onRefresh={onRefresh}>
        <ErrorState error={survey.error} title="Unable to load survey" onRetry={() => survey.refetch()} />
      </Screen>
    );
  }

  const s = survey.data;
  const hasImages = s.image_count > 0;
  const needsProcessing = ["PENDING", "UPLOADING"].includes(s.status) && hasImages;
  const busy = processing || process.isPending || recompute.isPending || rebuild.isPending;
  const subtitle = [field.data?.name, formatDate(s.survey_date ?? s.created_at)].filter(Boolean).join(" · ");
  const openProcessing = () => router.push({ pathname: "/processing/[surveyId]", params: { surveyId: s.id } });

  const confirmDelete = () =>
    Alert.alert("Delete this survey?", "Its analysis and generated maps are removed. Original drone files on the computer are kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutateAsync(s.id).then(() => router.replace("/(tabs)/surveys")).catch((err) => setActionError(describeError(err).message)) },
    ]);

  return (
    <Screen safeTop padded={false} refreshing={refreshing} onRefresh={onRefresh} bottomInset={layout.bottomClearance}>
      <ScreenHeader title={s.name} subtitle={subtitle} />
      <View style={styles.body}>
        {(processing || job?.status === "FAILED") && job ? (
          <View style={{ marginBottom: 18 }}>
            <ProcessingProgress job={job} compact surveyName={s.name} imageCount={s.image_count} onRetry={job.status === "FAILED" ? () => run(process) : undefined} retrying={process.isPending} />
            {processing ? <Button label="See processing steps" variant="ghost" size="md" onPress={openProcessing} fullWidth style={{ marginTop: 6 }} /> : null}
          </View>
        ) : null}

        {needsProcessing && !processing ? (
          <Blueprint style={{ marginBottom: 18 }}>
            <AppText variant="cardTitle">Ready to process</AppText>
            <AppText variant="bodySm" tone="muted" style={{ marginTop: 6 }}>
              {formatNumber(s.image_count)} images are uploaded. Processing builds the field boundary, the photo map and the health analysis on your AgroTwin computer.
            </AppText>
            <Button label="Start processing" size="md" fullWidth style={{ marginTop: 14 }} onPress={() => run(process)} loading={process.isPending} />
          </Blueprint>
        ) : null}

        {actionError ? (
          <AppText variant="bodySm" tone="problem" style={{ marginBottom: 14 }}>
            {actionError}
          </AppText>
        ) : null}

        <Blueprint style={{ marginBottom: 18 }}>
          <AppText variant="kicker" tone="accent" style={{ marginBottom: 10 }}>
            Survey overview
          </AppText>
          <KeyValueRow label="Field" value={field.data?.name ?? "…"} />
          <KeyValueRow label="Crop" value={cropLabel(field.data?.crop_type)} />
          <KeyValueRow label="Date" value={formatDate(s.survey_date ?? s.created_at)} />
          <KeyValueRow label="Drone" value={s.drone_model ?? "Unknown"} />
          <KeyValueRow label="Images" value={s.frame_count && s.frame_count !== s.image_count ? `${formatNumber(s.frame_count)} frames (${formatNumber(s.image_count)} files)` : formatNumber(s.image_count)} />
          <KeyValueRow label="Status" value={surveyStatusLabel(s.status)} valueColor={colors[surveyStatusTier(s.status)]} last />
        </Blueprint>

        <SectionHeader title="Available data" />
        <View style={{ marginBottom: 18 }}>
          {availability.isPending ? (
            <LoadingState cards={1} />
          ) : availability.isError ? (
            <ErrorState error={availability.error} onRetry={() => availability.refetch()} compact />
          ) : availability.data ? (
            <SurveyAssetList
              availability={availability.data}
              hasAnalysis={!!analysis.data}
              processing={processing}
              imageCount={s.image_count}
              zoneCount={analysis.data ? analysis.data.detections.length : null}
              splat={splat.data}
              advanced={advanced}
            />
          ) : null}
        </View>

        <View style={styles.actions}>
          <Button label="View results" size="lg" onPress={() => router.push({ pathname: "/analysis/[surveyId]", params: { surveyId: s.id } })} disabled={!analysis.data} fullWidth />
          <View style={styles.pair}>
            <Button label="View map" variant="secondary" minHeight={50} onPress={() => router.push({ pathname: "/map/[surveyId]", params: { surveyId: s.id } })} style={styles.flex} />
            <Button label="Digital twin" variant="secondary" minHeight={50} onPress={() => router.push({ pathname: "/twin/[surveyId]", params: { surveyId: s.id } })} style={styles.flex} />
          </View>
          <Button label={`View ${formatNumber(s.frame_count || s.image_count)} images`} variant="secondary" minHeight={50} onPress={() => router.push({ pathname: "/gallery/[surveyId]", params: { surveyId: s.id } })} disabled={!hasImages} fullWidth />
          <Button label="See processing steps" variant="ghost" size="md" onPress={openProcessing} fullWidth />
        </View>

        {!analysis.data && !processing && !needsProcessing ? (
          <AppText variant="small" tone="muted" style={{ marginBottom: 14 }}>
            No health analysis exists for this survey yet{hasImages ? " — use “Recompute analysis” under Advanced." : " — upload drone images first."}
          </AppText>
        ) : null}

        <Disclosure showLabel="Show advanced actions" hideLabel="Hide advanced actions">
          <AppText variant="small" tone="muted" style={{ marginBottom: 8 }}>
            These run on the AgroTwin computer in the background; the survey is locked while a job runs.
          </AppText>
          <View style={{ gap: 8 }}>
            <Button label="Recompute analysis" variant="secondary" onPress={() => run(recompute)} disabled={busy || !hasImages} loading={recompute.isPending} fullWidth />
            <Button label="Rebuild field map" variant="secondary" onPress={() => run(rebuild)} disabled={busy || !hasImages} loading={rebuild.isPending} fullWidth />
            {!needsProcessing ? <Button label="Run full pipeline again" variant="secondary" onPress={() => run(process)} disabled={busy || !hasImages} loading={process.isPending} fullWidth /> : null}
            <Button label="Delete survey" variant="danger" onPress={confirmDelete} disabled={busy} loading={remove.isPending} fullWidth />
          </View>
          <View style={{ marginTop: 8 }}>
            <KeyValueRow label="Survey id" value={s.id} mono />
            <KeyValueRow label="Field id" value={s.field_id} mono last />
          </View>
        </Disclosure>
      </View>
      <AskAiFab surveyId={s.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: layout.pagePadding },
  actions: { gap: 10, marginBottom: 18 },
  pair: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
