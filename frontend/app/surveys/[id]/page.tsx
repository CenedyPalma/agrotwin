"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { AvailabilityChecklist } from "@/components/surveys/AvailabilityChecklist";
import { ImageLightbox } from "@/components/surveys/ImageLightbox";
import { ImportAssetPanel } from "@/components/surveys/ImportAssetPanel";
import { ProcessingProgress } from "@/components/surveys/ProcessingProgress";
import { useProcessingJob } from "@/lib/hooks/useProcessingJob";
import { groupFrames, METHOD_DESCRIPTION, METHOD_LABEL } from "@/lib/frames";
import { Globe2, RefreshCw, Loader2, Map, Play, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const qc = useQueryClient();
  const router = useRouter();

  const { data: survey } = useQuery({ queryKey: ["survey", id], queryFn: () => api.getSurvey(id) });
  const { data: images } = useQuery({
    queryKey: ["survey-images", id],
    queryFn: () => api.listSurveyImages(id),
  });
  const { data: availability } = useQuery({
    queryKey: ["survey-availability", id],
    queryFn: () => api.getSurveyAvailability(id),
  });
  const { data: boundary } = useQuery({
    queryKey: ["survey-boundary", id],
    queryFn: () => api.getFieldBoundary(id),
  });
  const { data: analysis } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => api.getAnalysis(id),
    retry: false,
  });
  const { job, active: busy } = useProcessingJob(id);
  const frames = useMemo(() => groupFrames(images ?? []), [images]);

  // Deep link: /surveys/<id>?frame=<frame_key>&view=ndvi opens that frame directly.
  const searchParams = useSearchParams();
  const linkedFrame = searchParams.get("frame");
  const linkedView = searchParams.get("view");
  useEffect(() => {
    if (!linkedFrame || frames.length === 0) return;
    const i = frames.findIndex((f) => f.key === linkedFrame);
    if (i >= 0) setLightboxIndex(i);
  }, [linkedFrame, frames]);
  const bandCount = useMemo(() => new Set((images ?? []).map((i) => i.band)).size, [images]);

  const startPolling = () => qc.invalidateQueries({ queryKey: ["job", id] });
  const process = useMutation({ mutationFn: () => api.triggerProcessing(id), onSuccess: startPolling });
  const recompute = useMutation({ mutationFn: () => api.recomputeAnalysis(id), onSuccess: startPolling });
  const rebuildMosaic = useMutation({ mutationFn: () => api.rebuildMosaic(id), onSuccess: startPolling });
  const remove = useMutation({
    mutationFn: () => api.deleteSurvey(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["surveys"] });
      qc.invalidateQueries({ queryKey: ["fields"] });
      router.push(boundary?.field_id ? `/fields/${boundary.field_id}` : "/surveys");
    },
  });

  const needsProcessing = !!survey && ["PENDING", "UPLOADING", "FAILED"].includes(survey.status);
  const hasImages = (images?.length ?? 0) > 0;
  const showJob = !!job && (busy || job.status === "FAILED" || (survey?.status !== "COMPLETED" && job.status !== "COMPLETED"));
  const mutationError = [process, recompute, rebuildMosaic, remove].find((m) => m.isError)?.error as Error | undefined;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{survey?.name ?? "Loading…"}</h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              {survey?.drone_model} · {frames.length} frames
              {bandCount > 1 ? ` · ${bandCount} bands (${survey?.image_count} files)` : ""} ·{" "}
              {survey?.survey_date ? new Date(survey.survey_date).toLocaleDateString() : "—"}
              {analysis && (
                <span title={METHOD_DESCRIPTION[analysis.method]}> · analysed with {METHOD_LABEL[analysis.method] ?? analysis.method}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {needsProcessing && hasImages && (
              <Button
                size="sm"
                className="sm:h-10 sm:px-4 sm:py-2 text-xs sm:text-sm bg-brand hover:bg-brand/90 text-white"
                onClick={() => process.mutate()}
                disabled={busy || process.isPending}
                title="Compute the field boundary, build the quick field map and analyse vegetation (runs in the background)"
              >
                {process.isPending || busy ? <Loader2 className="animate-spin" size={15} /> : <Play size={15} />}
                <span>{survey?.status === "FAILED" ? "Retry Processing" : "Process Survey"}</span>
              </Button>
            )}
            {!needsProcessing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="sm:h-10 sm:px-4 sm:py-2 text-xs sm:text-sm"
                  onClick={() => rebuildMosaic.mutate()}
                  disabled={busy || rebuildMosaic.isPending}
                  title="Rebuild the georeferenced RGB (+ NDVI/NDRE/GNDVI) quick mosaics from the frames' positions and re-analyse (background job, minutes)"
                >
                  {rebuildMosaic.isPending ? <Loader2 className="animate-spin" size={15} /> : <Map size={15} />}
                  <span>Rebuild Mosaic</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="sm:h-10 sm:px-4 sm:py-2 text-xs sm:text-sm"
                  onClick={() => recompute.mutate()}
                  disabled={busy || recompute.isPending}
                  title="Recompute vegetation analysis from this survey's imagery (background job)"
                >
                  {recompute.isPending ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
                  <span>Recompute Analysis</span>
                </Button>
              </>
            )}
            {boundary?.field_id && (
              <Link
                href={`/fields/${boundary.field_id}/digital-twin?survey=${id}`}
                className={buttonVariants({ size: "sm", className: "sm:h-10 sm:px-4 sm:py-2 text-xs sm:text-sm bg-brand hover:bg-brand/90 text-white" })}
              >
                <Globe2 size={15} /> Digital Twin
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              className="sm:h-10 sm:px-3 sm:py-2 text-xs sm:text-sm text-muted-foreground hover:text-problem"
              onClick={() => {
                if (window.confirm("Delete this survey, its analysis and generated maps? Original drone files on disk are kept."))
                  remove.mutate();
              }}
              disabled={busy || remove.isPending}
              title="Delete this survey"
            >
              {remove.isPending ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
            </Button>
          </div>
        </div>
        {mutationError && <div className="text-sm text-problem">{mutationError.message}</div>}

        {showJob && job && (
          <ProcessingProgress
            job={job}
            title={job.steps.length > 2 ? "Creating Digital Twin" : job.steps.length === 2 ? "Rebuilding field map" : "Recomputing analysis"}
            action={
              job.steps.length > 2 ? (
                <Button size="sm" variant="outline" onClick={() => process.mutate()} disabled={process.isPending}>
                  <Play size={14} /> Retry
                </Button>
              ) : undefined
            }
          />
        )}

        {availability && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-semibold text-sm mb-3">Survey Assets</h2>
            <AvailabilityChecklist availability={availability} />
          </div>
        )}

        <ImportAssetPanel surveyId={id} disabled={busy} />

        <div>
          <h2 className="font-semibold text-sm mb-3">
            Raw Frames {images ? `(${frames.length})` : ""}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {frames.map((frame, i) => (
              <button
                key={frame.key}
                onClick={() => setLightboxIndex(i)}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={api.imageThumbnailUrl(frame.anchor.survey_id, frame.anchor.id)}
                  alt={frame.anchor.filename}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                <span className="absolute bottom-1 right-1 flex gap-1">
                  {frame.indices.length > 0 && (
                    <span className="rounded bg-brand/90 px-1.5 py-0.5 text-[9px] text-white">MS</span>
                  )}
                  {frame.anchor.lat != null && (
                    <span className="rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white">GPS</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {images && images.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No images in this survey yet.{" "}
              <Link href="/upload" className="text-brand hover:underline">
                Upload drone images
              </Link>
              .
            </div>
          )}
        </div>
      </div>

      {frames.length > 0 && lightboxIndex !== null && (
        <ImageLightbox
          surveyId={id}
          frames={frames}
          index={lightboxIndex}
          initialView={linkedView}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </AppShell>
  );
}
