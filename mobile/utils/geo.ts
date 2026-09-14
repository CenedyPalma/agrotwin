import type { Geometry, Polygon, Position } from "geojson";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

function* positions(geometry: Geometry): Generator<Position> {
  switch (geometry.type) {
    case "Point":
      yield geometry.coordinates;
      break;
    case "MultiPoint":
    case "LineString":
      yield* geometry.coordinates;
      break;
    case "MultiLineString":
    case "Polygon":
      for (const ring of geometry.coordinates) yield* ring;
      break;
    case "MultiPolygon":
      for (const poly of geometry.coordinates) for (const ring of poly) yield* ring;
      break;
    case "GeometryCollection":
      for (const g of geometry.geometries) yield* positions(g);
      break;
  }
}

export function bboxOf(geometry: Geometry | null | undefined): BBox | null {
  if (!geometry) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of positions(geometry)) {
    if (lon == null || lat == null) continue;
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  if (![west, south, east, north].every(Number.isFinite)) return null;
  return { west, south, east, north };
}

export function bboxUnion(a: BBox | null, b: BBox | null): BBox | null {
  if (!a) return b;
  if (!b) return a;
  return {
    west: Math.min(a.west, b.west),
    south: Math.min(a.south, b.south),
    east: Math.max(a.east, b.east),
    north: Math.max(a.north, b.north),
  };
}

export function bboxFromPoints(points: LatLng[]): BBox | null {
  if (points.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const p of points) {
    if (p.longitude < west) west = p.longitude;
    if (p.longitude > east) east = p.longitude;
    if (p.latitude < south) south = p.latitude;
    if (p.latitude > north) north = p.latitude;
  }
  return { west, south, east, north };
}

export function centerOf(bbox: BBox): LatLng {
  return { latitude: (bbox.south + bbox.north) / 2, longitude: (bbox.west + bbox.east) / 2 };
}

/** react-native-maps region covering the bbox with some padding (fraction of the extent). */
export function regionFromBBox(bbox: BBox, padding = 0.25, minDelta = 0.002): Region {
  const center = centerOf(bbox);
  const latDelta = Math.max((bbox.north - bbox.south) * (1 + padding * 2), minDelta);
  const lonDelta = Math.max((bbox.east - bbox.west) * (1 + padding * 2), minDelta);
  return { ...center, latitudeDelta: latDelta, longitudeDelta: lonDelta };
}

/** Centroid of a geometry's vertices (adequate for the small, compact zones the analysis produces). */
export function centroidOf(geometry: Geometry | null | undefined): LatLng | null {
  if (!geometry) return null;
  let n = 0;
  let lat = 0;
  let lon = 0;
  for (const [x, y] of positions(geometry)) {
    if (x == null || y == null) continue;
    lon += x;
    lat += y;
    n += 1;
  }
  return n ? { latitude: lat / n, longitude: lon / n } : null;
}

/** Outer rings of a Polygon / MultiPolygon as react-native-maps coordinates. */
export function ringsOf(geometry: Geometry | null | undefined): LatLng[][] {
  if (!geometry) return [];
  const toRing = (ring: Position[]): LatLng[] =>
    ring
      .filter((p): p is [number, number] => p[0] != null && p[1] != null)
      .map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
  if (geometry.type === "Polygon") return geometry.coordinates[0] ? [toRing(geometry.coordinates[0])] : [];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((poly) => toRing(poly[0] ?? []));
  if (geometry.type === "GeometryCollection") return geometry.geometries.flatMap(ringsOf);
  return [];
}

/** Holes (inner rings) of a Polygon, for react-native-maps `holes`. */
export function holesOf(geometry: Geometry | null | undefined): LatLng[][] {
  if (!geometry || geometry.type !== "Polygon") return [];
  return geometry.coordinates.slice(1).map((ring) =>
    ring
      .filter((p): p is [number, number] => p[0] != null && p[1] != null)
      .map(([lon, lat]) => ({ latitude: lat, longitude: lon }))
  );
}

/**
 * Planar area of a lon/lat polygon in square metres, using an
 * equirectangular projection about the polygon's mean latitude. Accurate to
 * well under 1 % for field-sized shapes; labelled "approx." in the UI.
 */
export function polygonAreaM2(geometry: Geometry | null | undefined): number | null {
  if (!geometry) return null;
  const polys: Polygon["coordinates"][] =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
  if (polys.length === 0) return null;

  let total = 0;
  for (const rings of polys) {
    rings.forEach((ring, i) => {
      const a = ringAreaM2(ring);
      total += i === 0 ? a : -a;
    });
  }
  return Math.max(total, 0);
}

function ringAreaM2(ring: Position[]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring.reduce((s, p) => s + (p[1] ?? 0), 0) / ring.length) * (Math.PI / 180);
  const kx = EARTH_RADIUS_M * Math.cos(lat0) * (Math.PI / 180);
  const ky = EARTH_RADIUS_M * (Math.PI / 180);
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    if (!p || !q) continue;
    const x1 = (p[0] ?? 0) * kx;
    const y1 = (p[1] ?? 0) * ky;
    const x2 = (q[0] ?? 0) * kx;
    const y2 = (q[1] ?? 0) * ky;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

const COMPASS = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];

/**
 * Where a zone sits relative to the field centre, e.g. "North-West area".
 * Zones within ~15 % of the field's extent from the centre are "Central".
 */
export function compassLabel(point: LatLng, fieldCenter: LatLng, fieldBBox?: BBox | null): string {
  const dLat = point.latitude - fieldCenter.latitude;
  const dLon = (point.longitude - fieldCenter.longitude) * Math.cos((fieldCenter.latitude * Math.PI) / 180);
  if (fieldBBox) {
    const extent = Math.max(fieldBBox.north - fieldBBox.south, fieldBBox.east - fieldBBox.west);
    if (Math.hypot(dLat, dLon) < extent * 0.15) return "Central area";
  }
  const angle = (Math.atan2(dLon, dLat) * 180) / Math.PI; // 0 = north, clockwise
  const idx = Math.round(((angle + 360) % 360) / 45) % 8;
  return `${COMPASS[idx]} area`;
}

export function parseGeometry(json: string | null | undefined): Geometry | null {
  if (!json) return null;
  try {
    const g = JSON.parse(json) as Geometry;
    return g && typeof g === "object" && "type" in g ? g : null;
  } catch {
    return null;
  }
}
