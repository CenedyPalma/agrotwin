import { StyleSheet, View } from "react-native";
import { Wheat, ChevronRight, AlertTriangle } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { FieldSummary } from "@/types";
import { cropLabel, formatHectares } from "@/utils/format";
import { overallHealth, sharesFromPercents } from "@/utils/health";
import { Card, HealthBar, HealthIndicator, HealthLegend, AppText, StatusBadge } from "@/components/ui";
import { surveyStatusLabel, surveyStatusTier } from "@/constants/labels";

interface FieldCardProps {
  field: FieldSummary;
  onPress: () => void;
  /** Number of flagged zones in the latest analysis, when already known. */
  attentionCount?: number | null;
  /** Latest survey date label, when already known. */
  lastSurveyLabel?: string | null;
  compact?: boolean;
}

/** Field summary card for the dashboard and the Fields list. */
export function FieldCard({ field, onPress, attentionCount, lastSurveyLabel, compact = false }: FieldCardProps) {
  const { colors } = useTheme();
  const shares = sharesFromPercents(field.healthy_area_percent, field.attention_area_percent, field.problem_area_percent);
  const health = overallHealth(shares);
  const processing = field.latest_survey_status && !["COMPLETED", "FAILED"].includes(field.latest_survey_status);

  return (
    <Card onPress={onPress} accessibilityLabel={`${field.name}, ${cropLabel(field.crop_type)}, ${health.label}. Open field`}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Wheat size={20} color={colors.brand} />
          <View style={styles.titles}>
            <AppText variant="heading" numberOfLines={1}>
              {field.name}
            </AppText>
            <AppText variant="caption" tone="muted">
              {cropLabel(field.crop_type)}
              {field.area_hectares != null ? ` · ${formatHectares(field.area_hectares)}` : ""}
            </AppText>
          </View>
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>

      <View style={styles.healthRow}>
        <HealthIndicator tier={health.tier} label={health.label} />
        {processing && field.latest_survey_status ? (
          <StatusBadge tier={surveyStatusTier(field.latest_survey_status)} label={surveyStatusLabel(field.latest_survey_status)} size="sm" showMarker={false} />
        ) : null}
      </View>

      {shares ? (
        <View style={styles.shares}>
          <HealthBar shares={shares} />
          {!compact ? <HealthLegend shares={shares} compact /> : null}
        </View>
      ) : (
        <AppText variant="caption" tone="muted">
          {field.latest_survey_id ? "Analysis not available yet for the latest survey." : "No surveys yet — upload a flight to analyse this field."}
        </AppText>
      )}

      {(lastSurveyLabel || attentionCount != null) && (
        <View style={styles.footer}>
          {lastSurveyLabel ? (
            <AppText variant="caption" tone="muted">
              Last survey · {lastSurveyLabel}
            </AppText>
          ) : (
            <View />
          )}
          {attentionCount != null && attentionCount > 0 ? (
            <View style={styles.attention}>
              <AlertTriangle size={14} color={colors.attention} />
              <AppText variant="caption" style={{ color: colors.attention, fontWeight: "600" }}>
                {attentionCount} {attentionCount === 1 ? "area needs" : "areas need"} attention
              </AppText>
            </View>
          ) : null}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 },
  titles: { flex: 1, gap: 2 },
  healthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.md },
  shares: { gap: spacing.md },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, gap: spacing.sm },
  attention: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});
