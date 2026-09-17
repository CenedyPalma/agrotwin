import { StyleSheet, View } from "react-native";
import { Marker } from "react-native-maps";
import { AlertTriangle } from "lucide-react-native";
import { detectionTypeLabel, severityTier } from "@/constants/labels";
import { useTheme } from "@/hooks/useTheme";
import type { ZoneView } from "@/features/analysis/zones";

interface ZoneMarkersProps {
  zones: ZoneView[];
  visible?: boolean;
  onPress: (zone: ZoneView) => void;
}

/** Canvas map pins: 48 px solid squares in the priority colour with a white border and warning icon. */
export function ZoneMarkers({ zones, visible = true, onPress }: ZoneMarkersProps) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <>
      {zones.map((v) =>
        v.centroid ? (
          <Marker
            key={`pin-${v.zone.id}`}
            coordinate={v.centroid}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => onPress(v)}
            tracksViewChanges={false}
            accessibilityLabel={`${detectionTypeLabel(v.zone.type)}, ${v.zone.severity} priority`}
            zIndex={8}
          >
            <View style={[styles.pin, { backgroundColor: colors[severityTier(v.zone.severity)] }]}>
              <AlertTriangle size={22} color="#ffffff" strokeWidth={1.8} />
            </View>
          </Marker>
        ) : null
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
