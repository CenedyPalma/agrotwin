import type { StatusTier } from "@/constants/theme";

export interface HealthShares {
  healthy: number;
  attention: number;
  problem: number;
}

export interface OverallHealth {
  tier: StatusTier;
  label: string;
}

/**
 * Summarises measured area shares into one farmer-facing headline. This is
 * a presentation rule only — the shares themselves always come from the
 * backend's analysis and are shown alongside the headline.
 *
 *   problem share ≥ 15 %              → Problem Areas Found
 *   healthy share ≥ 60 %              → Mostly Healthy
 *   otherwise                         → Needs Attention
 */
export function overallHealth(shares: HealthShares | null | undefined): OverallHealth {
  if (!shares) return { tier: "neutral", label: "Not analysed yet" };
  if (shares.problem >= 15) return { tier: "problem", label: "Problem Areas Found" };
  if (shares.healthy >= 60) return { tier: "healthy", label: "Mostly Healthy" };
  return { tier: "attention", label: "Needs Attention" };
}

/** Builds HealthShares from the nullable percentages a FieldSummary carries. */
export function sharesFromPercents(
  healthy: number | null | undefined,
  attention: number | null | undefined,
  problem: number | null | undefined
): HealthShares | null {
  if (healthy == null || attention == null || problem == null) return null;
  return { healthy, attention, problem };
}

/** Area-weighted average of several fields' shares (fields without analysis are skipped). */
export function aggregateShares(
  items: Array<{ shares: HealthShares | null; weight?: number | null }>
): HealthShares | null {
  let w = 0;
  const acc = { healthy: 0, attention: 0, problem: 0 };
  for (const item of items) {
    if (!item.shares) continue;
    const weight = item.weight && item.weight > 0 ? item.weight : 1;
    acc.healthy += item.shares.healthy * weight;
    acc.attention += item.shares.attention * weight;
    acc.problem += item.shares.problem * weight;
    w += weight;
  }
  if (w === 0) return null;
  return {
    healthy: round1(acc.healthy / w),
    attention: round1(acc.attention / w),
    problem: round1(acc.problem / w),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
