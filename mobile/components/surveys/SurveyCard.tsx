import { StyleSheet, View } from "react-native";
import type { Survey } from "@/types";
import { formatDate, formatNumber } from "@/utils/format";
import { Blueprint, ProgressTrack, AppText } from "@/components/ui";
import { SurveyStatus } from "./SurveyStatus";

interface SurveyCardProps {
  survey: Survey;
  fieldName?: string | null;
  onPress: () => void;
}

/** Canvas survey card: title, "field · date", outlined status tag, "drone · N images", a pulse bar while processing. */
export function SurveyCard({ survey, fieldName, onPress }: SurveyCardProps) {
  const running = !["COMPLETED", "FAILED", "PENDING"].includes(survey.status);
  return (
    <Blueprint onPress={onPress} accessibilityLabel={`${survey.name}, ${fieldName ?? "field"}, ${survey.status}. Open survey`}>
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="cardTitle" numberOfLines={2}>
            {survey.name}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {fieldName ?? "Field"} · {formatDate(survey.survey_date ?? survey.created_at)}
          </AppText>
        </View>
        <SurveyStatus status={survey.status} />
      </View>
      <View style={styles.meta}>
        <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
          {survey.drone_model ?? "Unknown drone"}
        </AppText>
        <AppText variant="caption" tone="muted">
          {formatNumber(survey.frame_count || survey.image_count)} images
        </AppText>
      </View>
      {running ? (
        <View style={{ marginTop: 12 }}>
          <ProgressTrack fraction={null} height={6} accessibilityLabel="Processing" />
        </View>
      ) : null}
    </Blueprint>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  titles: { flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", gap: 16, marginTop: 12 },
});
