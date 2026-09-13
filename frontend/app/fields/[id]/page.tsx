"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { MockDataBadge } from "@/components/dashboard/StatusPill";
import { Globe2, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function FieldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: field } = useQuery({ queryKey: ["field", id], queryFn: () => api.getField(id) });
  const { data: surveys } = useQuery({
    queryKey: ["field-surveys", id],
    queryFn: () => api.listFieldSurveys(id),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{field?.crop_type}</div>
            <h1 className="text-xl sm:text-2xl font-semibold">{field?.name ?? "Loading…"}</h1>
            {field?.area_hectares != null && (
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{field.area_hectares} ha</p>
            )}
          </div>
          <Link
            href={`/fields/${id}/digital-twin`}
            className={buttonVariants({ size: "sm", className: "sm:h-10 sm:px-4 sm:py-2 text-xs sm:text-sm bg-brand hover:bg-brand/90 text-white w-full sm:w-auto" })}
          >
            <Globe2 size={16} /> Open Digital Twin
          </Link>
        </div>

        {field?.healthy_area_percent != null && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Field Health</h2>
              {field.analysis_is_mock && <MockDataBadge />}
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="bg-healthy" style={{ width: `${field.healthy_area_percent}%` }} />
              <div className="bg-attention" style={{ width: `${field.attention_area_percent}%` }} />
              <div className="bg-problem" style={{ width: `${field.problem_area_percent}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>🟢 {field.healthy_area_percent}% Healthy</span>
              <span>🟡 {field.attention_area_percent}% Needs Attention</span>
              <span>🔴 {field.problem_area_percent}% Problem</span>
            </div>
          </div>
        )}

        <div>
          <h2 className="font-semibold text-sm mb-3">Surveys</h2>
          <div className="space-y-2">
            {surveys?.map((survey) => (
              <Link
                key={survey.id}
                href={`/surveys/${survey.id}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:border-brand/50 transition-colors"
              >
                <div>
                  <div className="font-medium text-sm">{survey.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {survey.drone_model ?? "Unknown drone"} · {survey.frame_count} frames ·{" "}
                    {survey.status}
                  </div>
                </div>
                <ArrowRight size={16} className="text-muted-foreground" />
              </Link>
            ))}
            {surveys && surveys.length === 0 && (
              <div className="text-sm text-muted-foreground">No surveys yet for this field.</div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
