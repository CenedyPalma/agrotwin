import { ActivityIndicator, StyleSheet, View } from "react-native";
import { CheckCircle2, XCircle } from "lucide-react-native";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { UploadProgress } from "@/features/upload/useUploadFlow";
import { formatNumber } from "@/utils/format";
import { Button, Card, AppText } from "@/components/ui";

interface UploadProgressCardProps {
  progress: UploadProgress;
  onCancel?: () => void;
  onOpenSurvey?: () => void;
  onRetry?: () => void;
  onReset?: () => void;
}

const TITLES: Record<UploadProgress["state"], string> = {
  IDLE: "Ready",
  SELECTING: "Choosing files",
  UPLOADING: "Uploading to your AgroTwin computer",
  PROCESSING: "Upload complete — processing started",
  COMPLETED: "Upload complete",
  FAILED: "Upload failed",
};

export function UploadProgressCard({ progress, onCancel, onOpenSurvey, onRetry, onReset }: UploadProgressCardProps) {
  const { colors } = useTheme();
  const pct = Math.round(progress.fraction * 100);
  const busy = progress.state === "UPLOADING";
  return (
    <Card accessibilityLabel={`${TITLES[progress.state]}, ${pct} percent`}>
      <View style={styles.header}>
        {busy ? <ActivityIndicator color={colors.brand} /> : progress.state === "FAILED" ? <XCircle size={22} color={colors.problem} /> : <CheckCircle2 size={22} color={colors.healthy} />}
        <AppText variant="heading" style={{ flex: 1 }}>
          {TITLES[progress.state]}
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surface2 }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: progress.state === "FAILED" ? colors.problem : colors.brand }]} />
      </View>
      <AppText variant="caption" tone="muted">
        {progress.totalFiles > 1
          ? `${formatNumber(Math.min(progress.uploadedFiles, progress.totalFiles))} of ${formatNumber(progress.totalFiles)} files · batch ${progress.currentBatch}/${progress.totalBatches}`
          : `${pct}%`}
      </AppText>
      {progress.error ? (
        <AppText variant="body" tone="problem">
          {progress.error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        {busy && onCancel ? <Button label="Cancel" variant="outline" size="sm" onPress={onCancel} /> : null}
        {progress.state === "FAILED" && onRetry ? <Button label="Retry" size="sm" onPress={onRetry} /> : null}
        {(progress.state === "COMPLETED" || progress.state === "PROCESSING") && onOpenSurvey ? <Button label="Open survey" size="sm" onPress={onOpenSurvey} /> : null}
        {!busy && onReset ? <Button label="Upload more" variant="ghost" size="sm" onPress={onReset} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  track: { height: 10, borderRadius: radius.pill, overflow: "hidden", marginTop: spacing.md, marginBottom: spacing.sm },
  fill: { height: "100%", borderRadius: radius.pill },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
});
