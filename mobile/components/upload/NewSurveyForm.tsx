import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StyleSheet, TextInput, View } from "react-native";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { newSurveySchema, type NewSurveyForm as Values } from "@/features/upload/schemas";
import { formatDate } from "@/utils/format";
import { Button, AppText } from "@/components/ui";

interface NewSurveyFormProps {
  fieldId: string;
  onSubmit: (values: Values) => Promise<void> | void;
  submitting?: boolean;
  error?: string | null;
}

export function NewSurveyForm({ fieldId, onSubmit, submitting, error }: NewSurveyFormProps) {
  const { colors } = useTheme();
  const form = useForm<Values>({
    resolver: zodResolver(newSurveySchema),
    defaultValues: { field_id: fieldId, name: `Survey — ${formatDate(new Date().toISOString())}`, drone_model: "" },
  });

  const input = (fieldState: { error?: { message?: string } }) => [
    styles.input,
    { color: colors.text, backgroundColor: colors.surface2, borderColor: fieldState.error ? colors.problem : colors.border },
  ];

  return (
    <View style={styles.form}>
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <View style={styles.field}>
            <AppText variant="caption" tone="muted">
              Survey name
            </AppText>
            <TextInput value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} placeholderTextColor={colors.textMuted} accessibilityLabel="Survey name" style={input(fieldState)} />
            {fieldState.error ? (
              <AppText variant="caption" tone="problem">
                {fieldState.error.message}
              </AppText>
            ) : null}
          </View>
        )}
      />
      <Controller
        control={form.control}
        name="drone_model"
        render={({ field, fieldState }) => (
          <View style={styles.field}>
            <AppText variant="caption" tone="muted">
              Drone (optional)
            </AppText>
            <TextInput
              value={field.value ?? ""}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="e.g. DJI Mavic 3 Multispectral"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Drone model"
              style={input(fieldState)}
            />
          </View>
        )}
      />
      {error ? (
        <AppText variant="caption" tone="problem">
          {error}
        </AppText>
      ) : null}
      <Button label="Create survey" onPress={form.handleSubmit((v) => void onSubmit(v))} loading={submitting} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  input: { height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 15 },
});
