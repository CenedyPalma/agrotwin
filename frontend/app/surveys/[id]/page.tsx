"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { AvailabilityChecklist } from "@/components/surveys/AvailabilityChecklist";
import { ImageLightbox } from "@/components/surveys/ImageLightbox";
import { ImportAssetPanel } from "@/components/surveys/ImportAssetPanel";
import { groupFrames, METHOD_LABEL } from "@/lib/frames";
import { Globe2, RefreshCw, Loader2, Map } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const qc = useQueryClient();

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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["analysis", id] });
    qc.invalidateQueries({ queryKey: ["fields"] });
    qc.invalidateQueries({ queryKey: ["survey-assets", id] });
    qc.invalidateQueries({ queryKey: ["survey-availability", id] });
    qc.invalidateQueries({ queryKey: ["survey-images", id] });
  };
  const recompute = useMutation({ mutationFn: () => api.recomputeAnalysis(id), onSuccess: invalidate });
  const rebuildMosaic = useMutation({ mutationFn: () => api.rebuildMosaic(id), onSuccess: invalidate });

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
              {analysis && ` · analysed with ${METHOD_LABEL[analysis.method]}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="sm:h-10 sm:px-4 sm:py-2 text-xs sm:text-sm"
              onClick={() => rebuildMosaic.mutate()}
              disabled={rebuildMosaic.isPending}
              title="Build georeferenced RGB + NDVI/NDRE/GNDVI quick mosaics from the frames' RTK positions (takes a few minutes)"
            >
              {rebuildMosaic.isPending ? <Loader2 className="animate-spin" size={15} /> : <Map size={15} />}
              <span>{rebuildMosaic.isPending ? "Building…" : "Rebuild Mosaic"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="sm:h-10 sm:px-4 sm:py-2 text-xs sm:text-sm"
              onClick={() => recompute.mutate()}
              disabled={recompute.isPending}
              title="Recompute vegetation analysis from this survey's imagery (NDVI map when a mosaic exists, per-frame NDVI or RGB index otherwise)"
            >
              {recompute.isPending ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
              <span>{recompute.isPending ? "Computing…" : "Recompute Analysis"}</span>
            </Button>
            {boundary?.field_id && (
              <Link
                href={`/fields/${boundary.field_id}/digital-twin?survey=${id}`}
                className={buttonVariants({ size: "sm", className: "sm:h-10 sm:px-4 sm:py-2 text-xs sm:text-sm bg-brand hover:bg-brand/90 text-white" })}
              >
                <Globe2 size={15} /> Digital Twin
              </Link>
            )}
          </div>
        </div>
        {recompute.isError && <div className="text-sm text-problem">{(recompute.error as Error).message}</div>}
        {rebuildMosaic.isError && <div className="text-sm text-problem">{(rebuildMosaic.error as Error).message}</div>}

        {availability && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <h2 className="font-semibold text-sm mb-3">Survey Assets</h2>
            <AvailabilityChecklist availability={availability} />
          </div>
        )}

        <ImportAssetPanel surveyId={id} />

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
            <div className="text-sm text-muted-foreground">No images uploaded for this survey yet.</div>
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
