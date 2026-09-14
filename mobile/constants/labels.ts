/**
 * Farmer-friendly wording for backend enumerations. Technical names stay
 * available for the "Advanced details" sections.
 */
import type { StatusTier } from "./theme";

// Mirrors _classify_zone_type in backend/app/services/analysis_service.py.
export const DETECTION_TYPE_LABEL: Record<string, string> = {
  bare_soil: "Bare Soil",
  low_crop_density: "Low Crop Density",
  patchy_vegetation: "Patchy Vegetation",
};

export const DETECTION_TYPE_DESCRIPTION: Record<string, string> = {
  bare_soil: "Little or no vegetation was measured here compared with the rest of the field.",
  low_crop_density: "Vegetation cover is well below what the best parts of this field reach.",
  patchy_vegetation: "Vegetation cover is uneven here — some spots are thinner than their surroundings.",
};

export function detectionTypeLabel(type: string): string {
  return DETECTION_TYPE_LABEL[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const SEVERITY_LABEL: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };

export function priorityLabel(severity: string): string {
  return `${SEVERITY_LABEL[severity] ?? severity} Priority`;
}

/** Same mapping the web app's DetectionPanel uses: low → needs attention, otherwise problem. */
export function severityTier(severity: string): StatusTier {
  return severity === "low" ? "attention" : "problem";
}

export const TIER_LABEL: Record<StatusTier, string> = {
  healthy: "Healthy",
  attention: "Needs Attention",
  problem: "Problem",
  info: "Info",
  neutral: "Unknown",
};

export const TIER_EMOJI: Record<StatusTier, string> = {
  healthy: "🟢",
  attention: "🟡",
  problem: "🔴",
  info: "🔵",
  neutral: "⚪",
};

// Mirrors METHOD_LABEL / METHOD_DESCRIPTION in frontend/lib/frames.ts.
export const METHOD_LABEL: Record<string, string> = {
  ndvi_map: "NDVI map (multispectral, 5 m cells)",
  exg_map: "Excess Green map (RGB, 5 m cells)",
  ndvi: "NDVI per frame (multispectral)",
  exg: "Excess Green per frame (RGB)",
};

export const METHOD_DESCRIPTION: Record<string, string> = {
  ndvi_map: "Vegetation cover measured on the georeferenced NDVI mosaic in 5 m cells — true area shares.",
  exg_map:
    "Vegetation cover measured on the georeferenced RGB photo map in 5 m cells (Excess Green Index) — true area shares.",
  ndvi: "Vegetation cover measured per photo from the NIR/Red bands; overlapping photos are not deduplicated.",
  exg: "Vegetation cover measured per photo with the RGB Excess Green Index; overlapping photos are not deduplicated.",
};

/** Plain-language version for the default (non-advanced) view. */
export const METHOD_PLAIN: Record<string, string> = {
  ndvi_map: "Measured from the multispectral crop-health map of this survey.",
  exg_map: "Measured from the colour photo map of this survey (how green each 5 m patch is).",
  ndvi: "Measured photo by photo from the multispectral bands.",
  exg: "Measured photo by photo from how green the crop looks.",
};

export const SURVEY_STATUS_LABEL: Record<string, string> = {
  PENDING: "Waiting for images",
  UPLOADING: "Uploading",
  QUEUED: "Queued",
  PROCESSING: "Processing",
  GENERATING_ORTHOMOSAIC: "Building field map",
  GENERATING_ANALYSIS: "Analysing",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export function surveyStatusLabel(status: string): string {
  return SURVEY_STATUS_LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase();
}

export function surveyStatusTier(status: string): StatusTier {
  if (status === "COMPLETED") return "healthy";
  if (status === "FAILED") return "problem";
  if (status === "PENDING") return "neutral";
  return "info";
}

export const BAND_LABEL: Record<string, string> = {
  RGB: "RGB",
  GREEN: "Green",
  RED: "Red",
  RED_EDGE: "Red Edge",
  NIR: "NIR",
  THERMAL: "Thermal",
};

export const ASSET_TYPE_LABEL: Record<string, string> = {
  orthomosaic: "Field Photo Map",
  ndvi: "Crop Health Map (NDVI)",
  ndre: "NDRE Map",
  gndvi: "GNDVI Map",
  thermal: "Thermal Map",
  dsm: "Elevation (DSM)",
  model3d: "3D Model",
  tileset: "3D Tiles",
  pointcloud: "Point Cloud",
  pointcloud_laz: "Point Cloud (LAZ)",
  geojson: "Imported Boundaries",
  boundary: "Field Boundary",
};

export function assetTypeLabel(type: string): string {
  return ASSET_TYPE_LABEL[type] ?? type;
}

/** Suggested questions shown in the AI chat. Answered from measured data only. */
export const SUGGESTED_QUESTIONS = [
  "How is my field doing?",
  "Where should I inspect today?",
  "Show me the problem areas.",
  "What changed since the last survey?",
  "Are there areas with low vegetation?",
  "How was this analysis measured?",
] as const;

/** Human-friendly copy for the most common failure modes. */
export const ERROR_COPY = {
  offline: {
    title: "Cannot connect to AgroTwin",
    message:
      "Check that the AgroTwin server is running on your computer and that this phone is on the same Wi-Fi network. You can change the server address in Settings.",
  },
  timeout: {
    title: "The server is taking too long",
    message: "AgroTwin did not answer in time. It may be busy processing a survey — try again in a moment.",
  },
  notConfigured: {
    title: "Server address not set",
    message: "Open Settings and enter the address of your AgroTwin server (for example http://192.168.1.50:8000).",
  },
  notFound: {
    title: "Not found",
    message: "This item no longer exists on the server. It may have been deleted from the web app.",
  },
  generic: {
    title: "Something went wrong",
    message: "AgroTwin could not complete this request. Please try again.",
  },
} as const;
