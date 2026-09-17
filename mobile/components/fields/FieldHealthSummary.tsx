import { StyleSheet, View } from "react-native";
import { METHOD_LABEL, METHOD_PLAIN } from "@/constants/labels";
import { useTheme } from "@/hooks/useTheme";
import { formatPercent } from "@/utils/format";
import type { HealthShares } from "@/utils/health";
import { overallHealth } from "@/utils/health";
import { Blueprint, HealthBar, HealthLegendColumns, Swatch, AppText } from "@/components/ui";

interface FieldHealthSummaryProps {
  shares: HealthShares | null;
  method?: string | null;
  isMock?: boolean | null;
  advanced?: boolean;
  processing?: boolean;
}

/**
 * Canvas "Health overview": accent kicker, 62 px healthy number beside the
 * status swatch + "of the surveyed area is healthy", 12 px bar, three
 * legend columns.
 */
export function FieldHealthSummary({ shares, method, isMock, advanced = false, processing = false }: FieldHealthSummaryProps) {
  const { colors } = useTheme();
  const health = overallHealth(shares);
  return (
    <Blueprint padding={18}>
      <AppText variant="kicker" tone="accent">
        Health overview
      </AppText>
      {shares ? (
        <>
          <View style={styles.hero}>
            <AppText variant="statXl" tabular>
              {formatPercent(shares.healthy)}
            </AppText>
            <View style={{ paddingBottom: 8, flexShrink: 1 }}>
              <View style={styles.statusRow}>
                <Swatch color={colors[health.tier]} />
                <AppText variant="bodyStrong" style={{ fontSize: 17 }}>
                  {health.label}
                </AppText>
              </View>
              <AppText variant="caption" tone="muted">
                of the surveyed area is healthy
              </AppText>
            </View>
          </View>
          <View style={{ marginTop: 16 }}>
            <HealthBar shares={shares} height={12} />
          </View>
          <View style={{ marginTop: 12 }}>
            <HealthLegendColumns shares={shares} />
          </View>
          {method ? (
            <AppText variant="small" tone="muted" style={{ marginTop: 12 }}>
              {advanced ? (METHOD_LABEL[method] ?? method) : (METHOD_PLAIN[method] ?? "Measured from this survey's imagery.")}
            </AppText>
          ) : null}
          {isMock ? (
            <AppText variant="small" tone="attention" style={{ marginTop: 4 }}>
              Demonstration data — not measured from real imagery.
            </AppText>
          ) : null}
        </>
      ) : (
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <View style={styles.statusRow}>
              <Swatch color={processing ? colors.accent : colors.neutral} />
              <AppText variant="bodyStrong" style={{ fontSize: 17 }}>
                {processing ? "Processing" : "Not analysed yet"}
              </AppText>
            </View>
            <AppText variant="caption" tone="muted">
              {processing ? "Health results appear here once processing finishes." : "Health is shown once a survey of this field has been processed."}
            </AppText>
          </View>
        </View>
      )}
    </Blueprint>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "flex-end", gap: 14, marginTop: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
