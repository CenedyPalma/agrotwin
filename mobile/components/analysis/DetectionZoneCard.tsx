import { StyleSheet, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { DETECTION_TYPE_DESCRIPTION, detectionTypeLabel, METHOD_LABEL, severityTier } from "@/constants/labels";
import { iconStroke } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { DetectionZone } from "@/types";
import { formatArea } from "@/utils/format";
import { Blueprint, Button, Disclosure, IconBox, AppText } from "@/components/ui";
import { PriorityBadge } from "./PriorityBadge";

interface AttentionRowProps {
  zone: DetectionZone;
  locationLabel?: string | null;
  areaM2?: number | null;
  fieldName?: string | null;
  onViewOnMap: () => void;
}

/** Canvas Home "Needs your attention" row: 38 px warning box, title, "place · area · field", priority tag + "View on map". */
export function AttentionRow({ zone, locationLabel, areaM2, fieldName, onViewOnMap }: AttentionRowProps) {
  const { colors } = useTheme();
  const color = colors[severityTier(zone.severity)];
  const meta = [locationLabel, areaM2 != null ? formatArea(areaM2) : null, fieldName].filter(Boolean).join(" · ");
  return (
    <Blueprint padding={14} style={styles.attentionRow} accessibilityLabel={`${detectionTypeLabel(zone.type)}, ${meta}, ${zone.severity} priority`}>
      <IconBox size={38}>
        <AlertTriangle size={20} color={color} strokeWidth={iconStroke} />
      </IconBox>
      <View style={styles.flex}>
        <AppText variant="heading">{detectionTypeLabel(zone.type)}</AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {meta}
        </AppText>
        <View style={styles.attentionActions}>
          <PriorityBadge severity={zone.severity} />
          <Button label="View on map" variant="secondary" minHeight={40} onPress={onViewOnMap} style={{ marginLeft: "auto" }} />
        </View>
      </View>
    </Blueprint>
  );
}

interface DetectionZoneCardProps {
  zone: DetectionZone;
  locationLabel?: string | null;
  areaM2?: number | null;
  method?: string | null;
  onViewOnMap: () => void;
  onOpenTwin?: () => void;
  advanced?: boolean;
}

/**
 * Canvas analysis zone card: 21 px title, "place · area", priority tag,
 * plain-language sentence, "What to do" box, primary/secondary buttons and
 * a ghost "Show advanced details" disclosure with the measured facts.
 */
export function DetectionZoneCard({ zone, locationLabel, areaM2, method, onViewOnMap, onOpenTwin, advanced = false }: DetectionZoneCardProps) {
  const { colors } = useTheme();
  const vertices = zone.geometry.type === "Polygon" ? (zone.geometry.coordinates[0]?.length ?? 0) : null;
  return (
    <Blueprint accessibilityLabel={`${detectionTypeLabel(zone.type)}${locationLabel ? `, ${locationLabel}` : ""}, ${zone.severity} priority`}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="cardTitle">{detectionTypeLabel(zone.type)}</AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {[locationLabel, areaM2 != null ? formatArea(areaM2) : null].filter(Boolean).join(" · ") || "Location not computed"}
          </AppText>
        </View>
        <PriorityBadge severity={zone.severity} short />
      </View>
      <AppText variant="bodySm" tone="soft" style={{ marginTop: 10 }}>
        {DETECTION_TYPE_DESCRIPTION[zone.type] ?? "This area measured differently from the rest of the field."}
      </AppText>
      <View style={[styles.action, { borderColor: colors.divider }]}>
        <AppText variant="kicker" tone="accent" style={{ marginBottom: 4 }}>
          What to do
        </AppText>
        <AppText variant="bodySm">{zone.recommended_action}</AppText>
      </View>
      <View style={styles.buttons}>
        <Button label="View on map" minHeight={46} onPress={onViewOnMap} style={styles.flex} />
        {onOpenTwin ? <Button label="In digital twin" variant="secondary" minHeight={46} onPress={onOpenTwin} style={styles.flex} /> : null}
      </View>
      <Disclosure defaultOpen={advanced}>
        <AppText variant="small" tone="muted" tabular>
          Method · {method ? (METHOD_LABEL[method] ?? method) : "unknown"} · confidence {zone.confidence.toFixed(2)}
        </AppText>
        <AppText variant="small" tone="muted" tabular>
          Zone id · {zone.id}
          {vertices != null ? ` · polygon ${vertices} vertices` : ""}
        </AppText>
        <AppText variant="small" tone="muted" tabular>
          Type · {zone.type} · severity {zone.severity}
        </AppText>
      </Disclosure>
    </Blueprint>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  attentionRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  attentionActions: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  action: { borderWidth: 1, padding: 11, marginTop: 12 },
  buttons: { flexDirection: "row", gap: 8, marginTop: 12 },
});
