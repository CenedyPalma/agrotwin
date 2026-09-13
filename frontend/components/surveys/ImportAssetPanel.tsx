"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, Trash2, Loader2, Layers } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const ASSET_TYPES = [
  { value: "orthomosaic", label: "Orthomosaic (GeoTIFF)" },
  { value: "ndvi", label: "NDVI (GeoTIFF)" },
  { value: "ndre", label: "NDRE (GeoTIFF)" },
  { value: "gndvi", label: "GNDVI (GeoTIFF)" },
  { value: "model3d", label: "3D Model" },
  { value: "pointcloud", label: "Point Cloud" },
  { value: "tileset", label: "3D Tileset" },
];

const ASSET_TYPE_LABEL: Record<string, string> = {
  orthomosaic: "Orthomosaic",
  ndvi: "NDVI",
  ndre: "NDRE",
  gndvi: "GNDVI",
  model3d: "3D Model",
  pointcloud: "Point Cloud",
  pointcloud_laz: "Point Cloud (LAZ)",
  dsm: "Elevation (DSM)",
  dtm: "Bare earth (DTM)",
  tileset: "3D Tileset",
  gnss_timestamp_mrk: "RTK timestamps (.MRK)",
  gnss_ppk_nav: "PPK navigation (.nav)",
  gnss_ppk_obs: "PPK observations (.obs)",
  gnss_ppk_raw: "PPK raw log (.bin)",
};

export function ImportAssetPanel({ surveyId }: { surveyId: string }) {
  const qc = useQueryClient();
  const [assetType, setAssetType] = useState("orthomosaic");
  const [file, setFile] = useState<File | null>(null);

  const { data: assets } = useQuery({
    queryKey: ["survey-assets", surveyId],
    queryFn: () => api.listSurveyAssets(surveyId),
  });

  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose a file first");
      return api.uploadSurveyAsset(surveyId, assetType, file);
    },
    onSuccess: () => {
      setFile(null);
      qc.invalidateQueries({ queryKey: ["survey-assets", surveyId] });
      qc.invalidateQueries({ queryKey: ["survey-availability", surveyId] });
    },
  });

  const remove = useMutation({
    mutationFn: (assetId: string) => api.deleteSurveyAsset(surveyId, assetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey-assets", surveyId] });
      qc.invalidateQueries({ queryKey: ["survey-availability", surveyId] });
    },
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Layers size={16} className="text-brand" />
        <h2 className="font-semibold text-sm">Import Processed Data</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Import an orthomosaic or index raster from ODM/WebODM, DJI Terra, or Metashape. GeoTIFF bounds
        are read directly from the file and rendered in the Digital Twin at their real location.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={assetType}
          onChange={(e) => setAssetType(e.target.value)}
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          {ASSET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-surface-2 px-3 py-2 text-sm text-muted-foreground hover:border-brand/50">
          <UploadCloud size={15} />
          {file ? file.name : "Choose file"}
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <Button size="lg" onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
          {upload.isPending && <Loader2 className="animate-spin" />}
          Import
        </Button>
      </div>
      {upload.isError && <div className="text-xs text-problem">{(upload.error as Error).message}</div>}

      {assets && assets.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          {assets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium">{ASSET_TYPE_LABEL[asset.asset_type] ?? asset.asset_type}</span>
                <span className="text-muted-foreground">
                  {asset.format === "xyz" ? "TILE PYRAMID" : asset.format?.toUpperCase()} ·{" "}
                  {asset.asset_type.startsWith("gnss_")
                    ? "from the DJI mission folder · positions already RTK-fixed in flight"
                    : asset.source === "direct_georeferencing"
                      ? "quick mosaic built from this survey's frames · georeferenced"
                      : asset.source === "photogrammetry_odm"
                        ? "true photogrammetry (OpenDroneMap) from this survey's frames"
                        : asset.source === "photogrammetry"
                          ? "derived from the splat reconstruction"
                          : asset.bounds_geojson
                            ? "georeferenced"
                            : "no bounds detected"}
                </span>
              </div>
              {asset.source === "manual_import" && (
                <button
                  onClick={() => remove.mutate(asset.id)}
                  className="text-muted-foreground hover:text-problem"
                  title="Remove imported file"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
