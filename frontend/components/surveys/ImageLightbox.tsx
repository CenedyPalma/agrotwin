"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download, MapPin, Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { BAND_LABEL, BAND_ORDER, INDEX_LABEL, type Frame, type IndexKey } from "@/lib/frames";

type View = { kind: "band"; band: string } | { kind: "index"; index: IndexKey };

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;

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

  // zoom/pan state: scale about the image centre plus a translation, in CSS px
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (next: number) => {
      onNavigate(Math.max(0, Math.min(frames.length - 1, next)));
      resetZoom();
    },
    [frames.length, onNavigate, resetZoom]
  );

  const zoomTo = useCallback((factor: number, origin?: { x: number; y: number }) => {
    setZoom((z) => {
      const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z * factor));
      const ratio = next / z;
      // keep the point under the cursor fixed
      setPan((p) => (origin ? { x: origin.x - (origin.x - p.x) * ratio, y: origin.y - (origin.y - p.y) * ratio } : { x: p.x * ratio, y: p.y * ratio }));
      return next;
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else onClose();
      }
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
      if (e.key === "+" || e.key === "=") zoomTo(1.25);
      if (e.key === "-") zoomTo(0.8);
      if (e.key === "0") resetZoom();
      if (e.key.toLowerCase() === "f") toggleFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, zoomTo, resetZoom, onClose]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // wheel zoom must be a non-passive listener to stop the page scrolling
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const origin = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
      zoomTo(e.deltaY < 0 ? 1.2 : 1 / 1.2, origin);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  }

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
    <div ref={rootRef} className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm select-none">
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

        <div className="flex items-center gap-2 shrink-0 text-white/70">
          <button onClick={() => zoomTo(0.8)} className="hover:text-white" title="Zoom out (−)">
            <ZoomOut size={18} />
          </button>
          <button onClick={resetZoom} className="min-w-[3ch] text-xs tabular-nums hover:text-white" title="Reset zoom (0)">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => zoomTo(1.25)} className="hover:text-white" title="Zoom in (+)">
            <ZoomIn size={18} />
          </button>
          <button onClick={toggleFullscreen} className="hover:text-white" title="Fullscreen (F)">
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          <a href={api.imageFileUrl(surveyId, activeBand.id)} className="hover:text-white" title="Download original file">
            <Download size={18} />
          </a>
          <button onClick={onClose} className="hover:text-white" title="Close (Esc)">
            <X size={20} />
          </button>
        </div>
      </div>

      <div
        ref={stageRef}
        className={clsx("relative flex-1 overflow-hidden flex items-center justify-center px-4", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in")}
        onPointerDown={(e) => {
          if (zoom <= 1) return;
          dragging.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = dragging.current;
          if (!d) return;
          setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
        }}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
        onDoubleClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const origin = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
          if (zoom > 1) resetZoom();
          else zoomTo(3, origin);
        }}
      >
        <button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="absolute left-4 z-10 text-white/70 hover:text-white disabled:opacity-20"
        >
          <ChevronLeft size={32} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt={activeBand.filename}
          draggable={false}
          className="max-h-full max-w-full object-contain rounded"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: dragging.current ? "none" : "transform 80ms" }}
        />
        <button
          onClick={() => go(index + 1)}
          disabled={index === frames.length - 1}
          className="absolute right-4 z-10 text-white/70 hover:text-white disabled:opacity-20"
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
        {meta.gimbal_pitch_deg != null && <span>Pitch: {meta.gimbal_pitch_deg.toFixed(0)}°</span>}
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
        <span className="text-white/40 ml-auto hidden sm:inline">scroll to zoom · drag to pan · double-click · ← → · F</span>
      </div>
    </div>
  );
}
