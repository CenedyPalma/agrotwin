import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StyleSheet, TextInput, View } from "react-native";
import { typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { CROP_OPTIONS, newFieldSchema, type NewFieldForm as Values } from "@/features/upload/schemas";
import { cropLabel } from "@/utils/format";
import { Button, Chip, AppText } from "@/components/ui";

interface NewFieldFormProps {
  onSubmit: (values: Values) => Promise<void> | void;
  submitting?: boolean;
  error?: string | null;
}

/** Canvas "New field" form: name field, crop chips, primary submit. */
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
              placeholderTextColor={colors.muted}
              accessibilityLabel="Field name"
              style={[styles.input, typography.body, { color: colors.text, borderColor: fieldState.error ? colors.problem : colors.divider }]}
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
  form: { gap: 12 },
  field: { gap: 4 },
  input: { height: 48, borderWidth: 1, paddingHorizontal: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
