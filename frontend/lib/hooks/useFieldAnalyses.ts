import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AnalysisResult, FieldSummary } from "@/lib/types";

export interface FieldAnalysis {
  field: FieldSummary;
  analysis: AnalysisResult | null;
}

/** Fetches each field's latest-survey analysis in parallel, keyed off
 * FieldSummary.latest_survey_id, and pairs the results back up with their
 * field so callers can render one list without waterfalling requests. */
export function useFieldAnalyses(fields: FieldSummary[] | undefined) {
  const queries = useQueries({
    queries: (fields ?? []).map((field) => ({
      queryKey: ["analysis", field.latest_survey_id],
      queryFn: () => api.getAnalysis(field.latest_survey_id as string),
      enabled: !!field.latest_survey_id,
      retry: false,
    })),
  });

  const data: FieldAnalysis[] | undefined = fields?.map((field, i) => ({
    field,
    analysis: queries[i]?.data ?? null,
  }));

  return {
    data,
    isLoading: queries.some((q) => q.isLoading),
  };
}
