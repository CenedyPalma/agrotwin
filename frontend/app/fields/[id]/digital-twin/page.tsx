"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { wsenFromPolygon } from "@/lib/geo";
import type { SurveyAsset } from "@/lib/types";
import { useDigitalTwinStore } from "@/lib/digitalTwinStore";
import { CesiumToolbar } from "@/components/cesium/CesiumToolbar";
import { LayerControls } from "@/components/cesium/LayerControls";
import { DetectionPanel } from "@/components/cesium/DetectionPanel";
import { MethodBadge, MockDataBadge } from "@/components/dashboard/StatusPill";
import { groupFrames } from "@/lib/frames";
import type { SplatStatus } from "@/components/cesium/SplatLayer";
import { ArrowLeft } from "lucide-react";

const CesiumViewer = dynamic(() => import("@/components/cesium/CesiumViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-surface text-sm text-muted-foreground">
      Loading Digital Twin viewer…
    </div>
  ),
});

export default function DigitalTwinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: field } = useQuery({ queryKey: ["field", id], queryFn: () => api.getField(id) });
  const { data: surveys } = useQuery({
    queryKey: ["field-surveys", id],
    queryFn: () => api.listFieldSurveys(id),
  });
  const requestedSurvey = searchParams.get("survey");
  const surveyId =
    (requestedSurvey && surveys?.some((s) => s.id === requestedSurvey) ? requestedSurvey : null) ??
    field?.latest_survey_id ??
    null;

  const { data: images } = useQuery({
    queryKey: ["survey-images", surveyId],
    queryFn: () => api.listSurveyImages(surveyId as string),
    enabled: !!surveyId,
  });
  const { data: analysis } = useQuery({
    queryKey: ["analysis", surveyId],
    queryFn: () => api.getAnalysis(surveyId as string),
    enabled: !!surveyId,
    retry: false,
  });
  const { data: assets } = useQuery({
    queryKey: ["survey-assets", surveyId],
    queryFn: () => api.listSurveyAssets(surveyId as string),
    enabled: !!surveyId,
  });

  const [splat, setSplat] = useState<{ status: SplatStatus; detail?: string }>({ status: "idle" });
  const onSplatStatus = useCallback((status: SplatStatus, detail?: string) => setSplat({ status, detail }), []);

  // Deep link: ?mode=field-map|3d-twin|photorealistic
  const setMode = useDigitalTwinStore((s) => s.setMode);
  const requestedMode = searchParams.get("mode");
  useEffect(() => {
    if (requestedMode === "field-map" || requestedMode === "3d-twin" || requestedMode === "photorealistic") {
      setMode(requestedMode);
    }
  }, [requestedMode, setMode]);

  // Deep link: ?cam=lon,lat,height,heading,pitch (share an exact view)
  const initialCamera = useMemo(() => {
    const v = searchParams.get("cam")?.split(",").map(Number);
    if (!v || v.length !== 5 || v.some((n) => !Number.isFinite(n))) return null;
    const [lon, lat, height, heading, pitch] = v;
    return { lon, lat, height, heading, pitch };
  }, [searchParams]);

  const selectedDetectionId = useDigitalTwinStore((s) => s.selectedDetectionId);
  const setSelectedDetectionId = useDigitalTwinStore((s) => s.setSelectedDetectionId);
  const mode = useDigitalTwinStore((s) => s.mode);

  const boundary = field?.boundary_geojson ? JSON.parse(field.boundary_geojson) : null;
  // One map point per shutter release — a multispectral frame is 5 files at the same spot.
  const frameAnchors = useMemo(() => groupFrames(images ?? []).map((f) => f.anchor), [images]);
  const detections = analysis?.detections ?? [];
  const selectedZone = detections.find((d) => d.id === selectedDetectionId) ?? null;

  // Capture geometry from the frames' own gimbal pitch: a nadir-only flight
  // (all ≈ −90°) leaves depth poorly constrained along the viewing rays, so
  // a splat reconstruction looks needly from low angles; oblique passes
  // (35–45° tilt) are what make it hold up from any direction.
  const capture = useMemo(() => {
    const pitches = frameAnchors.map((f) => f.gimbal_pitch_deg).filter((p): p is number => p != null);
    if (pitches.length === 0) return null;
    const oblique = pitches.filter((p) => p > -80).length;
    return { total: pitches.length, oblique, pct: Math.round((100 * oblique) / pitches.length) };
  }, [frameAnchors]);

  const rasterAssets = useMemo(() => {
    // True photogrammetry (OpenDroneMap) beats the quick direct-georeferenced
    // products, which beat the splat-derived ones, when a survey has several.
    const rank = (a: SurveyAsset) =>
      a.source === "photogrammetry_odm" ? 0 : a.source === "direct_georeferencing" ? 1 : 2;
    const best = (type: string, pred: (a: SurveyAsset) => boolean) =>
      assets?.filter((a) => a.asset_type === type && pred(a)).sort((a, b) => rank(a) - rank(b))[0];
    const byType = (type: string) => best(type, (a) => !!a.format?.match(/tiff?$/));
    // A tile pyramid (build_tiles.py) keeps zooming sharp; the flat preview is the fallback.
    const tilesFor = (type: string) => best(type, (a) => a.format === "xyz")?.public_url ?? null;
    const toRaster = (asset: SurveyAsset | undefined) => {
      if (!asset?.bounds_geojson || !surveyId) return null;
      const bounds = wsenFromPolygon(JSON.parse(asset.bounds_geojson));
      if (!bounds) return null;
      return { previewUrl: api.assetPreviewUrl(surveyId, asset.id), bounds, tilesUrl: tilesFor(asset.asset_type) };
    };
    const tileset = (type: string) => best(type, (a) => !!a.public_url)?.public_url ?? null;
    return {
      orthomosaic: toRaster(byType("orthomosaic")),
      ndvi: toRaster(byType("ndvi")),
      ndre: toRaster(byType("ndre")),
      gndvi: toRaster(byType("gndvi")),
      dsm: toRaster(byType("dsm")),
      // 3D Tilesets under frontend/public/models/<survey>/ (import_odm.py or build_dense.py)
      meshUrl: tileset("model3d"),
      meshKind: (best("model3d", (a) => !!a.public_url)?.source === "photogrammetry_odm" ? "reality" : "terrain") as
        | "reality"
        | "terrain",
      pointCloudUrl: tileset("pointcloud"),
    };
  }, [assets, surveyId]);

  return (
    <div className="relative h-screen w-full">
      <CesiumViewer
        boundary={boundary}
        centerLat={field?.center_lat ?? null}
        centerLon={field?.center_lon ?? null}
        images={frameAnchors}
        detections={detections}
        orthomosaic={rasterAssets.orthomosaic}
        ndvi={rasterAssets.ndvi}
        ndre={rasterAssets.ndre}
        gndvi={rasterAssets.gndvi}
        dsm={rasterAssets.dsm}
        meshUrl={rasterAssets.meshUrl}
        meshKind={rasterAssets.meshKind}
        pointCloudUrl={rasterAssets.pointCloudUrl}
        surveyId={surveyId}
        initialCamera={initialCamera}
        onSelectDetection={setSelectedDetectionId}
        onSplatStatus={onSplatStatus}
      />

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-2 sm:p-4 z-30">
        <div className="pointer-events-auto flex items-center gap-2">
          <Link
            href={`/fields/${id}`}
            className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-border bg-surface/90 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium shadow-lg backdrop-blur hover:bg-surface-2"
          >
            <ArrowLeft size={15} />
            <span className="max-w-[100px] sm:max-w-none truncate">{field?.name ?? "Field"}</span>
          </Link>
          {surveys && surveys.length > 1 && surveyId && (
            <select
              value={surveyId}
              onChange={(e) => router.replace(`/fields/${id}/digital-twin?survey=${e.target.value}`)}
              className="max-w-[130px] sm:max-w-[240px] rounded-lg border border-border bg-surface/90 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium shadow-lg backdrop-blur outline-none focus:border-brand truncate"
              title="Choose which survey of this field to view"
            >
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <CesiumToolbar />
      </div>

      {/* layer controls */}
      <div className="pointer-events-none absolute right-2 sm:right-4 top-14 sm:top-20 z-20">
        <LayerControls
          hasOrthomosaic={!!rasterAssets.orthomosaic}
          hasNdvi={!!rasterAssets.ndvi}
          hasNdre={!!rasterAssets.ndre}
          hasGndvi={!!rasterAssets.gndvi}
          hasDsm={!!rasterAssets.dsm}
          hasMesh={!!rasterAssets.meshUrl}
          meshKind={rasterAssets.meshKind}
          hasPointCloud={!!rasterAssets.pointCloudUrl}
        />
      </div>

      {/* detection detail panel */}
      {selectedZone && (
        <div className="pointer-events-none absolute right-2 sm:right-4 top-[18rem] sm:top-[21rem] z-20">
          <DetectionPanel zone={selectedZone} onClose={() => setSelectedDetectionId(null)} />
        </div>
      )}

      {/* photorealistic mode status */}
      {mode === "photorealistic" && splat.status !== "loaded" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 sm:bottom-24 flex justify-center px-4">
          <div className="pointer-events-auto rounded-lg border border-attention/40 bg-surface/95 px-3 sm:px-4 py-2 text-xs text-attention shadow-lg backdrop-blur text-center">
            {splat.status === "loading" && "Loading Gaussian-splat reconstruction…"}
            {splat.status === "missing" &&
              "No photorealistic reconstruction exists for this survey yet — run backend/scripts/build_splats.py (GPU, ~2 h) to build one from its frames."}
            {splat.status === "error" && `Could not load the reconstruction: ${splat.detail}`}
            {splat.status === "idle" && "Preparing…"}
          </div>
        </div>
      )}
      {mode === "photorealistic" && splat.status === "loaded" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 sm:bottom-24 flex justify-center px-4">
          <div className="rounded-lg border border-border bg-surface/90 px-3 py-1.5 text-[11px] text-muted-foreground shadow backdrop-blur text-center">
            Gaussian splats reconstructed from this survey&apos;s frames (SfM + 3DGS), geo-aligned to the RTK camera positions
            {capture && capture.oblique === 0 && (
              <span className="block text-attention">
                Nadir-only capture ({capture.total} frames at −90°): looks best from above. Add oblique passes (gimbal 35–45°,
                cross-hatch or orbit) to the next flight for a view that holds up from any angle.
              </span>
            )}
            {capture && capture.oblique > 0 && (
              <span className="block">
                {capture.oblique} of {capture.total} frames oblique ({capture.pct}%)
              </span>
            )}
          </div>
        </div>
      )}

      {/* bottom status bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface/90 px-3 py-2 sm:px-6 sm:py-3 backdrop-blur z-30">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] sm:text-xs">
          {analysis && (
            <>
              <span>🟢 {analysis.analysis_summary.healthy_area_percent}% <span className="hidden xs:inline">Healthy</span></span>
              <span>🟡 {analysis.analysis_summary.attention_area_percent}% <span className="hidden xs:inline">Attention</span></span>
              <span>🔴 {analysis.analysis_summary.problem_area_percent}% <span className="hidden xs:inline">Problem</span></span>
              <MethodBadge method={analysis.method} />
              {analysis.is_mock && <MockDataBadge />}
            </>
          )}
        </div>
        <div className="text-[11px] sm:text-xs text-muted-foreground hidden sm:block">
          {images ? `${frameAnchors.length} frames` : ""}{" "}
          {field?.area_hectares != null && `· ${field.area_hectares} ha`}
        </div>
      </div>
    </div>
  );
}
