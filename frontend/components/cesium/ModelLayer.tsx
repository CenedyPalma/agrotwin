"use client";

import { useEffect } from "react";
import { liftTileset } from "@/lib/cesiumPlacement";

export interface ModelLayerProps {
  viewer: any;
  Cesium: any;
  ready: boolean;
  url: string | null; // 3D Tiles tileset.json (plain glTF content: textured mesh or points)
  show: boolean;
  pointSize?: number;
  maximumScreenSpaceError?: number;
  /** Terrain height of the field's ground plane; the tileset is lifted to it. */
  groundHeight?: number;
  /** Receives the live tileset once added (null again when removed) so other
   * layers can drape imagery onto it. */
  onTileset?: (tileset: any | null) => void;
  onError?: (message: string) => void;
}

/** Loads a photogrammetry product as a 3D Tileset — the OpenDroneMap reality
 * mesh / dense cloud (import_odm.py) or the terrain mesh / point cloud from
 * build_dense.py, all under frontend/public/models/<survey_id>/. Local
 * files, no Cesium Ion. Removed again when hidden. */
export function ModelLayer({
  viewer,
  Cesium,
  ready,
  url,
  show,
  pointSize,
  maximumScreenSpaceError = 4,
  groundHeight = 0,
  onTileset,
  onError,
}: ModelLayerProps) {
  useEffect(() => {
    if (!viewer || !Cesium || !ready || viewer.isDestroyed() || !url || !show) return undefined;

    let cancelled = false;
    let tileset: any = null;
    (async () => {
      try {
        const head = await fetch(url, { method: "HEAD" });
        if (!head.ok) return;
        tileset = await Cesium.Cesium3DTileset.fromUrl(url, {
          maximumScreenSpaceError,
          // decoded textures dominate: ~16 MB per 2048² tile, so the 512 MB
          // default made Cesium quietly coarsen the reality mesh
          cacheBytes: 1024 * 1024 * 1024,
          maximumCacheOverflowBytes: 1024 * 1024 * 1024,
          skipLevelOfDetail: true,
        });
        if (cancelled || viewer.isDestroyed()) {
          tileset.destroy?.();
          return;
        }
        if (pointSize) {
          tileset.style = new Cesium.Cesium3DTileStyle({ pointSize });
          tileset.pointCloudShading.attenuation = true;
        }
        await liftTileset(Cesium, tileset, url, groundHeight);
        if (cancelled || viewer.isDestroyed()) {
          tileset.destroy?.();
          return;
        }
        viewer.scene.primitives.add(tileset);
        onTileset?.(tileset);
      } catch (e: any) {
        console.error(e);
        onError?.(e?.message ?? String(e));
      }
    })();

    return () => {
      cancelled = true;
      onTileset?.(null);
      if (tileset && !viewer.isDestroyed()) {
        try {
          viewer.scene.primitives.remove(tileset);
        } catch {
          /* already gone */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, Cesium, ready, url, show, pointSize, maximumScreenSpaceError, groundHeight]);

  return null;
}
