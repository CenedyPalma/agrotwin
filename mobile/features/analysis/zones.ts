import type { Geometry } from "geojson";
import type { DetectionZone } from "@/types";
import { bboxOf, centroidOf, compassLabel, polygonAreaM2, type BBox, type LatLng } from "@/utils/geo";

export interface ZoneView {
  zone: DetectionZone;
  areaM2: number | null;
  centroid: LatLng | null;
  bbox: BBox | null;
  /** "North-West area" relative to the field centre, when known. */
  locationLabel: string | null;
  /** 0 = highest priority. */
  rank: number;
}

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/** Adds derived, farmer-facing facts to raw detection zones and sorts by priority. */
export function enrichZones(
  zones: DetectionZone[],
  field: { center: LatLng | null; boundary: Geometry | null } | null
): ZoneView[] {
  const fieldBBox = field?.boundary ? bboxOf(field.boundary) : null;
  const center = field?.center ?? (fieldBBox ? { latitude: (fieldBBox.south + fieldBBox.north) / 2, longitude: (fieldBBox.west + fieldBBox.east) / 2 } : null);
  const views = zones.map<ZoneView>((zone) => {
    const centroid = centroidOf(zone.geometry);
    return {
      zone,
      areaM2: polygonAreaM2(zone.geometry),
      centroid,
      bbox: bboxOf(zone.geometry),
      locationLabel: centroid && center ? compassLabel(centroid, center, fieldBBox) : null,
      rank: SEVERITY_RANK[zone.severity] ?? 3,
    };
  });
  return views.sort((a, b) => a.rank - b.rank || b.zone.confidence - a.zone.confidence || (b.areaM2 ?? 0) - (a.areaM2 ?? 0));
}

export function countBySeverity(zones: DetectionZone[]): Record<"high" | "medium" | "low", number> {
  const out = { high: 0, medium: 0, low: 0 };
  for (const z of zones) {
    const s = z.severity as string;
    if (s === "high" || s === "medium" || s === "low") out[s] += 1;
  }
  return out;
}

export function countByType(zones: DetectionZone[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const z of zones) out[z.type] = (out[z.type] ?? 0) + 1;
  return out;
}
