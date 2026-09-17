import type { SurveyImage } from "@/lib/types";

export const BAND_ORDER = ["RGB", "GREEN", "RED", "RED_EDGE", "NIR", "THERMAL"];

export const BAND_LABEL: Record<string, string> = {
  RGB: "RGB",
  GREEN: "Green",
  RED: "Red",
  RED_EDGE: "Red Edge",
  NIR: "NIR",
  THERMAL: "Thermal",
};

// Mirrors INDEX_BANDS in backend/app/services/multispectral_service.py.
export const INDEX_BANDS = {
  ndvi: ["NIR", "RED"],
  ndre: ["NIR", "RED_EDGE"],
  gndvi: ["NIR", "GREEN"],
} as const;

export type IndexKey = keyof typeof INDEX_BANDS;

export const INDEX_LABEL: Record<IndexKey, string> = {
  ndvi: "NDVI",
  ndre: "NDRE",
  gndvi: "GNDVI",
};

export const METHOD_LABEL: Record<string, string> = {
  ndvi_map: "NDVI map (multispectral, 5 m cells)",
  exg_map: "Excess Green map (RGB, 5 m cells)",
  ndvi: "NDVI per frame (multispectral)",
  exg: "Excess Green per frame (RGB)",
};

export const METHOD_DESCRIPTION: Record<string, string> = {
  ndvi_map: "Vegetation cover measured on the georeferenced NDVI mosaic in 5 m cells — true area shares.",
  exg_map: "Vegetation cover measured on the georeferenced RGB photo map in 5 m cells (Excess Green Index) — true area shares.",
  ndvi: "Vegetation cover measured per photo from the NIR/Red bands; overlapping photos are not deduplicated.",
  exg: "Vegetation cover measured per photo with the RGB Excess Green Index; overlapping photos are not deduplicated.",
};

export interface Frame {
  key: string;
  /** Preferred display image for this frame — the RGB band when present. */
  anchor: SurveyImage;
  bands: Record<string, SurveyImage>;
  indices: IndexKey[];
}

/** Groups a survey's images by shutter release (a multispectral frame is
 * several band files sharing one frame_key) — mirrors Survey.frame_count. */
export function groupFrames(images: SurveyImage[]): Frame[] {
  const groups = new Map<string, SurveyImage[]>();
  for (const img of images) {
    const key = img.frame_key ?? img.id;
    const list = groups.get(key);
    if (list) list.push(img);
    else groups.set(key, [img]);
  }

  const frames: Frame[] = Array.from(groups.entries()).map(([key, members]) => {
    const bands: Record<string, SurveyImage> = {};
    for (const img of members) bands[img.band] = img;
    const anchor = bands.RGB ?? members[0];
    const indices = (Object.keys(INDEX_BANDS) as IndexKey[]).filter((idx) =>
      INDEX_BANDS[idx].every((band) => !!bands[band])
    );
    return { key, anchor, bands, indices };
  });

  return frames.sort((a, b) => (a.anchor.captured_at ?? "").localeCompare(b.anchor.captured_at ?? ""));
}
