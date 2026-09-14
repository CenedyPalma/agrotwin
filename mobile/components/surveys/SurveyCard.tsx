import { StyleSheet, View } from "react-native";
import { Calendar, Camera, ChevronRight, Plane } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { Survey } from "@/types";
import { formatDate, formatNumber } from "@/utils/format";
import { Card, AppText } from "@/components/ui";
import { SurveyStatus } from "./SurveyStatus";

interface SurveyCardProps {
  survey: Survey;
  fieldName?: string | null;
  onPress: () => void;
}

export function SurveyCard({ survey, fieldName, onPress }: SurveyCardProps) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={`${survey.name}, ${fieldName ?? "field"}, ${survey.status}. Open survey`}>
      <View style={styles.header}>
        <View style={styles.titles}>
          <AppText variant="heading" numberOfLines={2}>
            {survey.name}
          </AppText>
          {fieldName ? (
            <AppText variant="caption" tone="muted">
              {fieldName}
            </AppText>
          ) : null}
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>
      <View style={styles.meta}>
        <Meta icon={<Calendar size={14} color={colors.textMuted} />} text={formatDate(survey.survey_date ?? survey.created_at)} />
        <Meta icon={<Plane size={14} color={colors.textMuted} />} text={survey.drone_model ?? "Unknown drone"} />
        <Meta icon={<Camera size={14} color={colors.textMuted} />} text={`${formatNumber(survey.frame_count || survey.image_count)} images`} />
      </View>
      <View style={styles.footer}>
        <SurveyStatus status={survey.status} size="sm" />
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.metaItem}>
      {icon}
      <AppText variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  titles: { flex: 1, gap: 2 },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs, maxWidth: "100%" },
  footer: { marginTop: spacing.md },
});
