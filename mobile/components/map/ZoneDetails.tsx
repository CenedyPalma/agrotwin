import { StyleSheet, View } from "react-native";
import { X, Globe2, FileText } from "lucide-react-native";
import { radius, spacing, status } from "@/constants/theme";
import { detectionTypeLabel, severityTier, TIER_EMOJI } from "@/constants/labels";
import { useTheme } from "@/hooks/useTheme";
import type { DetectionZone } from "@/types";
import { formatArea, formatConfidence } from "@/utils/format";
import { Button, IconButton, AppText } from "@/components/ui";
import { PriorityBadge } from "@/components/analysis/PriorityBadge";

interface ZoneDetailsProps {
  zone: DetectionZone;
  areaM2: number | null;
  locationLabel: string | null;
  onClose: () => void;
  onViewDetails: () => void;
  onOpenTwin?: () => void;
}

/** Bottom card shown when a farmer taps a zone on the map. */
export function ZoneDetails({ zone, areaM2, locationLabel, onClose, onViewDetails, onOpenTwin }: ZoneDetailsProps) {
  const { colors } = useTheme();
  const tier = severityTier(zone.severity);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityViewIsModal>
      <View style={[styles.stripe, { backgroundColor: status[tier] }]} />
      <View style={styles.header}>
        <View style={styles.titles}>
          <AppText variant="heading">
            {TIER_EMOJI[tier]} {detectionTypeLabel(zone.type)}
          </AppText>
          {locationLabel ? (
            <AppText variant="caption" tone="muted">
              {locationLabel}
            </AppText>
          ) : null}
        </View>
        <IconButton icon={<X size={18} color={colors.text} />} accessibilityLabel="Close zone details" onPress={onClose} size={40} />
      </View>
      <View style={styles.facts}>
        <PriorityBadge severity={zone.severity} size="md" />
        <AppText variant="body" tone="muted">
          Area ≈ {formatArea(areaM2)}
        </AppText>
        <AppText variant="body" tone="muted">
          Confidence {formatConfidence(zone.confidence)}
        </AppText>
      </View>
      <View style={[styles.reco, { backgroundColor: colors.surface2 }]}>
        <AppText variant="caption" tone="muted">
          Recommendation
        </AppText>
        <AppText variant="bodyStrong">{zone.recommended_action}</AppText>
      </View>
      <View style={styles.actions}>
        <Button label="View details" variant="outline" icon={<FileText size={16} color={colors.text} />} onPress={onViewDetails} style={styles.action} />
        {onOpenTwin ? (
          <Button label="Open Digital Twin" icon={<Globe2 size={16} color={colors.onBrand} />} onPress={onOpenTwin} style={styles.action} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.md, overflow: "hidden" },
  stripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  titles: { flex: 1, gap: 2 },
  facts: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.md },
  reco: { padding: spacing.md, borderRadius: radius.md, gap: 2 },
  actions: { flexDirection: "row", gap: spacing.sm },
  action: { flex: 1 },
});
