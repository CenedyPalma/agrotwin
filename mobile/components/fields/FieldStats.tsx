import { StyleSheet, View } from "react-native";
import { spacing } from "@/constants/theme";
import type { FieldSummary, Survey } from "@/types";
import { cropLabel, formatHectares, formatNumber, seasonOf } from "@/utils/format";
import { StatCard } from "@/components/ui";

interface FieldStatsProps {
  field: FieldSummary;
  surveys: Survey[] | undefined;
  zoneCount: number | null;
}

/** Quick facts about a field: crop/season, size, surveys, flagged zones. */
export function FieldStats({ field, surveys, zoneCount }: FieldStatsProps) {
  const latest = surveys?.[0];
  return (
    <View style={styles.grid}>
      <StatCard label="Crop" value={cropLabel(field.crop_type)} hint={latest ? seasonOf(latest.survey_date ?? latest.created_at) : "No season yet"} />
      <StatCard label="Field size" value={formatHectares(field.area_hectares)} hint={field.area_hectares != null ? "from survey coverage" : undefined} />
      <StatCard label="Surveys" value={formatNumber(surveys?.length ?? 0)} hint={latest ? `${formatNumber(latest.image_count)} images in latest` : undefined} />
      <StatCard label="Flagged areas" value={zoneCount == null ? "—" : formatNumber(zoneCount)} hint={zoneCount == null ? "no analysis yet" : "in latest analysis"} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
});
