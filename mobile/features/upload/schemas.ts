import { z } from "zod";

export const CROP_OPTIONS = ["soybean", "corn", "wheat", "cotton", "rice", "other"] as const;

export const newFieldSchema = z.object({
  name: z.string().trim().min(2, "Give the field a name (at least 2 characters)").max(80, "Keep the name under 80 characters"),
  crop_type: z.string().trim().min(1, "Choose a crop"),
});
export type NewFieldForm = z.infer<typeof newFieldSchema>;

export const newSurveySchema = z.object({
  field_id: z.string().min(1, "Choose a field"),
  name: z.string().trim().min(2, "Give the survey a name").max(120, "Keep the name under 120 characters"),
  drone_model: z.string().trim().max(80).optional().or(z.literal("")),
});
export type NewSurveyForm = z.infer<typeof newSurveySchema>;
