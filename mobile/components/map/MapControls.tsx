import { StyleSheet, View } from "react-native";
import { Layers, Maximize2, LocateFixed, Globe2, Map as MapIcon } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import { IconButton } from "@/components/ui";

interface MapControlsProps {
  onFitField: () => void;
  onToggleLayers: () => void;
  layersOpen: boolean;
  onToggleBase: () => void;
  baseIsSatellite: boolean;
  onLocate?: () => void;
  locating?: boolean;
  /** Offset from the top so the controls clear the header / safe area. */
  top: number;
}

/** Floating map controls (right edge). Icon-only, so every button is labelled for screen readers. */
export function MapControls({ onFitField, onToggleLayers, layersOpen, onToggleBase, baseIsSatellite, onLocate, locating, top }: MapControlsProps) {
  const iconColor = "#ffffff";
  return (
    <View style={[styles.stack, { top }]} pointerEvents="box-none">
      <IconButton overlay icon={<Maximize2 size={20} color={iconColor} />} accessibilityLabel="Fit map to field" onPress={onFitField} />
      <IconButton overlay selected={layersOpen} icon={<Layers size={20} color={iconColor} />} accessibilityLabel={layersOpen ? "Hide layer options" : "Show layer options"} onPress={onToggleLayers} />
      <IconButton
        overlay
        icon={baseIsSatellite ? <MapIcon size={20} color={iconColor} /> : <Globe2 size={20} color={iconColor} />}
        accessibilityLabel={baseIsSatellite ? "Switch to street map" : "Switch to satellite imagery"}
        onPress={onToggleBase}
      />
      {onLocate ? (
        <IconButton overlay disabled={locating} icon={<LocateFixed size={20} color={iconColor} />} accessibilityLabel="Show my location" onPress={onLocate} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { position: "absolute", right: spacing.md, gap: spacing.sm },
});
