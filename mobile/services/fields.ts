import type { FieldCreate, FieldOut, FieldSummary, Survey } from "@/types";
import { del, getJson, postJson } from "./apiClient";

/** GET/POST /api/fields — the same endpoints the web app uses (backend/app/routers/fields.py). */
export const fieldsService = {
  list: () => getJson<FieldSummary[]>("/api/fields"),
  get: (fieldId: string) => getJson<FieldSummary>(`/api/fields/${encodeURIComponent(fieldId)}`),
  listSurveys: (fieldId: string) => getJson<Survey[]>(`/api/fields/${encodeURIComponent(fieldId)}/surveys`),
  create: (payload: FieldCreate) => postJson<FieldOut>("/api/fields", payload),
  remove: (fieldId: string) => del<{ deleted: string }>(`/api/fields/${encodeURIComponent(fieldId)}`),
};
