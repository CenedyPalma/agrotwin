import type { Geometry } from "geojson";
import { Polygon } from "react-native-maps";
import { mapColors } from "@/constants/theme";
import { holesOf, ringsOf } from "@/utils/geo";

interface FieldBoundaryLayerProps {
  boundary: Geometry | null | undefined;
  visible?: boolean;
}

/** The field outline from GET /api/surveys/{id}/field-boundary. */
export function FieldBoundaryLayer({ boundary, visible = true }: FieldBoundaryLayerProps) {
  if (!visible || !boundary) return null;
  const rings = ringsOf(boundary);
  const holes = holesOf(boundary);
  return (
    <>
      {rings.map((ring, i) => (
        <Polygon
          key={`field-${i}`}
          coordinates={ring}
          holes={i === 0 ? holes : undefined}
          strokeColor={mapColors.fieldStroke}
          strokeWidth={3}
          fillColor={mapColors.fieldFill}
          zIndex={2}
          tappable={false}
        />
      ))}
    </>
  );
}
