import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isJobActive } from "@/lib/api";

/** The survey's latest processing job, polled every 2 s while the backend is
 * working on it. When a job finishes, everything derived from the survey
 * (assets, analysis, field summary, images) is refetched once. */
export function useProcessingJob(surveyId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["job", surveyId],
    queryFn: () => api.getJob(surveyId as string),
    enabled: !!surveyId,
    refetchInterval: (q) => (isJobActive(q.state.data) ? 2000 : false),
  });

  const wasActive = useRef(false);
  const active = isJobActive(query.data);
  useEffect(() => {
    if (wasActive.current && !active && surveyId) {
      qc.invalidateQueries({ queryKey: ["survey", surveyId] });
      qc.invalidateQueries({ queryKey: ["survey-images", surveyId] });
      qc.invalidateQueries({ queryKey: ["survey-assets", surveyId] });
      qc.invalidateQueries({ queryKey: ["survey-availability", surveyId] });
      qc.invalidateQueries({ queryKey: ["survey-boundary", surveyId] });
      qc.invalidateQueries({ queryKey: ["analysis", surveyId] });
      qc.invalidateQueries({ queryKey: ["fields"] });
      qc.invalidateQueries({ queryKey: ["field"] });
      qc.invalidateQueries({ queryKey: ["surveys"] });
    }
    wasActive.current = active;
  }, [active, surveyId, qc]);

  return { job: query.data ?? null, active };
}
