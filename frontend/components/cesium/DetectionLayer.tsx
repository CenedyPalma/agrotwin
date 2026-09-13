"use client";

import type * as GeoJSON from "geojson";
import { useEffect } from "react";
import type { DetectionZone } from "@/lib/types";

const SEVERITY_COLOR: Record<string, [number, number, number, number]> = {
  low: [234, 179, 8, 90],
  medium: [249, 115, 22, 110],
  high: [239, 68, 68, 130],
};

export interface DetectionLayerProps {
  viewer: any;
  Cesium: any;
  ready: boolean;
  detections: DetectionZone[];
  showProblemZones: boolean;
  /** Drape onto terrain / 3D Tiles (reality mesh) instead of floating at a
   * fixed height. Off in Photorealistic mode: splats are not classifiable. */
  drape?: boolean;
  /** Terrain height of the field's ground plane (for the non-draped placement). */
  groundHeight?: number;
  onSelectDetection?: (id: string | null) => void;
}

/** Renders AI/CV detection zones as clickable polygons and wires the pick handler. */
export function DetectionLayer({
  viewer,
  Cesium,
  ready,
  detections,
  showProblemZones,
  drape = true,
  groundHeight = 0,
  onSelectDetection,
}: DetectionLayerProps) {
  useEffect(() => {
    if (!viewer || !Cesium || !ready || viewer.isDestroyed()) return;

    for (const d of detections) {
      viewer.entities.removeById(`zone-${d.id}`);
      viewer.entities.removeById(`zone-outline-${d.id}`);
    }

    if (showProblemZones) {
      for (const d of detections) {
        if (d.geometry.type !== "Polygon") continue;
        const coords = (d.geometry as GeoJSON.Polygon).coordinates[0];
        const positions = coords.flatMap(([lon, lat]) => [lon, lat]);
        const [r, g, b, a] = SEVERITY_COLOR[d.severity] ?? SEVERITY_COLOR.medium;
        const fill = Cesium.Color.fromBytes(r, g, b, a);
        const line = Cesium.Color.fromBytes(r, g, b, 255);
        if (drape) {
          // ground polygons cannot carry an outline, so it is a clamped polyline
          viewer.entities.add({
            id: `zone-${d.id}`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(positions),
              material: fill,
              classificationType: Cesium.ClassificationType.BOTH,
            },
            properties: { detectionId: d.id },
          });
          viewer.entities.add({
            id: `zone-outline-${d.id}`,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(positions),
              width: 2,
              material: line,
              clampToGround: true,
              classificationType: Cesium.ClassificationType.BOTH,
            },
            properties: { detectionId: d.id },
          });
        } else {
          viewer.entities.add({
            id: `zone-${d.id}`,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(positions),
              material: fill,
              outline: true,
              outlineColor: line,
              height: groundHeight + 1.5,
            },
            properties: { detectionId: d.id },
          });
        }
      }
    }
  }, [viewer, Cesium, ready, detections, showProblemZones, drape, groundHeight]);

  useEffect(() => {
    if (!viewer || !Cesium || !ready || viewer.isDestroyed() || !onSelectDetection) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const picked = viewer.scene.pick(movement.position);
      const id = picked?.id?.properties?.detectionId?.getValue?.();
      onSelectDetection(id ?? null);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => handler.destroy();
  }, [viewer, Cesium, ready, onSelectDetection]);

  return null;
}
