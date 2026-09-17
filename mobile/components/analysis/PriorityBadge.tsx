import { priorityLabel, SEVERITY_LABEL, severityTier } from "@/constants/labels";
import { StatusBadge } from "@/components/ui";

/** Outlined "Medium priority" tag coloured by severity (high → problem, medium → attention, low → accent). */
export function PriorityBadge({ severity, short = false }: { severity: string; short?: boolean }) {
  return <StatusBadge tier={severityTier(severity)} label={short ? (SEVERITY_LABEL[severity] ?? severity) : priorityLabel(severity)} />;
}
