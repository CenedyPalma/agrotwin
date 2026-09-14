import { StyleSheet, View } from "react-native";
import { spacing } from "@/constants/theme";
import { METHOD_LABEL, METHOD_PLAIN } from "@/constants/labels";
import type { HealthShares } from "@/utils/health";
import { overallHealth } from "@/utils/health";
import { Card, HealthBar, HealthIndicator, HealthLegend, AppText } from "@/components/ui";

interface FieldHealthSummaryProps {
  shares: HealthShares | null;
  method?: string | null;
  isMock?: boolean | null;
  advanced?: boolean;
  title?: string;
}

/** Headline health + stacked bar + the three shares, with an honest note on how they were measured. */
export function FieldHealthSummary({ shares, method, isMock, advanced = false, title = "Field health" }: FieldHealthSummaryProps) {
  const health = overallHealth(shares);
  return (
    <Card>
      <AppText variant="label" tone="muted" style={styles.title}>
        {title}
      </AppText>
      <HealthIndicator tier={health.tier} label={health.label} size="lg" />
      {shares ? (
        <View style={styles.body}>
          <HealthBar shares={shares} height={14} />
          <HealthLegend shares={shares} />
          {method ? (
            <AppText variant="caption" tone="muted">
              {advanced ? METHOD_LABEL[method] ?? method : METHOD_PLAIN[method] ?? "Measured from this survey's imagery."}
            </AppText>
          ) : null}
          {isMock ? (
            <AppText variant="caption" tone="attention">
              ⚠ Demonstration data — not measured from real imagery.
            </AppText>
          ) : null}
        </View>
      ) : (
        <AppText variant="body" tone="muted" style={styles.body}>
          Health is shown once a survey of this field has been processed.
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.sm },
  body: { marginTop: spacing.lg, gap: spacing.md },
});
