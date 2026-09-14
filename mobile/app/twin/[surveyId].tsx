import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, RefreshCw } from "lucide-react-native";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSurvey } from "@/features/surveys/hooks";
import { useAnalysis } from "@/features/analysis/hooks";
import { useUiStore } from "@/stores/uiStore";
import { detectionTypeLabel, priorityLabel, severityTier, TIER_EMOJI } from "@/constants/labels";
import { Button, Chip, ErrorState, IconButton, LoadingState, Screen, AppText } from "@/components/ui";
import { DigitalTwinWebView, type DigitalTwinHandle } from "@/components/digitalTwin/DigitalTwinWebView";
import type { SplatStatus, TwinMode } from "@/components/digitalTwin/digitalTwinBridge";

const MODES: Array<{ key: TwinMode; label: string }> = [
  { key: "field-map", label: "Field Map" },
  { key: "3d-twin", label: "3D Twin" },
  { key: "photorealistic", label: "Photorealistic" },
];

export default function DigitalTwinScreen() {
  const { surveyId, mode: modeParam, zone: zoneParam } = useLocalSearchParams<{ surveyId: string; mode?: string; zone?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const setActiveSurvey = useUiStore((s) => s.setActiveSurvey);
  const twinRef = useRef<DigitalTwinHandle>(null);

  const initialMode: TwinMode = modeParam === "3d-twin" || modeParam === "photorealistic" ? modeParam : "field-map";
  const [mode, setMode] = useState<TwinMode>(initialMode);
  const [ready, setReady] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [splat, setSplat] = useState<{ status: SplatStatus; detail?: string } | null>(null);
  const [layerError, setLayerError] = useState<string | null>(null);

  const survey = useSurvey(surveyId);
  const analysis = useAnalysis(surveyId);

  useEffect(() => {
    if (surveyId) setActiveSurvey(surveyId);
  }, [surveyId, setActiveSurvey]);

  const changeMode = useCallback((next: TwinMode) => {
    setMode(next);
    twinRef.current?.send({ type: "SET_MODE", mode: next });
  }, []);

  if (survey.isPending) {
    return (
      <Screen scroll={false} safeTop>
        <LoadingState message="Opening Digital Twin…" />
      </Screen>
    );
  }
  if (survey.isError || !survey.data) {
    return (
      <Screen scroll={false} safeTop>
        <ErrorState error={survey.error} onRetry={() => survey.refetch()} />
      </Screen>
    );
  }

  const selectedZone = analysis.data?.detections.find((d) => d.id === selectedZoneId) ?? null;

  return (
    <View style={[styles.root, { backgroundColor: "#0b0f0c" }]}>
      <DigitalTwinWebView
        ref={twinRef}
        fieldId={survey.data.field_id}
        surveyId={survey.data.id}
        mode={initialMode}
        focusZoneId={zoneParam ?? null}
        onReady={() => setReady(true)}
        onZoneSelected={setSelectedZoneId}
        onModeChanged={setMode}
        onSplatStatus={(status, detail) => setSplat({ status, detail })}
        onLayerError={setLayerError}
      />

      <View style={[styles.topBar, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
        <IconButton overlay icon={<ArrowLeft size={20} color="#fff" />} accessibilityLabel="Go back" onPress={() => router.back()} />
        <View style={styles.modes}>
          {MODES.map((m) => (
            <Chip key={m.key} label={m.label} selected={mode === m.key} onPress={() => changeMode(m.key)} disabled={!ready} color={colors.brand} />
          ))}
        </View>
        <IconButton overlay icon={<RefreshCw size={18} color="#fff" />} accessibilityLabel="Reload viewer" onPress={() => twinRef.current?.reload()} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
        {layerError ? (
          <View style={styles.note}>
            <AppText variant="caption" style={styles.noteText}>
              {layerError}
            </AppText>
          </View>
        ) : null}
        {mode === "photorealistic" && splat && splat.status !== "loaded" ? (
          <View style={styles.note}>
            <AppText variant="caption" style={styles.noteText}>
              {splat.status === "loading"
                ? "Loading Gaussian-splat reconstruction…"
                : splat.status === "missing"
                  ? "No photorealistic reconstruction exists for this survey yet — it is built on the AgroTwin computer's GPU."
                  : splat.status === "error"
                    ? `Could not load the reconstruction: ${splat.detail ?? "unknown error"}`
                    : "Preparing…"}
            </AppText>
          </View>
        ) : null}
        {selectedZone ? (
          <View style={[styles.zoneCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">
                {TIER_EMOJI[severityTier(selectedZone.severity)]} {detectionTypeLabel(selectedZone.type)}
              </AppText>
              <AppText variant="caption" tone="muted">
                {priorityLabel(selectedZone.severity)} · {selectedZone.recommended_action}
              </AppText>
            </View>
            <Button label="Details" size="sm" variant="outline" onPress={() => surveyId && router.push({ pathname: "/analysis/[surveyId]", params: { surveyId } })} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { position: "absolute", left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  modes: { flex: 1, flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  bottom: { position: "absolute", left: spacing.md, right: spacing.md, bottom: 0, gap: spacing.sm },
  note: { backgroundColor: "rgba(11, 15, 12, 0.85)", borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignSelf: "center" },
  noteText: { color: "#fff", textAlign: "center" },
  zoneCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
});
