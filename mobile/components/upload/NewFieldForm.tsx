import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StyleSheet, TextInput, View } from "react-native";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { CROP_OPTIONS, newFieldSchema, type NewFieldForm as Values } from "@/features/upload/schemas";
import { cropLabel } from "@/utils/format";
import { Button, Chip, AppText } from "@/components/ui";

interface NewFieldFormProps {
  onSubmit: (values: Values) => Promise<void> | void;
  submitting?: boolean;
  error?: string | null;
}

export function NewFieldForm({ onSubmit, submitting, error }: NewFieldFormProps) {
  const { colors } = useTheme();
  const form = useForm<Values>({ resolver: zodResolver(newFieldSchema), defaultValues: { name: "", crop_type: "soybean" } });

  return (
    <View style={styles.form}>
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <View style={styles.field}>
            <AppText variant="caption" tone="muted">
              Field name
            </AppText>
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="e.g. North Soybean Field"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Field name"
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface2, borderColor: fieldState.error ? colors.problem : colors.border }]}
            />
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
        name="crop_type"
        render={({ field }) => (
          <View style={styles.field}>
            <AppText variant="caption" tone="muted">
              Crop this season
            </AppText>
            <View style={styles.chips}>
              {CROP_OPTIONS.map((c) => (
                <Chip key={c} label={cropLabel(c)} selected={field.value === c} onPress={() => field.onChange(c)} />
              ))}
            </View>
          </View>
        )}
      />
      {error ? (
        <AppText variant="caption" tone="problem">
          {error}
        </AppText>
      ) : null}
      <Button label="Create field" onPress={form.handleSubmit((v) => void onSubmit(v))} loading={submitting} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  field: { gap: spacing.xs },
  input: { height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 15 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
