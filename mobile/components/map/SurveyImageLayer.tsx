import { useMemo } from "react";
import { Circle, Polyline } from "react-native-maps";
import { mapColors } from "@/constants/theme";
import type { SurveyImage } from "@/types";

interface SurveyImageLayerProps {
  images: SurveyImage[];
  visible?: boolean;
  /** Draw at most this many capture points (the flight path is always complete). */
  maxPoints?: number;
  highlightId?: string | null;
}

/**
 * Where the drone took its photos: the full flight path as a line plus a
 * subsample of capture points, so a 1,400-frame survey stays cheap to draw.
 */
export function SurveyImageLayer({ images, visible = true, maxPoints = 250, highlightId }: SurveyImageLayerProps) {
  const { path, points, highlight } = useMemo(() => {
    const located = images.filter((i) => i.lat != null && i.lon != null);
    // one point per frame (a multispectral frame is several files at the same spot)
    const seen = new Set<string>();
    const frames = located.filter((i) => {
      const k = i.frame_key ?? i.id;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const sorted = [...frames].sort((a, b) => (a.captured_at ?? "").localeCompare(b.captured_at ?? ""));
    const step = Math.max(1, Math.ceil(sorted.length / maxPoints));
    return {
      path: sorted.map((i) => ({ latitude: i.lat as number, longitude: i.lon as number })),
      points: sorted.filter((_, idx) => idx % step === 0),
      highlight: highlightId ? located.find((i) => i.id === highlightId) ?? null : null,
    };
  }, [images, maxPoints, highlightId]);

  if (!visible || path.length === 0) return null;
  return (
    <>
      <Polyline coordinates={path} strokeColor="rgba(59, 130, 246, 0.55)" strokeWidth={2} zIndex={3} />
      {points.map((img) => (
        <Circle
          key={img.id}
          center={{ latitude: img.lat as number, longitude: img.lon as number }}
          radius={1.2}
          strokeWidth={1}
          strokeColor={mapColors.imagePoint}
          fillColor={mapColors.imagePoint}
          zIndex={4}
        />
      ))}
      {highlight ? (
        <Circle
          center={{ latitude: highlight.lat as number, longitude: highlight.lon as number }}
          radius={4}
          strokeWidth={3}
          strokeColor="#ffffff"
          fillColor="rgba(59, 130, 246, 1)"
          zIndex={7}
        />
      ) : null}
    </>
  );
}
