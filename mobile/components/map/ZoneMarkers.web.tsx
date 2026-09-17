import type { ZoneView } from "@/features/analysis/zones";

/** Web stub — see MapViewer.web.tsx. Zone pins only make sense on the real map. */
interface ZoneMarkersProps {
  zones: ZoneView[];
  visible?: boolean;
  onPress: (zone: ZoneView) => void;
}

export function ZoneMarkers(_props: ZoneMarkersProps) {
  return null;
}
