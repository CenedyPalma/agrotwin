import { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, Wheat } from "lucide-react-native";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useRefresh } from "@/hooks/useRefresh";
import { useFields } from "@/features/fields/hooks";
import { useSurveys } from "@/features/surveys/hooks";
import { formatDate } from "@/utils/format";
import { EmptyState, ErrorState, LoadingState, Screen, AppText } from "@/components/ui";
import { FieldCard } from "@/components/fields/FieldCard";
import { AskAiFab } from "@/components/ai/AskAiFab";

export default function FieldsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const fields = useFields();
  const surveys = useSurveys();
  const { refreshing, onRefresh } = useRefresh(fields.refetch, surveys.refetch);

  const lastSurveyByField = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of surveys.data ?? []) if (!map.has(s.field_id)) map.set(s.field_id, s.survey_date ?? s.created_at);
    return map;
  }, [surveys.data]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = fields.data ?? [];
    return q ? list.filter((f) => f.name.toLowerCase().includes(q) || f.crop_type.toLowerCase().includes(q)) : list;
  }, [fields.data, query]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <AppText variant="display">My Fields</AppText>
      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search fields or crops"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
          accessibilityLabel="Search fields"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
    </View>
  );

  let body: React.ReactNode;
  if (fields.isPending) body = <LoadingState cards={3} />;
  else if (fields.isError) body = <ErrorState error={fields.error} onRetry={() => fields.refetch()} />;
  else if ((fields.data ?? []).length === 0)
    body = (
      <EmptyState
        icon={<Wheat size={28} color={colors.brand} />}
        title="You don't have any fields yet"
        message="Create your first field and upload a drone survey to start monitoring it."
        actionLabel="Create a field"
        onAction={() => router.push("/upload")}
      />
    );
  else if (visible.length === 0) body = <EmptyState compact title="No matching fields" message={`Nothing matches "${query}".`} />;

  return (
    <Screen scroll={false}>
      <FlatList
        data={body ? [] : visible}
        keyExtractor={(f) => f.id}
        ListHeaderComponent={header}
        ListEmptyComponent={body ? <View style={styles.body}>{body}</View> : null}
        renderItem={({ item }) => (
          <FieldCard
            field={item}
            lastSurveyLabel={lastSurveyByField.has(item.id) ? formatDate(lastSurveyByField.get(item.id)) : null}
            onPress={() => router.push({ pathname: "/field/[id]", params: { id: item.id } })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
        keyboardShouldPersistTaps="handled"
      />
      <AskAiFab />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md, marginBottom: spacing.lg },
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
  input: { flex: 1, fontSize: 15, height: "100%" },
  content: { paddingHorizontal: spacing.lg },
  body: { paddingTop: spacing.sm },
});
