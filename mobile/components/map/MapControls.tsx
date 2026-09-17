import { StyleSheet, View } from "react-native";
import { Bot, Crosshair, Cuboid, Layers } from "lucide-react-native";
import { iconStroke, layout } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { IconButton } from "@/components/ui";

interface MapControlsProps {
  onLayers: () => void;
  onCentre: () => void;
  onTwin: () => void;
  onAi: () => void;
  layersOpen: boolean;
  /** Distance from the bottom edge (canvas: 26 px above the frame edge). */
  bottom: number;
}

/** Canvas map tool stack (bottom-right): Layers · Centre on field · Digital twin · Ask AI — 50 px raised squares. */
export function MapControls({ onLayers, onCentre, onTwin, onAi, layersOpen, bottom }: MapControlsProps) {
  const { colors } = useTheme();
  const c = colors.text;
  return (
    <View style={[styles.stack, { bottom }]} pointerEvents="box-none">
      <IconButton tone="raised" size={layout.tool} selected={layersOpen} icon={<Layers size={22} color={c} strokeWidth={iconStroke} />} accessibilityLabel="Layers" onPress={onLayers} />
      <IconButton tone="raised" size={layout.tool} icon={<Crosshair size={22} color={c} strokeWidth={iconStroke} />} accessibilityLabel="Centre on field" onPress={onCentre} />
      <IconButton tone="raised" size={layout.tool} icon={<Cuboid size={22} color={c} strokeWidth={iconStroke} />} accessibilityLabel="Digital twin" onPress={onTwin} />
      <IconButton tone="raised" size={layout.tool} icon={<Bot size={22} color={c} strokeWidth={iconStroke} />} accessibilityLabel="Ask AI" onPress={onAi} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { position: "absolute", right: 14, gap: 10 },
});
