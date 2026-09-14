import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { BarChart3, Globe2, Images, Map as MapIcon, Play, RefreshCw, Trash2 } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useRefresh } from "@/hooks/useRefresh";
import { useField } from "@/features/fields/hooks";
import { useDeleteSurvey, useSurvey, useSurveyAvailability } from "@/features/surveys/hooks";
import { useAnalysis } from "@/features/analysis/hooks";
import { useProcessingJob, useRebuildMosaic, useRecomputeAnalysis, useTriggerProcessing } from "@/features/processing/hooks";
import { useSplatAvailability } from "@/features/digitalTwin/hooks";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { describeError } from "@/services/errors";
import { cropLabel, formatDate, formatNumber } from "@/utils/format";
import { surveyStatusLabel } from "@/constants/labels";
import { Button, Card, Disclosure, ErrorState, KeyValueRow, LoadingState, Screen, SectionHeader, AppText } from "@/components/ui";
import { SurveyStatus } from "@/components/surveys/SurveyStatus";
import { SurveyAssetList } from "@/components/surveys/SurveyAssetList";
import { ProcessingProgress } from "@/components/processing/ProcessingProgress";
import { TwinStatusCard } from "@/components/digitalTwin/TwinStatusCard";
import type { TwinMode } from "@/components/digitalTwin/digitalTwinBridge";
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
      <Screen>
        <LoadingState cards={3} />
      </Screen>
    );
  }
  if (survey.isError || !survey.data) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <ErrorState error={survey.error} onRetry={() => survey.refetch()} />
      </Screen>
    );
  }

  const s = survey.data;
  const hasImages = s.image_count > 0;
  const needsProcessing = ["PENDING", "UPLOADING"].includes(s.status) && hasImages;
  const showJob = !!job && (processing || job.status === "FAILED");
  const busy = processing || process.isPending || recompute.isPending || rebuild.isPending;
  const openTwin = (mode: TwinMode) => router.push({ pathname: "/twin/[surveyId]", params: { surveyId: s.id, mode } });

  const confirmDelete = () =>
    Alert.alert("Delete this survey?", "Its analysis and generated maps are removed. Original drone files on the computer are kept.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => remove.mutateAsync(s.id).then(() => router.replace("/(tabs)/surveys")).catch((err) => setActionError(describeError(err).message)),
      },
    ]);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} bottomInset={64}>
      <Stack.Screen options={{ title: s.name }} />
      <View style={styles.header}>
        <AppText variant="title">{s.name}</AppText>
        <SurveyStatus status={s.status} />
      </View>

      {showJob && job ? (
        <ProcessingProgress job={job} onRetry={job.status === "FAILED" ? () => run(process) : undefined} retrying={process.isPending} />
      ) : null}

      {needsProcessing && !processing ? (
        <Card>
          <AppText variant="heading">Ready to process</AppText>
          <AppText variant="body" tone="muted">
            {formatNumber(s.image_count)} images are uploaded. Processing builds the field boundary, the photo map and the health analysis on your computer.
          </AppText>
          <Button label="Start processing" icon={<Play size={18} color={colors.onBrand} />} onPress={() => run(process)} loading={process.isPending} style={styles.cta} />
        </Card>
      ) : null}

      {actionError ? (
        <AppText variant="body" tone="problem">
          {actionError}
        </AppText>
      ) : null}

      <View>
        <SectionHeader title="Survey information" />
        <Card>
          <KeyValueRow label="Field" value={field.data?.name ?? "…"} />
          <KeyValueRow label="Crop" value={cropLabel(field.data?.crop_type)} />
          <KeyValueRow label="Date" value={formatDate(s.survey_date ?? s.created_at)} />
          <KeyValueRow label="Drone" value={s.drone_model ?? "Unknown"} />
          <KeyValueRow label="Images" value={s.frame_count && s.frame_count !== s.image_count ? `${formatNumber(s.frame_count)} frames (${formatNumber(s.image_count)} files)` : formatNumber(s.image_count)} />
          <KeyValueRow label="Status" value={surveyStatusLabel(s.status)} last />
        </Card>
      </View>

      <View style={styles.actions}>
        <Button
          label="View results"
          icon={<BarChart3 size={18} color={analysis.data ? colors.onBrand : colors.textMuted} />}
          onPress={() => router.push({ pathname: "/analysis/[surveyId]", params: { surveyId: s.id } })}
          disabled={!analysis.data}
          fullWidth
          size="lg"
        />
        <Button label="View map" variant="outline" icon={<MapIcon size={18} color={colors.text} />} onPress={() => router.push({ pathname: "/map/[surveyId]", params: { surveyId: s.id } })} fullWidth size="lg" />
        <Button label="View Digital Twin" variant="outline" icon={<Globe2 size={18} color={colors.text} />} onPress={() => openTwin("field-map")} fullWidth size="lg" />
        <Button
          label={`View drone images (${formatNumber(s.frame_count || s.image_count)})`}
          variant="outline"
          icon={<Images size={18} color={colors.text} />}
          onPress={() => router.push({ pathname: "/gallery/[surveyId]", params: { surveyId: s.id } })}
          disabled={!hasImages}
          fullWidth
          size="lg"
        />
      </View>

      {!analysis.data && !processing && !needsProcessing ? (
        <AppText variant="caption" tone="muted">
          No health analysis exists for this survey yet{hasImages ? " — use “Recompute analysis” below." : " — upload drone images first."}
        </AppText>
      ) : null}

      {availability.isPending ? (
        <LoadingState cards={1} />
      ) : availability.isError ? (
        <ErrorState error={availability.error} onRetry={() => availability.refetch()} compact />
      ) : availability.data ? (
        <SurveyAssetList availability={availability.data} hasAnalysis={!!analysis.data} advanced={advanced} />
      ) : null}

      <TwinStatusCard availability={availability.data} hasImages={hasImages} splat={splat.data} processing={processing} onOpen={openTwin} />

      <Disclosure title="Advanced" subtitle="Reprocessing and maintenance">
        <AppText variant="caption" tone="muted">
          These run on the AgroTwin computer in the background; the survey is locked while a job runs.
        </AppText>
        <Button label="Recompute analysis" variant="outline" icon={<RefreshCw size={16} color={colors.text} />} onPress={() => run(recompute)} disabled={busy || !hasImages} loading={recompute.isPending} fullWidth />
        <Button label="Rebuild field map" variant="outline" icon={<MapIcon size={16} color={colors.text} />} onPress={() => run(rebuild)} disabled={busy || !hasImages} loading={rebuild.isPending} fullWidth />
        {!needsProcessing ? (
          <Button label="Run full pipeline again" variant="outline" icon={<Play size={16} color={colors.text} />} onPress={() => run(process)} disabled={busy || !hasImages} loading={process.isPending} fullWidth />
        ) : null}
        <Button label="Delete survey" variant="danger" icon={<Trash2 size={16} color={colors.problem} />} onPress={confirmDelete} disabled={busy} loading={remove.isPending} fullWidth />
        <KeyValueRow label="Survey ID" value={s.id} mono />
        <KeyValueRow label="Field ID" value={s.field_id} mono last />
      </Disclosure>

      <AskAiFab surveyId={s.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  actions: { gap: spacing.sm },
  cta: { marginTop: spacing.md },
});
