import type { AnalysisResult, DetectionZone } from "@/types";
import { getJson } from "./apiClient";
import { isApiError } from "./errors";

/** /api/analysis — see backend/app/routers/analysis.py. */
export const analysisService = {
  /** Latest analysis for a survey; `null` when none has been computed yet (the backend answers 404). */
  get: async (surveyId: string): Promise<AnalysisResult | null> => {
    try {
      return await getJson<AnalysisResult>(`/api/analysis/${encodeURIComponent(surveyId)}`);
    } catch (err) {
      if (isApiError(err) && err.isNotFound) return null;
      throw err;
    }
  },

  detectionZones: async (surveyId: string): Promise<DetectionZone[]> => {
    const result = await analysisService.get(surveyId);
    return result?.detections ?? [];
  },
};
