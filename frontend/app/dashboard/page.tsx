"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { FieldCard } from "@/components/dashboard/FieldCard";
import { useFieldAnalyses } from "@/lib/hooks/useFieldAnalyses";
import { DETECTION_TYPE_LABEL } from "@/lib/detectionTypes";
import { Sprout, Camera, Leaf, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { data: fields, isLoading, isError } = useQuery({
    queryKey: ["fields"],
    queryFn: api.listFields,
  });
  const { data: surveys } = useQuery({ queryKey: ["surveys"], queryFn: api.listSurveys });
  const { data: analyses } = useFieldAnalyses(fields);

  const totalFields = fields?.length ?? 0;
  const avgHealthy =
    fields && fields.length
      ? Math.round(
          fields.reduce((sum, f) => sum + (f.healthy_area_percent ?? 0), 0) / fields.length
        )
      : null;
  const attentionFields = fields?.filter((f) => (f.attention_area_percent ?? 0) >= 15).length ?? 0;
  const latestSurveyField = fields?.[0];

  const recentSurveys = [...(surveys ?? [])]
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 4);

  const problemAreas = (analyses ?? [])
    .flatMap(({ field, analysis }) =>
      (analysis?.detections ?? []).map((d) => ({ field, detection: d }))
    )
    .sort((a, b) => b.detection.confidence - a.detection.confidence)
    .slice(0, 5);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Good morning 👋</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Here&apos;s how your fields are doing.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard icon={Sprout} label="Total Fields" value={totalFields} />
          <SummaryCard
            icon={Camera}
            label="Latest Survey"
            value={latestSurveyField?.latest_survey_status ?? "—"}
          />
          <SummaryCard icon={Leaf} label="Avg. Healthy Area" value={avgHealthy != null ? `${avgHealthy}%` : "—"} />
          <SummaryCard icon={AlertTriangle} label="Needs Attention" value={attentionFields} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Your Fields</h2>
            <Link href="/fields" className="text-sm text-brand hover:underline">
              View all
            </Link>
          </div>

          {isLoading && <div className="text-sm text-muted-foreground">Loading fields…</div>}
          {isError && (
            <div className="text-sm text-problem">
              Could not reach the AgroTwin API. Is the backend running on port 8000?
            </div>
          )}
          {fields && fields.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No fields yet.{" "}
              <Link href="/upload" className="text-brand hover:underline">
                Create your first field
              </Link>
              .
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fields?.map((field) => (
              <FieldCard key={field.id} field={field} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Recent Surveys</h2>
              <Link href="/surveys" className="text-sm text-brand hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {recentSurveys.map((survey) => (
                <Link
                  key={survey.id}
                  href={`/surveys/${survey.id}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:border-brand/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand shrink-0">
                      <Camera size={15} />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{survey.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {survey.survey_date ? new Date(survey.survey_date).toLocaleDateString() : "—"} ·{" "}
                        {survey.frame_count} frames
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{survey.status}</span>
                </Link>
              ))}
              {recentSurveys.length === 0 && (
                <div className="text-sm text-muted-foreground">No surveys yet.</div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Problem Areas</h2>
              <Link href="/analysis" className="text-sm text-brand hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {problemAreas.map(({ field, detection }) => (
                <Link
                  key={detection.id}
                  href={`/fields/${field.id}/digital-twin`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 hover:border-brand/50"
                >
                  <div>
                    <div className="text-sm font-medium">{field.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {DETECTION_TYPE_LABEL[detection.type] ?? detection.type} · {detection.severity} severity
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {Math.round(detection.confidence * 100)}%
                    <ArrowRight size={13} />
                  </div>
                </Link>
              ))}
              {problemAreas.length === 0 && (
                <div className="text-sm text-muted-foreground">No problem areas flagged.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
        <Icon size={18} />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold leading-tight">{value}</div>
      </div>
    </div>
  );
}
