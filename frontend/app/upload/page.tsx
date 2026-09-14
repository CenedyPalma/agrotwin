"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, UPLOAD_BATCH_SIZE } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { UploadCloud, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: fields } = useQuery({ queryKey: ["fields"], queryFn: api.listFields });

  const [fieldId, setFieldId] = useState<string>("__new__");
  const [newFieldName, setNewFieldName] = useState("");
  const [surveyName, setSurveyName] = useState("");
  const [droneModel, setDroneModel] = useState("DJI Mavic 3 Multispectral (M3M)");
  const [files, setFiles] = useState<File[]>([]);
  const [uploaded, setUploaded] = useState(0);

  const totalBytes = files.reduce((n, f) => n + f.size, 0);

  const runUpload = useMutation({
    mutationFn: async () => {
      if (!files.length) throw new Error("Select the drone images first");
      setUploaded(0);

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

      // A whole flight is hundreds of files: send it in batches so each
      // request stays small and the progress bar means something.
      for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
        const batch = files.slice(i, i + UPLOAD_BATCH_SIZE);
        await api.uploadSurveyImages(survey.id, batch);
        setUploaded(Math.min(files.length, i + batch.length));
      }

      // Field boundary, quick mosaic and analysis run on the backend worker;
      // the survey page shows the live progress.
      await api.triggerProcessing(survey.id);
      qc.invalidateQueries({ queryKey: ["fields"] });
      qc.invalidateQueries({ queryKey: ["surveys"] });
      return survey.id;
    },
    onSuccess: (surveyId) => router.push(`/surveys/${surveyId}`),
  });

  const pct = files.length ? Math.round((100 * uploaded) / files.length) : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Upload Survey</h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            Create a field/survey and import drone imagery. Processed datasets (orthomosaic, NDVI,
            3D models, point clouds) can be imported later from the survey&apos;s page.
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
            <Input value={droneModel} onChange={(e) => setDroneModel(e.target.value)} className="mt-1" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Drone images (DJI JPG, multispectral TIF)</label>
            <label className="mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-8 text-center text-sm text-muted-foreground hover:border-brand/50">
              <UploadCloud size={22} />
              {files.length
                ? `${files.length} files selected · ${(totalBytes / 1024 / 1024).toFixed(0)} MB`
                : "Click to select drone images (you can select a whole flight folder's files)"}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/tiff,.tif,.tiff"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Files are sent in batches of {UPLOAD_BATCH_SIZE}; an interrupted upload can be resumed by uploading the
              same files again — already-received ones are skipped.
            </p>
          </div>

          <Button size="lg" className="w-full" onClick={() => runUpload.mutate()} disabled={runUpload.isPending}>
            {runUpload.isPending ? <Loader2 className="animate-spin" /> : <Check />}
            {runUpload.isPending
              ? uploaded < files.length
                ? `Uploading ${uploaded}/${files.length} (${pct}%)…`
                : "Starting processing…"
              : "Create Survey"}
          </Button>

          {runUpload.isPending && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}

          {runUpload.isError && (
            <div className="text-sm text-problem">{(runUpload.error as Error).message}</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
