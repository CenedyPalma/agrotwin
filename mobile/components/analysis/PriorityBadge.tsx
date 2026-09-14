import { priorityLabel, severityTier } from "@/constants/labels";
import { StatusBadge } from "@/components/ui";

/** "🟡 Medium Priority" / "🔴 High Priority" for a detection zone. */
export function PriorityBadge({ severity, size = "sm" }: { severity: string; size?: "sm" | "md" }) {
  return <StatusBadge tier={severityTier(severity)} label={priorityLabel(severity)} size={size} />;
}
