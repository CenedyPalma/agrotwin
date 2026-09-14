import { StyleSheet, View } from "react-native";
import { Box, Globe2, Map as MapIcon, Sparkles } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { SurveyAvailability } from "@/types";
import { Button, Card, StatusBadge, AppText } from "@/components/ui";
import type { SplatAvailability } from "@/features/digitalTwin/hooks";
import type { TwinMode } from "./digitalTwinBridge";

interface TwinStatusCardProps {
  availability: SurveyAvailability | undefined;
  hasImages: boolean;
  splat: SplatAvailability | undefined;
  processing: boolean;
  onOpen: (mode: TwinMode) => void;
  disabled?: boolean;
}

/** Availability of the three Digital Twin modes, with honest "not built yet" states. */
export function TwinStatusCard({ availability, hasImages, splat, processing, onOpen, disabled }: TwinStatusCardProps) {
  const { colors } = useTheme();
  const fieldMapOk = !!availability?.orthomosaic || hasImages;
  const meshOk = !!availability?.model_3d || !!availability?.dsm || !!availability?.pointcloud;

  return (
    <Card>
      <View style={styles.header}>
        <Globe2 size={20} color={colors.brand} />
        <AppText variant="heading">Digital Twin</AppText>
      </View>
      <AppText variant="caption" tone="muted">
        Opens the same 3D viewer as the AgroTwin web app, streamed from your computer.
      </AppText>

      <Row
        icon={<MapIcon size={18} color={colors.text} />}
        title="Field Map"
        description={fieldMapOk ? "Photo map, health zones and photo positions on 3D terrain." : "Needs drone images or an orthomosaic."}
        status={fieldMapOk ? { tier: "healthy", label: "✓ Available" } : { tier: "neutral", label: "○ Not available" }}
        onOpen={fieldMapOk && !disabled ? () => onOpen("field-map") : undefined}
      />
      <Row
        icon={<Box size={18} color={colors.text} />}
        title="3D Twin"
        description={
          meshOk
            ? "Reality mesh, elevation or point cloud from this survey."
            : processing
              ? "Terrain view is ready; survey products are still processing."
              : "Terrain view only — no reconstruction of this survey has been built (GPU pipeline)."
        }
        status={meshOk ? { tier: "healthy", label: "✓ Available" } : processing ? { tier: "info", label: "⏳ Processing" } : { tier: "attention", label: "Terrain only" }}
        onOpen={!disabled ? () => onOpen("3d-twin") : undefined}
      />
      <Row
        icon={<Sparkles size={18} color={colors.text} />}
        title="Photorealistic"
        description={
          splat === "available"
            ? "Gaussian-splat reconstruction built from this survey's frames."
            : splat === "missing"
              ? "No photorealistic reconstruction exists yet. It is built on the AgroTwin computer's GPU (hours)."
              : "Could not check for a reconstruction — is the web app reachable?"
        }
        status={
          splat === "available"
            ? { tier: "healthy", label: "✓ Available" }
            : splat === "missing"
              ? { tier: "neutral", label: "○ Not available" }
              : { tier: "info", label: "? Unknown" }
        }
        onOpen={splat === "available" && !disabled ? () => onOpen("photorealistic") : undefined}
        last
      />
    </Card>
  );
}

function Row({
  icon,
  title,
  description,
  status,
  onOpen,
  last = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: { tier: "healthy" | "attention" | "problem" | "info" | "neutral"; label: string };
  onOpen?: () => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.rowHeader}>
        {icon}
        <AppText variant="bodyStrong" style={styles.rowTitle}>
          {title}
        </AppText>
        <StatusBadge tier={status.tier} label={status.label} size="sm" showMarker={false} />
      </View>
      <AppText variant="caption" tone="muted">
        {description}
      </AppText>
      {onOpen ? <Button label={`Open ${title}`} variant="outline" size="sm" onPress={onOpen} style={styles.open} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  row: { paddingVertical: spacing.md, gap: spacing.xs },
  rowHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowTitle: { flex: 1 },
  open: { alignSelf: "flex-start", marginTop: spacing.xs },
});
