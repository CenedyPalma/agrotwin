import { StyleSheet, View } from "react-native";
import { detectionTypeLabel } from "@/constants/labels";
import { useTheme } from "@/hooks/useTheme";
import type { DetectionZone } from "@/types";
import { formatArea, formatPercent } from "@/utils/format";
import { BottomSheet, Button, AppText } from "@/components/ui";
import { PriorityBadge } from "@/components/analysis/PriorityBadge";

interface ZoneSheetProps {
  zone: DetectionZone | null;
  areaM2: number | null;
  /** Field area in hectares, for "Share of field". */
  fieldHectares: number | null;
  locationLabel: string | null;
  onClose: () => void;
  onViewDetails: () => void;
  onOpenTwin: () => void;
}

/** Canvas zone sheet: title + place, priority tag, Area / Share of field cells, Recommendation box, two buttons. */
export function ZoneSheet({ zone, areaM2, fieldHectares, locationLabel, onClose, onViewDetails, onOpenTwin }: ZoneSheetProps) {
  const { colors } = useTheme();
  const share = areaM2 != null && fieldHectares ? formatPercent((areaM2 / (fieldHectares * 10_000)) * 100) : "—";
  return (
    <BottomSheet
      visible={!!zone}
      onClose={onClose}
      accessibilityLabel={zone ? `${detectionTypeLabel(zone.type)} details` : "Zone details"}
      header={
        zone ? (
          <View style={styles.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="title" style={{ fontSize: 24, lineHeight: 26 }}>
                {detectionTypeLabel(zone.type)}
              </AppText>
              <AppText variant="caption" tone="muted" style={{ marginTop: 2 }}>
                {locationLabel ?? "Location not computed"}
              </AppText>
            </View>
            <PriorityBadge severity={zone.severity} short />
          </View>
        ) : null
      }
    >
      {zone ? (
        <>
          <View style={[styles.cells, { borderColor: colors.divider }]}>
            <View style={[styles.cell, { borderRightWidth: 1, borderRightColor: colors.divider }]}>
              <AppText variant="tagUpper" tone="muted">
                Area
              </AppText>
              <AppText variant="numberSm" tabular>
                ≈ {formatArea(areaM2)}
              </AppText>
            </View>
            <View style={styles.cell}>
              <AppText variant="tagUpper" tone="muted">
                Share of field
              </AppText>
              <AppText variant="numberSm" tabular>
                {share}
              </AppText>
            </View>
          </View>
          <View style={[styles.reco, { borderColor: colors.divider }]}>
            <AppText variant="kicker" tone="accent" style={{ marginBottom: 4 }}>
              Recommendation
            </AppText>
            <AppText variant="body">{zone.recommended_action}</AppText>
          </View>
          <View style={styles.actions}>
            <Button label="View details" minHeight={50} onPress={onViewDetails} style={{ flex: 1 }} />
            <Button label="Digital twin" variant="secondary" minHeight={50} onPress={onOpenTwin} style={{ flex: 1 }} />
          </View>
        </>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cells: { flexDirection: "row", borderWidth: 1, marginTop: 14 },
  cell: { flex: 1, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  reco: { borderWidth: 1, padding: 12, marginTop: 12 },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
});
