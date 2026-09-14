import { StyleSheet, View } from "react-native";
import { spacing, radius, status } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useMapLayerStore, type MapLayerKey } from "@/stores/mapLayerStore";
import { Chip, AppText } from "@/components/ui";
import type { RasterLayerKey, RasterSource } from "./mapLayers";

interface LayerControlProps {
  rasters: Partial<Record<RasterLayerKey, RasterSource>>;
  hasZones: boolean;
  hasImages: boolean;
  hasBoundary: boolean;
}

/** Simple layers first, advanced ones behind a toggle — same philosophy as the web viewer. */
export function LayerControl({ rasters, hasZones, hasImages, hasBoundary }: LayerControlProps) {
  const { colors } = useTheme();
  const layers = useMapLayerStore((s) => s.layers);
  const toggle = useMapLayerStore((s) => s.toggleLayer);
  const showAdvanced = useMapLayerStore((s) => s.showAdvanced);
  const setShowAdvanced = useMapLayerStore((s) => s.setShowAdvanced);

  const chip = (key: MapLayerKey, label: string, enabled: boolean, color?: string) => (
    <Chip key={key} label={label} selected={layers[key] && enabled} disabled={!enabled} onPress={() => toggle(key)} color={color} />
  );

  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityLabel="Map layers">
      <AppText variant="label" tone="muted">
        Layers
      </AppText>
      <View style={styles.chips}>
        {chip("field", "Field", hasBoundary)}
        {chip("zones", "Needs attention", hasZones, status.attention)}
        {chip("orthomosaic", "Field photo map", !!rasters.orthomosaic)}
      </View>

      <View style={styles.advancedHeader}>
        <AppText variant="label" tone="muted">
          Advanced layers
        </AppText>
        <Chip label={showAdvanced ? "Hide" : "Show"} selected={showAdvanced} onPress={() => setShowAdvanced(!showAdvanced)} />
      </View>
      {showAdvanced ? (
        <View style={styles.chips}>
          {chip("imagePoints", "Survey coverage (GPS)", hasImages, status.info)}
          {chip("ndvi", "NDVI", !!rasters.ndvi)}
          {chip("ndre", "NDRE", !!rasters.ndre)}
          {chip("gndvi", "GNDVI", !!rasters.gndvi)}
          {chip("dsm", "Elevation (DSM)", !!rasters.dsm)}
        </View>
      ) : null}
      {!rasters.orthomosaic ? (
        <AppText variant="caption" tone="muted">
          No field photo map yet — run processing or import an orthomosaic from the survey page.
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.md },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  advancedHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
});
