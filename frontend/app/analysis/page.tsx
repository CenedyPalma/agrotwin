"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { MethodBadge, MockDataBadge } from "@/components/dashboard/StatusPill";
import { useFieldAnalyses } from "@/lib/hooks/useFieldAnalyses";
import { DETECTION_TYPE_LABEL } from "@/lib/detectionTypes";

const SEVERITY_COLOR: Record<string, string> = {
  low: "text-attention",
  medium: "text-attention",
  high: "text-problem",
};

export default function AnalysisPage() {
  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: api.listFields });
  const analyses = useFieldAnalyses(fields);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Analysis</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Vegetation coverage measured from each survey&apos;s own imagery — NDVI from the
            multispectral NIR/Red bands where they exist, an RGB vegetation index (Excess Green)
            otherwise. This measures live-vegetation coverage, not species or disease — no
            pesticide/disease recommendations are made, only ground-inspection guidance.
          </p>
        </div>

        <div className="space-y-4">
          {analyses.data?.map(({ field, analysis }) => (
            <div key={field.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between mb-3">
                <Link href={`/fields/${field.id}`} className="font-semibold hover:underline">
                  {field.name}
                </Link>
                <div className="flex items-center gap-2">
                  {analysis && <MethodBadge method={analysis.method} />}
                  {analysis?.is_mock && <MockDataBadge />}
                </div>
              </div>

              {!analysis && <div className="text-sm text-muted-foreground">No analysis available yet.</div>}

              {analysis && (
                <>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2 mb-3">
                    <div className="bg-healthy" style={{ width: `${analysis.analysis_summary.healthy_area_percent}%` }} />
                    <div className="bg-attention" style={{ width: `${analysis.analysis_summary.attention_area_percent}%` }} />
                    <div className="bg-problem" style={{ width: `${analysis.analysis_summary.problem_area_percent}%` }} />
                  </div>

                  <div className="space-y-2">
                    {analysis.detections.map((d) => (
                      <div key={d.id} className="flex items-center justify-between text-sm border-t border-border pt-2">
                        <span>{DETECTION_TYPE_LABEL[d.type] ?? d.type}</span>
                        <span className={`text-xs font-medium ${SEVERITY_COLOR[d.severity]}`}>
                          {d.severity} · {Math.round(d.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                    {analysis.detections.length === 0 && (
                      <div className="text-xs text-muted-foreground">No zones flagged.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {fields && fields.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No fields yet.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
