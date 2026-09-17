import { useQuery } from "@tanstack/react-query";
import { getWebViewerUrl } from "@/services/runtimeConfig";

export type SplatAvailability = "available" | "missing" | "unknown";

/**
 * Whether a Gaussian-splat reconstruction exists for the survey. Mirrors the
 * web SplatLayer: the tileset lives at /splats/<survey>/tileset.json on the
 * web app's static folder (built by backend/scripts/build_splats.py on the GPU).
 */
export function useSplatAvailability(surveyId: string | null | undefined) {
  const base = getWebViewerUrl();
  return useQuery<SplatAvailability>({
    queryKey: ["splat-availability", surveyId, base],
    enabled: !!surveyId && !!base,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      try {
        const res = await fetch(`${base}/splats/${encodeURIComponent(surveyId as string)}/tileset.json`, { method: "HEAD" });
        if (res.ok) return "available";
        if (res.status === 404) return "missing";
        return "unknown";
      } catch {
        return "unknown";
      }
    },
  });
}
