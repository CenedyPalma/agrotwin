import { useQuery } from "@tanstack/react-query";
import { analysisService } from "@/services/analysis";
import { queryKeys } from "../queryKeys";

/** Latest analysis of a survey; `data === null` means none exists yet (not an error). */
export function useAnalysis(surveyId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.analysis(surveyId ?? ""),
    queryFn: () => analysisService.get(surveyId as string),
    enabled: !!surveyId,
  });
}

export function useDetectionZones(surveyId: string | null | undefined) {
  const query = useAnalysis(surveyId);
  return { ...query, zones: query.data?.detections ?? [] };
}
