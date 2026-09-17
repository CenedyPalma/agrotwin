import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { uploadBatchSize } from "@/constants/config";
import { assetsService, type ImportableAssetType } from "@/services/assets";
import { describeError } from "@/services/errors";
import { processingService } from "@/services/processing";
import { surveysService, type LocalFile } from "@/services/surveys";
import { queryKeys } from "../queryKeys";

export type UploadState = "IDLE" | "SELECTING" | "UPLOADING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface UploadProgress {
  state: UploadState;
  /** 0..1 across all batches. */
  fraction: number;
  uploadedFiles: number;
  totalFiles: number;
  currentBatch: number;
  totalBatches: number;
  error: string | null;
}

const initial: UploadProgress = { state: "IDLE", fraction: 0, uploadedFiles: 0, totalFiles: 0, currentBatch: 0, totalBatches: 0, error: null };

/**
 * Drives the mobile upload flow: images in small batches → (optionally) start
 * the backend pipeline. The phone never processes anything; it just moves
 * bytes to the FastAPI server, which does the work.
 */
export function useUploadFlow(surveyId: string | null) {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress>(initial);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(initial);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const uploadImages = useCallback(
    async (files: LocalFile[], startProcessing: boolean) => {
      if (!surveyId || files.length === 0) return false;
      const controller = new AbortController();
      abortRef.current = controller;
      const totalBatches = Math.ceil(files.length / uploadBatchSize);
      setProgress({ state: "UPLOADING", fraction: 0, uploadedFiles: 0, totalFiles: files.length, currentBatch: 1, totalBatches, error: null });

      try {
        for (let b = 0; b < totalBatches; b++) {
          const batch = files.slice(b * uploadBatchSize, (b + 1) * uploadBatchSize);
          await surveysService.uploadImages(surveyId, batch, {
            signal: controller.signal,
            onProgress: (f) =>
              setProgress((p) => ({
                ...p,
                currentBatch: b + 1,
                fraction: (b + f) / totalBatches,
                uploadedFiles: b * uploadBatchSize + Math.floor(f * batch.length),
              })),
          });
          setProgress((p) => ({ ...p, uploadedFiles: Math.min((b + 1) * uploadBatchSize, files.length), fraction: (b + 1) / totalBatches }));
        }
        qc.invalidateQueries({ queryKey: queryKeys.surveyImages(surveyId) });
        qc.invalidateQueries({ queryKey: queryKeys.survey(surveyId) });
        qc.invalidateQueries({ queryKey: queryKeys.surveys });

        if (startProcessing) {
          setProgress((p) => ({ ...p, state: "PROCESSING", fraction: 1 }));
          await processingService.triggerProcessing(surveyId);
          qc.invalidateQueries({ queryKey: queryKeys.job(surveyId) });
        } else {
          setProgress((p) => ({ ...p, state: "COMPLETED", fraction: 1 }));
        }
        return true;
      } catch (err) {
        const d = describeError(err);
        setProgress((p) => ({ ...p, state: "FAILED", error: `${d.title}. ${d.message}` }));
        return false;
      } finally {
        abortRef.current = null;
      }
    },
    [surveyId, qc]
  );

  const uploadAsset = useCallback(
    async (assetType: ImportableAssetType, file: LocalFile) => {
      if (!surveyId) return false;
      const controller = new AbortController();
      abortRef.current = controller;
      setProgress({ state: "UPLOADING", fraction: 0, uploadedFiles: 0, totalFiles: 1, currentBatch: 1, totalBatches: 1, error: null });
      try {
        await assetsService.upload(surveyId, assetType, file, {
          signal: controller.signal,
          onProgress: (f) => setProgress((p) => ({ ...p, fraction: f })),
        });
        qc.invalidateQueries({ queryKey: queryKeys.surveyAssets(surveyId) });
        qc.invalidateQueries({ queryKey: queryKeys.surveyAvailability(surveyId) });
        setProgress((p) => ({ ...p, state: "COMPLETED", fraction: 1, uploadedFiles: 1 }));
        return true;
      } catch (err) {
        const d = describeError(err);
        setProgress((p) => ({ ...p, state: "FAILED", error: `${d.title}. ${d.message}` }));
        return false;
      } finally {
        abortRef.current = null;
      }
    },
    [surveyId, qc]
  );

  return { progress, uploadImages, uploadAsset, cancel, reset };
}
