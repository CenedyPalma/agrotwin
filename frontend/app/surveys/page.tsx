"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { Camera, ArrowRight } from "lucide-react";

export default function SurveysPage() {
  const { data: surveys, isLoading } = useQuery({ queryKey: ["surveys"], queryFn: api.listSurveys });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Surveys</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Drone survey flights across all fields.</p>
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        <div className="space-y-2">
          {surveys?.map((survey) => (
            <Link
              key={survey.id}
              href={`/surveys/${survey.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3 hover:border-brand/50 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand shrink-0">
                <Camera size={18} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">{survey.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {survey.drone_model ?? "Unknown drone"} · {survey.frame_count} frames
                </div>
              </div>
              <StatusBadge status={survey.status} />
              <ArrowRight size={16} className="text-muted-foreground" />
            </Link>
          ))}
          {surveys && surveys.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No surveys yet.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "COMPLETED" ? "text-healthy" : status === "FAILED" ? "text-problem" : "text-attention";
  return <span className={`text-xs font-medium ${color}`}>{status}</span>;
}
