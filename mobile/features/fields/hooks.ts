import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fieldsService } from "@/services/fields";
import type { FieldCreate } from "@/types";
import { queryKeys } from "../queryKeys";

export function useFields() {
  return useQuery({ queryKey: queryKeys.fields, queryFn: fieldsService.list });
}

export function useField(fieldId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.field(fieldId ?? ""),
    queryFn: () => fieldsService.get(fieldId as string),
    enabled: !!fieldId,
  });
}

/** Surveys of one field, newest first. */
export function useFieldSurveys(fieldId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.fieldSurveys(fieldId ?? ""),
    queryFn: () => fieldsService.listSurveys(fieldId as string),
    enabled: !!fieldId,
    select: (surveys) =>
      [...surveys].sort((a, b) => (b.survey_date ?? b.created_at).localeCompare(a.survey_date ?? a.created_at)),
  });
}

export function useCreateField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FieldCreate) => fieldsService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fields }),
  });
}
