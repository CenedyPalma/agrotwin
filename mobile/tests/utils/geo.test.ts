import type { Polygon } from "geojson";
import { bboxOf, centroidOf, compassLabel, parseGeometry, polygonAreaM2, regionFromBBox, ringsOf } from "@/utils/geo";

// A real zone from the live "40 ft RGB Site" analysis (patchy_vegetation, ~5 m cells).
const zone: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-85.58256263114623, 36.096340460507385],
      [-85.58256182167564, 36.09642993386307],
      [-85.58250548466121, 36.09642993386307],
      [-85.58250548466121, 36.09647434202905],
      [-85.58239362001326, 36.096473685009606],
      [-85.58239362001326, 36.096429276870445],
      [-85.58244995712096, 36.096429276870445],
      [-85.58244995712096, 36.09638486870303],
      [-85.58250629416528, 36.09638486870303],
      [-85.58250629416528, 36.096340460507385],
      [-85.58256263114623, 36.096340460507385],
    ],
  ],
};

describe("geo utils", () => {
  it("computes a bbox and centroid", () => {
    const b = bboxOf(zone);
    expect(b).not.toBeNull();
    expect(b!.west).toBeCloseTo(-85.58256263, 6);
    expect(b!.north).toBeCloseTo(36.09647434, 6);
    const c = centroidOf(zone)!;
    expect(c.latitude).toBeGreaterThan(b!.south);
    expect(c.latitude).toBeLessThan(b!.north);
  });

  it("measures an L-shaped set of 5 m cells as roughly 5 cells (≈125 m²)", () => {
    const area = polygonAreaM2(zone)!;
    expect(area).toBeGreaterThan(100);
    expect(area).toBeLessThan(160);
  });

  it("converts rings to map coordinates", () => {
    const rings = ringsOf(zone);
    expect(rings).toHaveLength(1);
    expect(rings[0]![0]).toEqual({ latitude: 36.096340460507385, longitude: -85.58256263114623 });
  });

  it("labels compass direction relative to the field centre", () => {
    const center = { latitude: 36.0968562, longitude: -85.5829629 };
    const fieldBBox = { west: -85.5838, south: 36.0961, east: -85.5821, north: 36.0975 };
    expect(compassLabel(centroidOf(zone)!, center, fieldBBox)).toBe("South-East area");
    expect(compassLabel({ latitude: 36.09686, longitude: -85.58297 }, center, fieldBBox)).toBe("Central area");
  });

  it("pads regions and parses geometry safely", () => {
    const r = regionFromBBox({ west: 0, south: 0, east: 1, north: 1 }, 0.5);
    expect(r.latitudeDelta).toBeCloseTo(2);
    expect(parseGeometry("not json")).toBeNull();
    expect(parseGeometry(JSON.stringify(zone))?.type).toBe("Polygon");
  });
});
