import type { AnalysisResult } from "@/types";
import { FieldHealthSummary } from "@/components/fields/FieldHealthSummary";

interface HealthSummaryProps {
  analysis: AnalysisResult;
  advanced?: boolean;
}

/** Health summary for one survey's analysis. */
export function HealthSummary({ analysis, advanced = false }: HealthSummaryProps) {
  const s = analysis.analysis_summary;
  return (
    <FieldHealthSummary
      title="Health summary"
      shares={{ healthy: s.healthy_area_percent, attention: s.attention_area_percent, problem: s.problem_area_percent }}
      method={analysis.method}
      isMock={analysis.is_mock}
      advanced={advanced}
    />
  );
}
