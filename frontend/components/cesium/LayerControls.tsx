"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect } from "react";
import { useDigitalTwinStore } from "@/lib/digitalTwinStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

function LayerToggle({
  checked,
  onChange,
  label,
  disabled,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 py-1.5 text-xs ${
        disabled ? "text-muted-foreground/50 cursor-not-allowed" : "cursor-pointer"
      }`}
      title={hint}
    >
      <span className="flex items-center gap-2">
        <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => onChange()} />
        {label}
      </span>
      {disabled && <span className="text-[10px] text-muted-foreground/60">soon</span>}
    </label>
  );
}

export interface LayerControlsProps {
  hasOrthomosaic?: boolean;
  hasNdvi?: boolean;
  hasNdre?: boolean;
  hasGndvi?: boolean;
  hasDsm?: boolean;
  hasMesh?: boolean;
  /** "reality": true-3D photogrammetry mesh (OpenDroneMap); "terrain": 2.5D heightfield fallback */
  meshKind?: "reality" | "terrain";
  hasPointCloud?: boolean;
}

export function LayerControls({
  hasOrthomosaic,
  hasNdvi,
  hasNdre,
  hasGndvi,
  hasDsm,
  hasMesh,
  meshKind = "terrain",
  hasPointCloud,
}: LayerControlsProps) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setOpen(false);
    }
  }, []);

  const {
    advanced,
    toggleAdvanced,
    showRgbPoints,
    showFieldBoundary,
    showProblemZones,
    showOrthomosaic,
    showNdvi,
    showNdre,
    showGndvi,
    showCropDensity,
    showDsm,
    showMesh,
    showPointCloud,
    mode,
    toggleLayer,
  } = useDigitalTwinStore();

  return (
    <div className="pointer-events-auto w-48 sm:w-56 rounded-xl border border-border bg-surface/90 shadow-lg backdrop-blur">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-surface-2/60 transition-colors rounded-t-xl"
      >
        <span>Layers</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="border-t border-border px-3 py-2 max-h-[50vh] sm:max-h-[65vh] overflow-y-auto">
          <LayerToggle checked={showFieldBoundary} onChange={() => toggleLayer("fieldBoundary")} label="Field Boundary" />
          {mode === "3d-twin" && (
            <LayerToggle
              checked={showMesh}
              onChange={() => toggleLayer("mesh")}
              label={
                meshKind === "reality"
                  ? advanced ? "Reality Mesh (true 3D, photogrammetry)" : "3D Reality Mesh"
                  : advanced ? "3D Model (textured terrain)" : "3D Terrain"
              }
              disabled={!hasMesh}
              hint={
                meshKind === "reality"
                  ? "Full 3D textured mesh from multi-view stereo on the survey's frames (OpenDroneMap): rounded tree crowns, real vertical faces"
                  : "Bare-earth terrain mesh reconstructed from the survey's frames, textured with the field photo map"
              }
            />
          )}
          <LayerToggle
            checked={showOrthomosaic}
            onChange={() => toggleLayer("orthomosaic")}
            label={advanced ? "Orthomosaic (quick mosaic)" : "Field Photo Map"}
            disabled={!hasOrthomosaic}
            hint="Georeferenced RGB mosaic built from the survey's RTK-tagged frames"
          />
          <LayerToggle
            checked={showNdvi}
            onChange={() => toggleLayer("ndvi")}
            label={advanced ? "NDVI map" : "Crop Health Map"}
            disabled={!hasNdvi}
            hint="Georeferenced NDVI computed from the multispectral bands (red = low, green = high)"
          />
          <LayerToggle
            checked={showProblemZones}
            onChange={() => toggleLayer("problemZones")}
            label={advanced ? "Detection Zones" : "Needs Attention"}
          />
          <LayerToggle
            checked={showRgbPoints}
            onChange={() => toggleLayer("rgbPoints")}
            label={advanced ? "Image Capture Points" : "Survey Coverage"}
          />
          <LayerToggle
            checked={showCropDensity}
            onChange={() => toggleLayer("cropDensity")}
            label={advanced ? "Crop Density (per frame)" : "Crop Density"}
            hint="Measured per-frame vegetation coverage (NDVI when multispectral bands exist, RGB index otherwise) — red/amber/green"
          />

          {advanced && (
            <>
              <div className="my-2 border-t border-border" />
              <LayerToggle
                checked={showNdre}
                onChange={() => toggleLayer("ndre")}
                label="NDRE map"
                disabled={!hasNdre}
                hint="Georeferenced NDRE (NIR / Red Edge) — canopy chlorophyll sensitivity"
              />
              <LayerToggle
                checked={showGndvi}
                onChange={() => toggleLayer("gndvi")}
                label="GNDVI map"
                disabled={!hasGndvi}
                hint="Georeferenced GNDVI (NIR / Green)"
              />
              <LayerToggle
                checked={showDsm}
                onChange={() => toggleLayer("dsm")}
                label="Elevation (DSM)"
                disabled={!hasDsm}
                hint="Digital surface model from the 3D reconstruction — relative relief, low (blue) to high (red)"
              />
              <LayerToggle
                checked={showPointCloud}
                onChange={() => toggleLayer("pointCloud")}
                label="Point Cloud"
                disabled={!hasPointCloud}
                hint="Dense surface samples from the 3D reconstruction"
              />
              <LayerToggle checked={false} onChange={() => {}} label="Thermal" disabled hint="No thermal sensor data in this dataset" />
            </>
          )}

          <div className="my-2 border-t border-border" />
          <Button variant="link" size="xs" onClick={toggleAdvanced} className="px-0 text-[11px]">
            {advanced ? "Simple View" : "Advanced View"}
          </Button>
        </div>
      )}
    </div>
  );
}
