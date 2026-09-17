import { create } from "zustand";

export type ViewMode = "field-map" | "3d-twin" | "photorealistic";

export type LayerKey =
  | "fieldBoundary"
  | "mesh"
  | "orthomosaic"
  | "ndvi"
  | "problemZones"
  | "rgbPoints"
  | "cropDensity"
  | "ndre"
  | "gndvi"
  | "dsm"
  | "pointCloud"
  | "vectorOverlays";

interface DigitalTwinState {
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;

  advanced: boolean;
  toggleAdvanced: () => void;

  selectedDetectionId: string | null;
  setSelectedDetectionId: (id: string | null) => void;

  showFieldBoundary: boolean;
  showMesh: boolean;
  showOrthomosaic: boolean;
  showNdvi: boolean;
  showProblemZones: boolean;
  showRgbPoints: boolean;
  showCropDensity: boolean;
  showNdre: boolean;
  showGndvi: boolean;
  showDsm: boolean;
  showPointCloud: boolean;
  showVectorOverlays: boolean;

  toggleLayer: (key: LayerKey) => void;
}

const LAYER_STATE_KEY: Record<
  LayerKey,
  | "showFieldBoundary"
  | "showMesh"
  | "showOrthomosaic"
  | "showNdvi"
  | "showProblemZones"
  | "showRgbPoints"
  | "showCropDensity"
  | "showNdre"
  | "showGndvi"
  | "showDsm"
  | "showPointCloud"
  | "showVectorOverlays"
> = {
  fieldBoundary: "showFieldBoundary",
  mesh: "showMesh",
  orthomosaic: "showOrthomosaic",
  ndvi: "showNdvi",
  problemZones: "showProblemZones",
  rgbPoints: "showRgbPoints",
  cropDensity: "showCropDensity",
  ndre: "showNdre",
  gndvi: "showGndvi",
  dsm: "showDsm",
  pointCloud: "showPointCloud",
  vectorOverlays: "showVectorOverlays",
};

export const useDigitalTwinStore = create<DigitalTwinState>((set) => ({
  mode: "field-map",
  setMode: (mode) => set({ mode }),

  advanced: false,
  toggleAdvanced: () => set((s) => ({ advanced: !s.advanced })),

  selectedDetectionId: null,
  setSelectedDetectionId: (id) => set({ selectedDetectionId: id }),

  showFieldBoundary: true,
  showMesh: true,
  showOrthomosaic: true,
  showNdvi: false,
  showProblemZones: true,
  showRgbPoints: true,
  showCropDensity: false,
  showNdre: false,
  showGndvi: false,
  showDsm: false,
  showPointCloud: false,
  showVectorOverlays: true,

  toggleLayer: (key) =>
    set((s) => {
      const stateKey = LAYER_STATE_KEY[key];
      return { [stateKey]: !s[stateKey] };
    }),
}));
