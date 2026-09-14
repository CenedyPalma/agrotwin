"use client";

import { useEffect } from "react";

export interface VectorOverlay {
  id: string;
  url: string;
}

export interface VectorLayerProps {
  viewer: any;
  Cesium: any;
  ready: boolean;
  overlays: VectorOverlay[];
  show: boolean;
  /** Drape onto terrain / 3D Tiles; off in Photorealistic mode (splats are not classifiable). */
  drape?: boolean;
  groundHeight?: number;
}

const STROKE = "#38bdf8";
const FILL = "rgba(56, 189, 248, 0.18)";

/** Imported GeoJSON (boundaries, management zones, scouting notes) drawn at
 * its real WGS84 position. One GeoJsonDataSource per file; removed again
 * when hidden or when the overlay list changes. */
export function VectorLayer({ viewer, Cesium, ready, overlays, show, drape = true, groundHeight = 0 }: VectorLayerProps) {
  useEffect(() => {
    if (!viewer || !Cesium || !ready || viewer.isDestroyed() || !show || overlays.length === 0) return undefined;

    let cancelled = false;
    const loaded: any[] = [];
    (async () => {
      for (const overlay of overlays) {
        try {
          const ds = await Cesium.GeoJsonDataSource.load(overlay.url, {
            stroke: Cesium.Color.fromCssColorString(STROKE),
            fill: Cesium.Color.fromCssColorString(FILL),
            strokeWidth: 3,
            clampToGround: drape,
            markerColor: Cesium.Color.fromCssColorString(STROKE),
            markerSize: 32,
          });
          if (cancelled || viewer.isDestroyed()) return;
          for (const entity of ds.entities.values) {
            if (entity.polygon) {
              if (drape) entity.polygon.classificationType = Cesium.ClassificationType.BOTH;
              else entity.polygon.height = groundHeight + 1.5;
            }
            if (entity.polyline) {
              if (drape) entity.polyline.classificationType = Cesium.ClassificationType.BOTH;
            }
            if (entity.billboard) entity.billboard.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
          }
          viewer.dataSources.add(ds);
          loaded.push(ds);
        } catch (e) {
          console.error("vector overlay", overlay.url, e);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (viewer.isDestroyed()) return;
      for (const ds of loaded) {
        try {
          viewer.dataSources.remove(ds, true);
        } catch {
          /* already gone */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, Cesium, ready, show, drape, groundHeight, overlays.map((o) => o.id).join(",")]);

  return null;
}
