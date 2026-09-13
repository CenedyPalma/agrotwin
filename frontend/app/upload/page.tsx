"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { ProcessingProgress } from "@/components/surveys/ProcessingProgress";
import { UploadCloud, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import type { ProcessingJob, ProcessingStep } from "@/lib/types";

const STEP_DEFS: { key: string; label: string }[] = [
  { key: "images_uploaded", label: "Images Uploaded" },
  { key: "metadata_extracted", label: "Metadata Extracted" },
  { key: "processing_field", label: "Processing Field" },
  { key: "generating_orthomosaic", label: "Generating Orthomosaic" },
  { key: "ai_analysis", label: "AI Analysis" },
  { key: "digital_twin_ready", label: "Digital Twin Ready" },
];

function freshSteps(): ProcessingStep[] {
  return STEP_DEFS.map((s) => ({ ...s, status: "pending" }));
}

export default function UploadPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: api.listFields });

  const [fieldId, setFieldId] = useState<string>("__new__");
  const [newFieldName, setNewFieldName] = useState("");
  const [surveyName, setSurveyName] = useState("");
  const [droneModel, setDroneModel] = useState("DJI Mavic 3 Multispectral (M3M)");
  const [files, setFiles] = useState<File[]>([]);
  const [job, setJob] = useState<ProcessingJob | null>(null);

  function advance(steps: ProcessingStep[], key: string, status: string) {
    const next = steps.map((s) => (s.key === key ? { ...s, status: "complete" as const } : s));
    setJob({ id: "local", survey_id: "", status, current_step: key, steps: next });
    return next;
  }

  const runUpload = useMutation({
    mutationFn: async () => {
      let steps = freshSteps();
      setJob({ id: "local", survey_id: "", status: "PENDING", current_step: steps[0].key, steps });

      let targetFieldId = fieldId;
      if (fieldId === "__new__") {
        if (!newFieldName.trim()) throw new Error("Enter a field name");
        const field = await api.createField(newFieldName.trim(), "soybean");
        targetFieldId = field.id;
      }

      const survey = await api.createSurvey(
        targetFieldId,
        surveyName.trim() || `Survey — ${new Date().toLocaleDateString()}`,
        droneModel
      );

      if (files.length) {
        await api.uploadSurveyImages(survey.id, files);
      }
      steps = advance(steps, "images_uploaded", "UPLOADING");

      steps = advance(steps, "metadata_extracted", "PROCESSING");
      steps = advance(steps, "processing_field", "PROCESSING");

      const finalJob = await api.triggerProcessing(survey.id);
      setJob(finalJob);

      qc.invalidateQueries({ queryKey: ["fields"] });
      return { fieldId: targetFieldId, surveyId: survey.id };
    },
    onSuccess: ({ fieldId }) => {
      setTimeout(() => router.push(`/fields/${fieldId}`), 900);
    },
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Upload Survey</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Create a field/survey and import drone imagery. Processed datasets (orthomosaic, NDVI,
            3D models) can be imported later from a survey&apos;s detail page.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Field</label>
            <select
              value={fieldId}
              onChange={(e) => setFieldId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="__new__">+ Create new field</option>
              {fields?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {fieldId === "__new__" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">New field name</label>
              <Input
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="Soybean Field B"
                className="mt-1"
                />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground">Survey name</label>
            <Input
              value={surveyName}
              onChange={(e) => setSurveyName(e.target.value)}
              placeholder="Survey — this flight"
              className="mt-1"
              />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Drone model</label>
            <Input
              value={droneModel}
              onChange={(e) => setDroneModel(e.target.value)}
              className="mt-1"
              />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Drone images (JPG)</label>
            <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-sm text-muted-foreground hover:border-brand/50">
              <UploadCloud size={22} />
              {files.length ? `${files.length} files selected` : "Click to select drone images"}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/tiff"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
          </div>

          <Button size="lg" className="w-full" onClick={() => runUpload.mutate()} disabled={runUpload.isPending}>
            {runUpload.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            {runUpload.isPending ? "Processing…" : "Create Survey"}
          </Button>

          {runUpload.isError && (
            <div className="text-sm text-problem">{(runUpload.error as Error).message}</div>
          )}
        </div>

        {job && <ProcessingProgress job={job} />}
      </div>
    </AppShell>
  );
}
