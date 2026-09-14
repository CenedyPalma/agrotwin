import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Check, Circle, X } from "lucide-react-native";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { isJobActive } from "@/services/processing";
import type { ProcessingJob } from "@/types";
import { Button, Card, AppText } from "@/components/ui";

interface ProcessingProgressProps {
  job: ProcessingJob;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}

/** Step-by-step job progress, mirroring the web app's ProcessingProgress. */
export function ProcessingProgress({ job, onRetry, retrying = false, compact = false }: ProcessingProgressProps) {
  const { colors } = useTheme();
  const active = isJobActive(job);
  const failed = job.status === "FAILED";
  const done = job.steps.filter((s) => s.status === "complete").length;
  const title =
    job.steps.length > 2 ? "Creating your Digital Twin" : job.steps.length === 2 ? "Rebuilding the field map" : "Recomputing the analysis";

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.titles}>
          <AppText variant="label" tone="muted">
            {failed ? "Processing failed" : active ? "Processing" : job.status === "COMPLETED" ? "Processing complete" : "Waiting"}
          </AppText>
          <AppText variant="heading">{title}</AppText>
        </View>
        {active ? <ActivityIndicator color={colors.brand} /> : null}
      </View>

      <View style={[styles.track, { backgroundColor: colors.surface2 }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: job.steps.length, now: done }}>
        <View style={[styles.fill, { width: `${(100 * done) / Math.max(job.steps.length, 1)}%`, backgroundColor: failed ? colors.problem : colors.brand }]} />
      </View>

      {!compact ? (
        <View style={styles.steps}>
          {job.steps.map((step) => {
            const isCurrent = step.key === job.current_step && active;
            const Icon = step.status === "complete" ? Check : step.status === "failed" ? X : Circle;
            const color = step.status === "complete" ? colors.healthy : step.status === "failed" ? colors.problem : isCurrent ? colors.brand : colors.textMuted;
            return (
              <View key={step.key} style={styles.step} accessibilityLabel={`${step.label}: ${isCurrent ? "in progress" : step.status}`}>
                {isCurrent ? <ActivityIndicator size="small" color={colors.brand} /> : <Icon size={18} color={color} />}
                <AppText variant={isCurrent ? "bodyStrong" : "body"} tone={step.status === "pending" && !isCurrent ? "muted" : "default"}>
                  {step.label}
                  {isCurrent ? "…" : ""}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : null}

      {failed ? (
        <View style={[styles.error, { backgroundColor: `${colors.problem}14` }]}>
          <AppText variant="body" tone="problem">
            {job.error_message ?? "The backend reported a failure."}
          </AppText>
          {onRetry ? <Button label="Retry processing" variant="danger" onPress={onRetry} loading={retrying} style={styles.retry} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  titles: { flex: 1, gap: 2 },
  track: { height: 8, borderRadius: radius.pill, overflow: "hidden", marginTop: spacing.md },
  fill: { height: "100%", borderRadius: radius.pill },
  steps: { marginTop: spacing.lg, gap: spacing.md },
  step: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 24 },
  error: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
  retry: { alignSelf: "flex-start" },
});
