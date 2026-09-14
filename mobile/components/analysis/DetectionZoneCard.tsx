import { StyleSheet, View } from "react-native";
import { MapPin } from "lucide-react-native";
import { spacing, status } from "@/constants/theme";
import { DETECTION_TYPE_DESCRIPTION, detectionTypeLabel, severityTier, TIER_EMOJI } from "@/constants/labels";
import { useTheme } from "@/hooks/useTheme";
import type { DetectionZone } from "@/types";
import { formatArea, formatConfidence } from "@/utils/format";
import { Button, Card, AppText } from "@/components/ui";
import { PriorityBadge } from "./PriorityBadge";

interface DetectionZoneCardProps {
  zone: DetectionZone;
  /** "North-West area" etc., computed relative to the field centre. */
  locationLabel?: string | null;
  areaM2?: number | null;
  onViewOnMap?: () => void;
  onPress?: () => void;
  advanced?: boolean;
  compact?: boolean;
}

/** One flagged zone in farmer language, with the safe recommended action. */
export function DetectionZoneCard({ zone, locationLabel, areaM2, onViewOnMap, onPress, advanced = false, compact = false }: DetectionZoneCardProps) {
  const { colors } = useTheme();
  const tier = severityTier(zone.severity);
  return (
    <Card onPress={onPress} accessibilityLabel={`${detectionTypeLabel(zone.type)}${locationLabel ? `, ${locationLabel}` : ""}, ${zone.severity} priority`}>
      <View style={styles.header}>
        <View style={[styles.stripe, { backgroundColor: status[tier] }]} />
        <View style={styles.titles}>
          <AppText variant="heading">
            {TIER_EMOJI[tier]} {detectionTypeLabel(zone.type)}
          </AppText>
          {locationLabel ? (
            <View style={styles.location}>
              <MapPin size={13} color={colors.textMuted} />
              <AppText variant="caption" tone="muted">
                {locationLabel}
              </AppText>
            </View>
          ) : null}
        </View>
        <PriorityBadge severity={zone.severity} />
      </View>

      {!compact ? (
        <AppText variant="body" tone="muted" style={styles.description}>
          {DETECTION_TYPE_DESCRIPTION[zone.type] ?? "This area measured differently from the rest of the field."}
        </AppText>
      ) : null}

      <View style={styles.facts}>
        <Fact label="Area" value={areaM2 != null ? `≈ ${formatArea(areaM2)}` : "—"} />
        <Fact label="Confidence" value={formatConfidence(zone.confidence)} />
        {advanced ? <Fact label="Type" value={zone.type} mono /> : null}
      </View>

      <View style={[styles.action, { backgroundColor: colors.surface2 }]}>
        <AppText variant="caption" tone="muted">
          Recommendation
        </AppText>
        <AppText variant="bodyStrong">{zone.recommended_action}</AppText>
      </View>

      {onViewOnMap ? <Button label="View on map" variant="outline" icon={<MapPin size={16} color={colors.text} />} onPress={onViewOnMap} style={styles.button} /> : null}
    </Card>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.fact}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <AppText variant="bodyStrong" style={mono ? { fontFamily: "monospace", fontSize: 13 } : undefined}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  stripe: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  titles: { flex: 1, gap: 2 },
  location: { flexDirection: "row", alignItems: "center", gap: 4 },
  description: { marginTop: spacing.md },
  facts: { flexDirection: "row", gap: spacing.xl, marginTop: spacing.md, flexWrap: "wrap" },
  fact: { gap: 2 },
  action: { marginTop: spacing.md, padding: spacing.md, borderRadius: 10, gap: 2 },
  button: { marginTop: spacing.md },
});
