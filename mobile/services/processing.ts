import type { ProcessingJob } from "@/types";
import { getJson, postJson } from "./apiClient";

const base = (surveyId: string) => `/api/surveys/${encodeURIComponent(surveyId)}`;

/** A job the backend worker is still working on (poll it). Mirrors frontend/lib/api.ts. */
export function isJobActive(job: ProcessingJob | null | undefined): boolean {
  return !!job && !["COMPLETED", "FAILED", "PENDING", "UPLOADING"].includes(job.status);
}

/** Processing jobs run on the backend's in-process worker; these calls only enqueue and poll. */
export const processingService = {
  latestJob: (surveyId: string) => getJson<ProcessingJob | null>(`${base(surveyId)}/job`),

  /** Full pipeline: field boundary, quick mosaic + tiles, analysis. 202 + job. */
  triggerProcessing: (surveyId: string) => postJson<ProcessingJob>(`${base(surveyId)}/process`),

  /** Rebuild the direct-georeferencing mosaics and re-analyse. */
  rebuildMosaic: (surveyId: string) => postJson<ProcessingJob>(`${base(surveyId)}/mosaic`),

  /** Fresh vegetation analysis from the survey's own imagery. */
  recomputeAnalysis: (surveyId: string) => postJson<ProcessingJob>(`/api/analysis/${encodeURIComponent(surveyId)}/recompute`),
};
