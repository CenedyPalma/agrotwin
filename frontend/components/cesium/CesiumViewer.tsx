"use client";

import type * as GeoJSON from "geojson";
import { useEffect, useRef, useState } from "react";
import { loadCesium } from "@/lib/loadCesium";
import type { DetectionZone, SurveyImage } from "@/lib/types";
import { useDigitalTwinStore } from "@/lib/digitalTwinStore";
import { CesiumScene } from "./CesiumScene";
import { DetectionLayer } from "./DetectionLayer";
import { SurveyImageryLayer, type RasterAsset } from "./SurveyImageryLayer";
import { SplatLayer, type SplatStatus } from "./SplatLayer";
import { ModelLayer } from "./ModelLayer";

// Token-free: Esri World Imagery (aerial) as the basemap and Esri Terrain3D
// as global terrain. No Cesium Ion access token is used anywhere.
const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_TERRAIN_URL =
  "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer";

/** Everything this app builds (mesh, point cloud, splats) is placed with its
 * ground plane at height 0 in its own frame, and the survey's DTM heights
 * are ellipsoidal (RTK) while the global terrain is orthometric and only
 * ~10-30 m resolution. Rather than trust either datum, sample the terrain
 * under the field and lift the products by that: the field then sits on the
 * real surrounding relief with no plateau at its edges. */
async function sampleGroundHeight(Cesium: any, terrainProvider: any, lon: number, lat: number,
                                  boundary: GeoJSON.Geometry | null): Promise<number> {
  const pts = [Cesium.Cartographic.fromDegrees(lon, lat)];
  if (boundary?.type === "Polygon") {
    for (const [x, y] of (boundary as GeoJSON.Polygon).coordinates[0]) pts.push(Cesium.Cartographic.fromDegrees(x, y));
  }
  try {
    const sampled = await Cesium.sampleTerrainMostDetailed(terrainProvider, pts);
    const hs = sampled.map((c: any) => c.height).filter((h: number) => Number.isFinite(h)).sort((a: number, b: number) => a - b);
    return hs.length ? hs[Math.floor(hs.length / 2)] : 0;
  } catch (e) {
    console.warn("terrain sampling failed, using ellipsoid height 0", e);
    return 0;
  }
}

export interface CesiumViewerProps {
  boundary: GeoJSON.Geometry | null;
  centerLat: number | null;
  centerLon: number | null;
  images: SurveyImage[];
  detections: DetectionZone[];
  orthomosaic?: RasterAsset | null;
  ndvi?: RasterAsset | null;
  ndre?: RasterAsset | null;
  gndvi?: RasterAsset | null;
  dsm?: RasterAsset | null;
  meshUrl?: string | null;
  /** "reality": LOD-tiled ODM mesh (let Cesium pick LODs); "terrain": single-tile 2.5D fallback */
  meshKind?: "reality" | "terrain";
  pointCloudUrl?: string | null;
  surveyId?: string | null;
  initialCamera?: { lon: number; lat: number; height: number; heading: number; pitch: number } | null;
  onSelectDetection?: (id: string | null) => void;
  onSplatStatus?: (status: SplatStatus, detail?: string) => void;
}

/** Owns only the Cesium Viewer lifecycle (init/cleanup — no memory leaks on
 * unmount) and composes the independent layer components. Client-side only;
 * always loaded via next/dynamic({ ssr: false }) by the page that uses it. */
