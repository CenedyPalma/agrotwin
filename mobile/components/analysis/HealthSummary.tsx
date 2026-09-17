import { StyleSheet, View } from "react-native";
import { METHOD_LABEL, METHOD_PLAIN } from "@/constants/labels";
import { useTheme } from "@/hooks/useTheme";
import type { AnalysisResult } from "@/types";
import { overallHealth } from "@/utils/health";
import { Blueprint, HealthLegendBars, Swatch, AppText } from "@/components/ui";

interface HealthSummaryProps {
  analysis: AnalysisResult;
  areaHectares: number | null;
  advanced?: boolean;
}

/** Plain summary sentence derived from the measured shares and zone count (never invented). */
export function summarySentence(analysis: AnalysisResult): string {
  const s = analysis.analysis_summary;
  const n = analysis.detections.length;
  const zones = n === 0 ? "No areas were flagged." : n === 1 ? "One area came back weaker than the rest — worth a walk this week." : `${n} areas came back weaker than the rest — worth a walk this week.`;
  if (s.problem_area_percent >= 15) return `A sizeable part of this field measured as a problem. ${zones}`;
  if (s.healthy_area_percent >= 60) return `Most of this field looks healthy. ${zones}`;
  return `This field needs attention: under two thirds of the surveyed area measured healthy. ${zones}`;
}

/** Canvas analysis summary card: swatch + status, summary sentence, three bar rows with hectares. */
export function HealthSummary({ analysis, areaHectares, advanced = false }: HealthSummaryProps) {
  const { colors } = useTheme();
  const s = analysis.analysis_summary;
  const shares = { healthy: s.healthy_area_percent, attention: s.attention_area_percent, problem: s.problem_area_percent };
  const health = overallHealth(shares);
  return (
    <Blueprint padding={18}>
      <View style={styles.statusRow}>
        <Swatch color={colors[health.tier]} />
        <AppText variant="bodyStrong" style={{ fontSize: 17 }}>
          {health.label}
        </AppText>
      </View>
      <AppText variant="body" tone="soft" style={{ marginTop: 8 }}>
        {summarySentence(analysis)}
      </AppText>
      <View style={{ marginTop: 18 }}>
        <HealthLegendBars shares={shares} areaHectares={areaHectares} />
      </View>
      <AppText variant="small" tone="muted" style={{ marginTop: 14 }}>
        {advanced ? (METHOD_LABEL[analysis.method] ?? analysis.method) : (METHOD_PLAIN[analysis.method] ?? "Measured from this survey's imagery.")}
      </AppText>
      {analysis.is_mock ? (
        <AppText variant="small" tone="attention" style={{ marginTop: 4 }}>
          Demonstration data — not measured from real imagery.
        </AppText>
      ) : null}
    </Blueprint>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
