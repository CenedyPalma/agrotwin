"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { MethodBadge, MockDataBadge } from "@/components/dashboard/StatusPill";
import { Globe2, ArrowRight, Trash2, Loader2, UploadCloud, Pencil, Check, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CROP_TYPES = ["soybean", "corn", "wheat", "cotton", "rice", "sorghum", "canola", "sunflower", "potato", "other"];

export default function FieldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();

  const { data: field } = useQuery({ queryKey: ["field", id], queryFn: () => api.getField(id) });
  const { data: surveys } = useQuery({
    queryKey: ["field-surveys", id],
    queryFn: () => api.listFieldSurveys(id),
  });
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftCrop, setDraftCrop] = useState("soybean");
  const startEditing = () => {
    setDraftName(field?.name ?? "");
    setDraftCrop(field?.crop_type ?? "soybean");
    setEditing(true);
  };
  const save = useMutation({
    mutationFn: () => api.updateField(id, { name: draftName, crop_type: draftCrop }),
    onSuccess: (updated) => {
      qc.setQueryData(["field", id], updated);
      qc.invalidateQueries({ queryKey: ["fields"] });
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteField(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fields"] });
      qc.invalidateQueries({ queryKey: ["surveys"] });
      router.push("/fields");
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {editing ? (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
            >
              <div>
                <label className="text-xs font-medium text-muted-foreground">Field name</label>
                <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="mt-1 w-64" autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Crop</label>
                <select
                  value={CROP_TYPES.includes(draftCrop) ? draftCrop : "other"}
                  onChange={(e) => setDraftCrop(e.target.value)}
                  className="mt-1 block h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm outline-none focus:border-brand"
                >
                  {CROP_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm" disabled={save.isPending || !draftName.trim()}>
                {save.isPending ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Save
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
                <X size={14} /> Cancel
              </Button>
            </form>
          ) : (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{field?.crop_type}</div>
              <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-semibold">
                {field?.name ?? "Loading…"}
                {field && (
                  <button onClick={startEditing} className="text-muted-foreground hover:text-foreground" title="Rename field / set crop type">
                    <Pencil size={15} />
                  </button>
                )}
              </h1>
              {field?.area_hectares != null && (
                <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{field.area_hectares} ha</p>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/fields/${id}/digital-twin`}
              className={buttonVariants({ size: "sm", className: "sm:h-10 sm:px-4 sm:py-2 text-xs sm:text-sm bg-brand hover:bg-brand/90 text-white" })}
            >
              <Globe2 size={16} /> Open Digital Twin
            </Link>
            <Button
              variant="outline"
              size="sm"
              className="sm:h-10 sm:px-3 sm:py-2 text-xs sm:text-sm text-muted-foreground hover:text-problem"
              onClick={() => {
                if (window.confirm(`Delete "${field?.name}" and all of its surveys? Original drone files on disk are kept.`))
                  remove.mutate();
              }}
              disabled={remove.isPending}
              title="Delete this field"
            >
              {remove.isPending ? <Loader2 className="animate-spin" size={15} /> : <Trash2 size={15} />}
            </Button>
          </div>
        </div>
        {remove.isError && <div className="text-sm text-problem">{(remove.error as Error).message}</div>}
        {save.isError && <div className="text-sm text-problem">{(save.error as Error).message}</div>}

        {field?.healthy_area_percent != null && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Field Health</h2>
              <div className="flex items-center gap-2">
                <MethodBadge method={field.analysis_method} />
                {field.analysis_is_mock && <MockDataBadge />}
              </div>
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
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Surveys</h2>
            <Link href="/upload" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
              <UploadCloud size={13} /> New survey
            </Link>
          </div>
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