export default function CesiumViewer({
  boundary,
  centerLat,
  centerLon,
  images,
  detections,
  orthomosaic = null,
  ndvi = null,
  ndre = null,
  gndvi = null,
  dsm = null,
  meshUrl = null,
  meshKind = "terrain",
  pointCloudUrl = null,
  surveyId = null,
  initialCamera = null,
  onSelectDetection,
  onSplatStatus,
}: CesiumViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Held in state (not a ref) so a destroyed viewer is never handed to the
  // layer components: cleanup resets it before React re-renders children.
  const [cesiumCtx, setCesiumCtx] = useState<{ viewer: any; Cesium: any } | null>(null);
  const [status, setStatus] = useState("Initializing viewer…");
  // Terrain height (in the viewer's datum) of the field's ground plane.
  const [groundHeight, setGroundHeight] = useState<number | null>(null);
  // The live reality-mesh tileset, so vegetation layers can drape onto it.
  const [meshTileset, setMeshTileset] = useState<any>(null);

  const mode = useDigitalTwinStore((s) => s.mode);
  const showRgbPoints = useDigitalTwinStore((s) => s.showRgbPoints);
  const showFieldBoundary = useDigitalTwinStore((s) => s.showFieldBoundary);
  const showProblemZones = useDigitalTwinStore((s) => s.showProblemZones);
  const showOrthomosaic = useDigitalTwinStore((s) => s.showOrthomosaic);
  const showNdvi = useDigitalTwinStore((s) => s.showNdvi);
  const showNdre = useDigitalTwinStore((s) => s.showNdre);
  const showGndvi = useDigitalTwinStore((s) => s.showGndvi);
  const showCropDensity = useDigitalTwinStore((s) => s.showCropDensity);
  const showDsm = useDigitalTwinStore((s) => s.showDsm);
  const showMesh = useDigitalTwinStore((s) => s.showMesh);
  const showPointCloud = useDigitalTwinStore((s) => s.showPointCloud);

  useEffect(() => {
    let cancelled = false;
    let viewer: any = null;

    async function init() {
      try {
        const Cesium = await loadCesium();
        if (cancelled || !containerRef.current) return;

        const imageryProvider = new Cesium.UrlTemplateImageryProvider({
          url: ESRI_IMAGERY_URL,
          credit: "Esri, Maxar, Earthstar Geographics",
          maximumLevel: 19,
        });

        let terrainProvider: any;
        try {
          terrainProvider = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(ESRI_TERRAIN_URL);
        } catch (e) {
          console.warn("global terrain unavailable, falling back to the ellipsoid", e);
          terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }
        if (cancelled || !containerRef.current) return;

        viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(Promise.resolve(imageryProvider)),
          terrainProvider,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
        });

        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#1b3a2c");
        // Left off (default): the survey products are lifted onto the ~10-30 m
        // global terrain by a single sampled offset, so parts of them sit a
        // metre or two under it and a depth test would clip them.
        viewer.scene.globe.depthTestAgainstTerrain = false;
        (window as any).__agrotwinViewer = viewer; // diagnostics (headless checks)
        (window as any).__Cesium = Cesium;

        setCesiumCtx({ viewer, Cesium });
        setStatus("Ready");
      } catch (e: any) {
        console.error(e);
        setStatus(`Failed to start Cesium: ${e?.message || e}`);
      }
    }

    init();
    return () => {
      cancelled = true;
      setCesiumCtx(null);
      try {
        viewer?.destroy();
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    if (!cesiumCtx || centerLat == null || centerLon == null) return;
    let cancelled = false;
    setGroundHeight(null);
    sampleGroundHeight(cesiumCtx.Cesium, cesiumCtx.viewer.terrainProvider, centerLon, centerLat, boundary).then((h) => {
      if (!cancelled) setGroundHeight(h);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cesiumCtx, centerLat, centerLon]);

  const viewer = cesiumCtx?.viewer ?? null;
  const Cesium = cesiumCtx?.Cesium ?? null;
  // Layers wait for the ground height so nothing is placed twice.
  const ready = cesiumCtx !== null && groundHeight !== null;
  const groundH = groundHeight ?? 0;
  const photorealistic = mode === "photorealistic";
  // The mesh carries the orthophoto as its texture and sits on the ellipsoid:
  // flat globe drapes underneath it would only z-fight, so while it shows,
  // the vegetation/elevation layers drape onto the mesh itself instead.
  const meshVisible = mode === "3d-twin" && showMesh && !!meshUrl;
  const hideDrapes = photorealistic || meshVisible;
  const onMesh = meshVisible && !!meshTileset;

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="cesium-viewer-full h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface text-sm text-muted-foreground">
          {status}
        </div>
      )}

      {/* Photorealistic mode shows the reconstruction itself — the flat drapes
          and capture points would just sit on top of it. */}
      <CesiumScene
        viewer={viewer}
        Cesium={Cesium}
        ready={ready}
        boundary={boundary}
        centerLat={centerLat}
        centerLon={centerLon}
        images={images}
        showFieldBoundary={showFieldBoundary}
        showRgbPoints={showRgbPoints && !photorealistic}
        showCropDensity={showCropDensity && !photorealistic}
        mode={mode}
        initialCamera={initialCamera}
        groundHeight={groundH}
      />
      <SurveyImageryLayer
        viewer={viewer}
        Cesium={Cesium}
        ready={ready}
        orthomosaic={orthomosaic}
        ndvi={ndvi}
        ndre={ndre}
        gndvi={gndvi}
        dsm={dsm}
        showOrthomosaic={showOrthomosaic && !hideDrapes}
        showNdvi={showNdvi && !hideDrapes}
        showNdre={showNdre && !hideDrapes}
        showGndvi={showGndvi && !hideDrapes}
        showDsm={showDsm && !hideDrapes}
      />
      <SurveyImageryLayer
        viewer={viewer}
        Cesium={Cesium}
        ready={ready}
        tileset={meshTileset}
        orthomosaic={null}
        ndvi={ndvi}
        ndre={ndre}
        gndvi={gndvi}
        dsm={dsm}
        showOrthomosaic={false}
        showNdvi={showNdvi && onMesh}
        showNdre={showNdre && onMesh}
        showGndvi={showGndvi && onMesh}
        showDsm={showDsm && onMesh}
      />
      <ModelLayer
        viewer={viewer}
        Cesium={Cesium}
        ready={ready}
        url={meshUrl}
        show={meshVisible}
        maximumScreenSpaceError={meshKind === "reality" ? 8 : 2}
        groundHeight={groundH}
        onTileset={setMeshTileset}
      />
      <ModelLayer
        viewer={viewer}
        Cesium={Cesium}
        ready={ready}
        url={pointCloudUrl}
        show={showPointCloud && mode !== "photorealistic"}
        pointSize={3}
        groundHeight={groundH}
      />
      <DetectionLayer
        viewer={viewer}
        Cesium={Cesium}
        ready={ready}
        detections={detections}
        showProblemZones={showProblemZones}
        drape={!photorealistic}
        groundHeight={groundH}
        onSelectDetection={onSelectDetection}
      />
      <SplatLayer
        viewer={viewer}
        Cesium={Cesium}
        ready={ready}
        mode={mode}
        surveyId={surveyId}
        groundHeight={groundH}
        onStatus={onSplatStatus}
      />
    </div>
  );
}
