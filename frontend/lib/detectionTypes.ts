// Mirrors _classify_zone_type in backend/app/services/analysis_service.py.
export const DETECTION_TYPE_LABEL: Record<string, string> = {
  bare_soil: "Bare Soil",
  low_crop_density: "Low Crop Density",
  patchy_vegetation: "Patchy Vegetation",
};
