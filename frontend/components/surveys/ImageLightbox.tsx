"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download, MapPin } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { BAND_LABEL, BAND_ORDER, INDEX_LABEL, type Frame, type IndexKey } from "@/lib/frames";

type View = { kind: "band"; band: string } | { kind: "index"; index: IndexKey };

export function ImageLightbox({
  surveyId,
  frames,
  index,
  onClose,
  onNavigate,
  initialView,
}: {
  surveyId: string;
  frames: Frame[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
  initialView?: string | null;
}) {
  const frame = frames[index];
  const [view, setView] = useState<View>(() =>
    initialView && initialView in INDEX_LABEL
      ? { kind: "index", index: initialView as IndexKey }
      : { kind: "band", band: initialView && initialView in BAND_LABEL ? initialView : "RGB" }
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate(Math.min(index + 1, frames.length - 1));
      if (e.key === "ArrowLeft") onNavigate(Math.max(index - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, frames.length, onClose, onNavigate]);

  if (!frame) return null;

  const bands = BAND_ORDER.filter((b) => frame.bands[b]);
  const activeBand = view.kind === "band" ? frame.bands[view.band] ?? frame.anchor : frame.anchor;
  const src =
    view.kind === "index"
      ? api.frameIndexUrl(surveyId, frame.key, view.index)
      : api.imageDisplayUrl(surveyId, activeBand.id);

  const meta = frame.anchor;
  const hasStats = meta.ndvi_mean != null || meta.vegetation_fraction != null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 px-4 py-3 text-white">
        <div className="text-sm min-w-0">
          <div className="font-medium truncate">{activeBand.filename}</div>
          <div className="text-xs text-white/60">
            {index + 1} / {frames.length}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {bands.map((b) => (
            <button
              key={b}
              onClick={() => setView({ kind: "band", band: b })}
              className={clsx(
                "rounded-md px-2 py-1 text-xs",
                view.kind === "band" && view.band === b ? "bg-white text-black" : "bg-white/10 hover:bg-white/20"
              )}
            >
              {BAND_LABEL[b] ?? b}
            </button>
          ))}
          {frame.indices.length > 0 && <span className="mx-1 h-4 w-px bg-white/20" />}
          {frame.indices.map((idx) => (
            <button
              key={idx}
              onClick={() => setView({ kind: "index", index: idx })}
              className={clsx(
                "rounded-md px-2 py-1 text-xs",
                view.kind === "index" && view.index === idx ? "bg-brand text-white" : "bg-white/10 hover:bg-white/20"
              )}
            >
              {INDEX_LABEL[idx]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href={api.imageFileUrl(surveyId, activeBand.id)}
            className="text-white/70 hover:text-white"
            title="Download original file"
          >
            <Download size={18} />
          </a>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center px-4">
        <button
          onClick={() => onNavigate(Math.max(index - 1, 0))}
          disabled={index === 0}
          className="absolute left-4 text-white/70 hover:text-white disabled:opacity-20"
        >
          <ChevronLeft size={32} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={src} src={src} alt={activeBand.filename} className="max-h-[75vh] max-w-full object-contain rounded" />
        <button
          onClick={() => onNavigate(Math.min(index + 1, frames.length - 1))}
          disabled={index === frames.length - 1}
          className="absolute right-4 text-white/70 hover:text-white disabled:opacity-20"
        >
          <ChevronRight size={32} />
        </button>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 py-3 text-xs text-white/70">
        {meta.lat != null && meta.lon != null && (
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {meta.lat.toFixed(6)}, {meta.lon.toFixed(6)}
          </span>
        )}
        {meta.rtk_fix && (
          <span className={meta.rtk_fix === "FIXED" ? "text-healthy" : "text-attention"}>
            RTK {meta.rtk_fix}
            {meta.rtk_std_m != null && ` ±${(meta.rtk_std_m * 100).toFixed(0)} cm`}
          </span>
        )}
        {meta.rel_altitude_m != null && <span>AGL: {meta.rel_altitude_m.toFixed(1)} m</span>}
        {meta.gimbal_yaw_deg != null && <span>Yaw: {meta.gimbal_yaw_deg.toFixed(0)}°</span>}
        {meta.altitude_m != null && <span>Altitude: {meta.altitude_m.toFixed(1)} m</span>}
        {meta.captured_at && <span>Captured: {new Date(meta.captured_at).toLocaleString()}</span>}
        {activeBand.width && activeBand.height && (
          <span>
            {activeBand.width} × {activeBand.height}
          </span>
        )}
        <span>Bands: {bands.map((b) => BAND_LABEL[b] ?? b).join(", ")}</span>
        {hasStats && (
          <span className="text-white/90">
            {meta.ndvi_mean != null && `NDVI ${meta.ndvi_mean.toFixed(2)}`}
            {meta.ndre_mean != null && ` · NDRE ${meta.ndre_mean.toFixed(2)}`}
            {meta.gndvi_mean != null && ` · GNDVI ${meta.gndvi_mean.toFixed(2)}`}
            {meta.vegetation_fraction != null && ` · vegetation ${Math.round(meta.vegetation_fraction * 100)}%`}
          </span>
        )}
        {view.kind === "index" && (
          <span className="text-white/50">
            {INDEX_LABEL[view.index]} computed from the raw bands — uncalibrated, frame space (not a map)
          </span>
        )}
      </div>
    </div>
  );
}
