import type { Geometry } from "geojson";
import { assetsService } from "@/services/assets";
import type { SurveyAsset } from "@/types";
import { bboxOf, parseGeometry, type BBox } from "@/utils/geo";

export type RasterLayerKey = "orthomosaic" | "ndvi" | "ndre" | "gndvi" | "dsm";

/** A raster the map can draw: an XYZ tile pyramid (preferred) or a flat bounds-aligned PNG. */
export type RasterSource =
  | { kind: "tiles"; asset: SurveyAsset; template: string; bounds: BBox }
  | { kind: "image"; asset: SurveyAsset; url: string; bounds: BBox };

// Same ranking as frontend/lib/surveyAssets.ts: photogrammetry and manual
// imports beat the quick direct-georeferenced products.
const SOURCE_RANK: Record<string, number> = { photogrammetry_odm: 0, manual_import: 0, direct_georeferencing: 1 };
const rank = (a: SurveyAsset) => SOURCE_RANK[a.source] ?? 2;

function boundsOf(asset: SurveyAsset): BBox | null {
  return bboxOf(parseGeometry(asset.bounds_geojson) as Geometry | null);
}

/**
 * Picks the best drawable source for each raster layer. Tile pyramids
 * (build_tiles.py, served statically by the web app) keep zooming sharp and
 * stream only what is on screen; the flat preview PNG is a fallback and is
 * several MB, so callers may choose not to load it on cellular connections.
 */
export function selectRasterSources(assets: SurveyAsset[] | undefined): Partial<Record<RasterLayerKey, RasterSource>> {
  const list = assets ?? [];
  const out: Partial<Record<RasterLayerKey, RasterSource>> = {};
  for (const key of ["orthomosaic", "ndvi", "ndre", "gndvi", "dsm"] as RasterLayerKey[]) {
    const ofType = list.filter((a) => a.asset_type === key).sort((a, b) => rank(a) - rank(b));
    const tiles = ofType.find((a) => a.format === "xyz" && !!a.public_url);
    const tilesBounds = tiles ? boundsOf(tiles) : null;
    if (tiles && tilesBounds) {
      const template = assetsService.tileTemplate(tiles);
      if (template) {
        out[key] = { kind: "tiles", asset: tiles, template, bounds: tilesBounds };
        continue;
      }
    }
    const tif = ofType.find((a) => !!a.format && /tiff?$/i.test(a.format));
    const tifBounds = tif ? boundsOf(tif) : null;
    if (tif && tifBounds) {
      out[key] = { kind: "image", asset: tif, url: assetsService.previewUrl(tif.survey_id, tif.id), bounds: tifBounds };
    }
  }
  return out;
}
