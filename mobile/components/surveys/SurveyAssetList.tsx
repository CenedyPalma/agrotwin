import { StyleSheet, View } from "react-native";
import { Check, Circle } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { SurveyAvailability } from "@/types";
import { Card, AppText } from "@/components/ui";

interface SurveyAssetListProps {
  availability: SurveyAvailability;
  hasAnalysis: boolean;
  advanced?: boolean;
}

interface Item {
  label: string;
  available: boolean;
  advancedOnly?: boolean;
  hint?: string;
}

/** "Available assets" checklist — mirrors the web app's AvailabilityChecklist. */
export function SurveyAssetList({ availability, hasAnalysis, advanced = false }: SurveyAssetListProps) {
  const { colors } = useTheme();
  const items: Item[] = [
    { label: "Drone images", available: availability.rgb_images },
    { label: "GPS positions", available: availability.gps_metadata },
    { label: "Field photo map (orthomosaic)", available: availability.orthomosaic },
    { label: "Health analysis", available: hasAnalysis },
    { label: "Attention zones", available: hasAnalysis },
    { label: "3D reconstruction", available: availability.model_3d },
    { label: "Point cloud", available: availability.pointcloud, advancedOnly: true },
    { label: "Elevation model (DSM)", available: availability.dsm, advancedOnly: true },
    { label: "Multispectral bands", available: availability.multispectral, advancedOnly: true },
    { label: "Thermal", available: availability.thermal, hint: availability.thermal ? undefined : "No thermal sensor data" },
    { label: "Imported boundaries", available: availability.vector_overlays, advancedOnly: true },
    { label: "PPK / RTK corrections", available: availability.gnss_ppk, advancedOnly: true },
  ];
  const visible = items.filter((i) => advanced || !i.advancedOnly);

  return (
    <Card>
      <AppText variant="label" tone="muted" style={styles.title}>
        Available assets
      </AppText>
      <View style={styles.list}>
        {visible.map((item) => (
          <View key={item.label} style={styles.row} accessibilityLabel={`${item.label}: ${item.available ? "available" : "not available"}`}>
            {item.available ? <Check size={18} color={colors.healthy} /> : <Circle size={16} color={colors.textMuted} />}
            <AppText variant="body" tone={item.available ? "default" : "muted"} style={styles.label}>
              {item.label}
            </AppText>
            {item.hint ? (
              <AppText variant="caption" tone="muted">
                {item.hint}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.sm },
  list: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 28 },
  label: { flex: 1 },
});
