import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FileUp, ImagePlus, Monitor } from "lucide-react-native";
import { mobileUploadSoftLimit } from "@/constants/config";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useCreateField, useFields } from "@/features/fields/hooks";
import { useCreateSurvey, useSurveys } from "@/features/surveys/hooks";
import { pickAssetFile, pickDroneImages, pickImageFiles } from "@/features/upload/pickers";
import { useUploadFlow } from "@/features/upload/useUploadFlow";
import { IMPORTABLE_ASSET_TYPES, type ImportableAssetType } from "@/services/assets";
import { describeError } from "@/services/errors";
import type { LocalFile } from "@/services/surveys";
import { formatDate, formatNumber, plural } from "@/utils/format";
import { Button, Card, Chip, ErrorState, LoadingState, Screen, SectionHeader, AppText } from "@/components/ui";
import { NewFieldForm } from "@/components/upload/NewFieldForm";
import { NewSurveyForm } from "@/components/upload/NewSurveyForm";
import { UploadProgressCard } from "@/components/upload/UploadProgressCard";

type Mode = "images" | "asset";

export default function UploadScreen() {
  const params = useLocalSearchParams<{ fieldId?: string; surveyId?: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const fields = useFields();
  const surveys = useSurveys();
  const createField = useCreateField();
  const createSurvey = useCreateSurvey();

  const [fieldId, setFieldId] = useState<string | null>(params.fieldId ?? null);
  const [newField, setNewField] = useState(false);
  const [surveyId, setSurveyId] = useState<string | null>(params.surveyId ?? null);
  const [newSurvey, setNewSurvey] = useState(false);
  const [mode, setMode] = useState<Mode>("images");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [assetType, setAssetType] = useState<ImportableAssetType>("orthomosaic");
  const [assetFile, setAssetFile] = useState<LocalFile | null>(null);
  const [startProcessing, setStartProcessing] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const { progress, uploadImages, uploadAsset, cancel, reset } = useUploadFlow(surveyId);

  // A survey chosen via deep link implies its field.
  useEffect(() => {
    if (params.surveyId && surveys.data) {
      const s = surveys.data.find((x) => x.id === params.surveyId);
      if (s) setFieldId(s.field_id);
    }
  }, [params.surveyId, surveys.data]);

  const fieldSurveys = useMemo(() => (surveys.data ?? []).filter((s) => s.field_id === fieldId), [surveys.data, fieldId]);
  const openSurveys = fieldSurveys.filter((s) => ["PENDING", "UPLOADING", "COMPLETED", "FAILED"].includes(s.status));
  const busy = progress.state === "UPLOADING" || progress.state === "PROCESSING";

  const onCreateField = async (v: { name: string; crop_type: string }) => {
    setFormError(null);
    try {
      const created = await createField.mutateAsync({ name: v.name, crop_type: v.crop_type });
      setFieldId(created.id);
      setNewField(false);
    } catch (err) {
      setFormError(describeError(err).message);
    }
  };

  const onCreateSurvey = async (v: { field_id: string; name: string; drone_model?: string }) => {
    setFormError(null);
    try {
      const created = await createSurvey.mutateAsync({ field_id: v.field_id, name: v.name, drone_model: v.drone_model || undefined });
      setSurveyId(created.id);
      setNewSurvey(false);
    } catch (err) {
      setFormError(describeError(err).message);
    }
  };

  const choose = async (fn: () => Promise<LocalFile[] | null>) => {
    setPickError(null);
    try {
      const picked = await fn();
      if (picked === null) {
        setPickError("Photo library permission was not granted.");
        return;
      }
      setFiles((prev) => {
        const seen = new Set(prev.map((f) => f.name));
        return [...prev, ...picked.filter((f) => !seen.has(f.name))];
      });
    } catch (err) {
      setPickError(describeError(err).message);
    }
  };

  const chooseAsset = async () => {
    setPickError(null);
    try {
      const picked = await pickAssetFile();
      if (picked) setAssetFile(picked);
    } catch (err) {
      setPickError(describeError(err).message);
    }
  };

  const start = () => {
    if (!surveyId) return;
    if (mode === "images") void uploadImages(files, startProcessing);
    else if (assetFile) void uploadAsset(assetType, assetFile);
  };

  if (fields.isPending || surveys.isPending) {
    return (
      <Screen>
        <LoadingState cards={2} />
      </Screen>
    );
  }
  if (fields.isError) {
    return (
      <Screen>
        <ErrorState error={fields.error} onRetry={() => fields.refetch()} />
      </Screen>
    );
  }

  const canUpload = !!surveyId && !busy && (mode === "images" ? files.length > 0 : !!assetFile);

  return (
    <Screen>
      <Card tone="surface2">
        <View style={styles.row}>
          <Monitor size={20} color={colors.brand} />
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            Large drone surveys: upload from your computer
          </AppText>
        </View>
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          A full flight is often a thousand photos and many gigabytes. Use the AgroTwin web app on the computer that runs the backend for those. The phone is
          great for small batches, single photos, imported results and testing.
        </AppText>
      </Card>

      <View>
        <SectionHeader title="1 · Field" actionLabel={newField ? "Choose existing" : "New field"} onAction={() => setNewField((v) => !v)} />
        {newField ? (
          <Card>
            <NewFieldForm onSubmit={onCreateField} submitting={createField.isPending} error={formError} />
          </Card>
        ) : (fields.data ?? []).length === 0 ? (
          <Card>
            <AppText variant="body" tone="muted">
              No fields yet — create one.
            </AppText>
            <Button label="New field" variant="outline" onPress={() => setNewField(true)} style={{ marginTop: spacing.md }} />
          </Card>
        ) : (
          <View style={styles.chips}>
            {(fields.data ?? []).map((f) => (
              <Chip key={f.id} label={f.name} selected={fieldId === f.id} onPress={() => { setFieldId(f.id); setSurveyId(null); }} disabled={busy} />
            ))}
          </View>
        )}
      </View>

      {fieldId ? (
        <View>
          <SectionHeader title="2 · Survey" actionLabel={newSurvey ? "Choose existing" : "New survey"} onAction={() => setNewSurvey((v) => !v)} />
          {newSurvey || openSurveys.length === 0 ? (
            <Card>
              {openSurveys.length === 0 && !newSurvey ? (
                <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.md }}>
                  This field has no surveys yet — create the first one.
                </AppText>
              ) : null}
              <NewSurveyForm key={fieldId} fieldId={fieldId} onSubmit={onCreateSurvey} submitting={createSurvey.isPending} error={formError} />
            </Card>
          ) : (
            <View style={styles.chips}>
              {openSurveys.map((s) => (
                <Chip key={s.id} label={`${s.name} · ${formatDate(s.survey_date ?? s.created_at)}`} selected={surveyId === s.id} onPress={() => setSurveyId(s.id)} disabled={busy} />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {surveyId ? (
        <View>
          <SectionHeader title="3 · What to upload" />
          <View style={[styles.chips, { marginBottom: spacing.md }]}>
            <Chip label="Drone images" selected={mode === "images"} onPress={() => setMode("images")} disabled={busy} />
            <Chip label="Processed file" selected={mode === "asset"} onPress={() => setMode("asset")} disabled={busy} />
          </View>
          {mode === "images" ? (
            <Card>
              <AppText variant="caption" tone="muted">
                JPG or TIFF drone frames with GPS. Files already on the server (same name and size) are skipped, so you can retry safely.
              </AppText>
              <View style={[styles.row, { marginTop: spacing.md, flexWrap: "wrap" }]}>
                <Button label="Choose photos" variant="outline" icon={<ImagePlus size={16} color={colors.text} />} onPress={() => choose(pickDroneImages)} disabled={busy} />
                <Button label="Choose files" variant="outline" icon={<FileUp size={16} color={colors.text} />} onPress={() => choose(pickImageFiles)} disabled={busy} />
              </View>
              {files.length > 0 ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <AppText variant="bodyStrong">{plural(files.length, "file")} selected</AppText>
                  <AppText variant="caption" tone="muted" numberOfLines={2}>
                    {files
                      .slice(0, 4)
                      .map((f) => f.name)
                      .join(", ")}
                    {files.length > 4 ? ` … +${formatNumber(files.length - 4)}` : ""}
                  </AppText>
                  {files.length > mobileUploadSoftLimit ? (
                    <AppText variant="caption" tone="attention">
                      ⚠ {formatNumber(files.length)} files is a lot for a phone upload. For large drone surveys, upload from the AgroTwin web application or desktop
                      processing workflow.
                    </AppText>
                  ) : null}
                  <Button label="Clear selection" variant="ghost" size="sm" onPress={() => setFiles([])} disabled={busy} style={{ alignSelf: "flex-start" }} />
                </View>
              ) : null}
              <View style={[styles.row, { marginTop: spacing.md }]}>
                <Switch value={startProcessing} onValueChange={setStartProcessing} disabled={busy} trackColor={{ true: colors.brand }} accessibilityLabel="Start processing after upload" />
                <AppText variant="body" style={{ flex: 1 }}>
                  Start processing after upload
                </AppText>
              </View>
            </Card>
          ) : (
            <Card>
              <AppText variant="caption" tone="muted">
                Import results produced elsewhere. Only georeferenced files are accepted; the server explains what to export if a file is rejected.
              </AppText>
              <View style={[styles.chips, { marginTop: spacing.md }]}>
                {IMPORTABLE_ASSET_TYPES.map((t) => (
                  <Chip key={t.value} label={t.label} selected={assetType === t.value} onPress={() => setAssetType(t.value)} disabled={busy} />
                ))}
              </View>
              <Button label={assetFile ? `File: ${assetFile.name}` : "Choose file"} variant="outline" icon={<FileUp size={16} color={colors.text} />} onPress={chooseAsset} disabled={busy} style={{ marginTop: spacing.md }} />
            </Card>
          )}
          {pickError ? (
            <AppText variant="caption" tone="problem" style={{ marginTop: spacing.sm }}>
              {pickError}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {surveyId ? (
        <View>
          <SectionHeader title="4 · Upload" />
          {progress.state === "IDLE" ? (
            <Button label={mode === "images" ? `Upload ${files.length ? plural(files.length, "image") : "images"}` : "Import file"} onPress={start} disabled={!canUpload} fullWidth size="lg" />
          ) : (
            <UploadProgressCard
              progress={progress}
              onCancel={cancel}
              onRetry={start}
              onReset={() => {
                reset();
                setFiles([]);
                setAssetFile(null);
              }}
              onOpenSurvey={() => router.push({ pathname: "/survey/[id]", params: { id: surveyId } })}
            />
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
