import { surveyStatusLabel, surveyStatusTier } from "@/constants/labels";
import { StatusBadge } from "@/components/ui";

interface SurveyStatusProps {
  status: string;
  size?: "sm" | "md";
}

/** "✓ Completed", "⏳ Processing", "✗ Failed" — text + marker, never colour alone. */
export function SurveyStatus({ status, size = "md" }: SurveyStatusProps) {
  const marker = status === "COMPLETED" ? "✓" : status === "FAILED" ? "✗" : status === "PENDING" ? "○" : "⏳";
  return <StatusBadge tier={surveyStatusTier(status)} label={`${marker} ${surveyStatusLabel(status)}`} size={size} showMarker={false} />;
}
