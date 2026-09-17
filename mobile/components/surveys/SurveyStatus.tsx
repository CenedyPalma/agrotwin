import { surveyStatusLabel, surveyStatusTier } from "@/constants/labels";
import { StatusBadge } from "@/components/ui";

/** Outlined status tag: "Completed" (ok), "Processing" (accent), "Failed" (bad). */
export function SurveyStatus({ status }: { status: string }) {
  return <StatusBadge tier={surveyStatusTier(status)} label={surveyStatusLabel(status)} />;
}
