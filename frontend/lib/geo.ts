import type { Geometry } from "geojson";

/** Bounding box of a rectangular GeoJSON Polygon (as produced by
 * extract_bounds_geojson in backend/app/services/orthomosaic_service.py)
 * as [west, south, east, north] for Cesium.Rectangle.fromDegrees. */
export function wsenFromPolygon(
  geometry: Geometry | null | undefined
): [west: number, south: number, east: number, north: number] | null {
  if (!geometry || geometry.type !== "Polygon") return null;
  const ring = geometry.coordinates[0];
  if (!ring || ring.length === 0) return null;

  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  if (!Number.isFinite(west) || !Number.isFinite(south) || !Number.isFinite(east) || !Number.isFinite(north)) {
    return null;
  }
  return [west, south, east, north];
}
