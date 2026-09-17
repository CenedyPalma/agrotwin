import { Polygon } from "react-native-maps";
import { severityTier } from "@/constants/labels";
import { mapColors } from "@/constants/theme";
import type { DetectionZone } from "@/types";
import { ringsOf } from "@/utils/geo";

interface DetectionZoneLayerProps {
  zones: DetectionZone[];
  visible?: boolean;
  selectedId?: string | null;
  onSelect?: (zone: DetectionZone) => void;
}

/** Flagged zones from the analysis, coloured by priority and tappable. */
export function DetectionZoneLayer({ zones, visible = true, selectedId, onSelect }: DetectionZoneLayerProps) {
  if (!visible) return null;
  return (
    <>
      {zones.flatMap((zone) =>
        ringsOf(zone.geometry).map((ring, i) => {
          const tier = severityTier(zone.severity);
          const selected = zone.id === selectedId;
          const c = mapColors.zone[tier];
          return (
            <Polygon
              key={`${zone.id}-${i}`}
              coordinates={ring}
              strokeColor={selected ? "#ffffff" : c.stroke}
              strokeWidth={selected ? 4 : 2}
              fillColor={c.fill}
              zIndex={selected ? 6 : 5}
              tappable
              onPress={() => onSelect?.(zone)}
            />
          );
        })
      )}
    </>
  );
}
