import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { secureStorage } from "./secureStorage";

export type MapBaseLayer = "satellite" | "hybrid" | "standard";

/** Simple layers are on by default; advanced ones are opt-in, like the web viewer's Advanced View. */
export type MapLayerKey = "field" | "zones" | "orthomosaic" | "imagePoints" | "ndvi" | "ndre" | "gndvi" | "dsm";

interface MapLayerState {
  baseLayer: MapBaseLayer;
  layers: Record<MapLayerKey, boolean>;
  showAdvanced: boolean;
  setBaseLayer: (base: MapBaseLayer) => void;
  toggleLayer: (key: MapLayerKey) => void;
  setLayer: (key: MapLayerKey, on: boolean) => void;
  setShowAdvanced: (on: boolean) => void;
}

const defaultLayers: Record<MapLayerKey, boolean> = {
  field: true,
  zones: true,
  orthomosaic: true,
  imagePoints: false,
  ndvi: false,
  ndre: false,
  gndvi: false,
  dsm: false,
};

export const useMapLayerStore = create<MapLayerState>()(
  persist(
    (set) => ({
      baseLayer: "hybrid",
      layers: defaultLayers,
      showAdvanced: false,
      setBaseLayer: (baseLayer) => set({ baseLayer }),
      toggleLayer: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
      setLayer: (key, on) => set((s) => ({ layers: { ...s.layers, [key]: on } })),
      setShowAdvanced: (showAdvanced) => set({ showAdvanced }),
    }),
    {
      name: "agrotwin.map",
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ baseLayer: s.baseLayer, layers: s.layers, showAdvanced: s.showAdvanced }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<MapLayerState>;
        return { ...current, ...p, layers: { ...defaultLayers, ...(p.layers ?? {}) } };
      },
    }
  )
);
