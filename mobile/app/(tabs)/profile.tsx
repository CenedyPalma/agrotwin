import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Info, Settings, Upload, User, Wifi } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/providers/AuthProvider";
import { useTestConnection } from "@/features/settings/hooks";
import { effectiveUrls, useSettingsStore, type ThemePreference } from "@/stores/settingsStore";
import { Button, Card, Chip, KeyValueRow, Screen, SectionHeader, StatusBadge, AppText } from "@/components/ui";

const THEMES: Array<{ key: ThemePreference; label: string }> = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { userName } = useAuth();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const advanced = useSettingsStore((s) => s.advancedMode);
  const setAdvanced = useSettingsStore((s) => s.setAdvancedMode);
  const urls = useSettingsStore((s) => effectiveUrls(s));
  const test = useTestConnection();

  return (
    <Screen safeTop>
      <View style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: `${colors.brand}22` }]}>
          <User size={28} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="title">{userName ?? "Farmer"}</AppText>
          <AppText variant="caption" tone="muted">
            Local AgroTwin · no account needed yet
          </AppText>
        </View>
      </View>

      <View>
        <SectionHeader title="Server" actionLabel="Change" onAction={() => router.push("/settings")} />
        <Card>
          <KeyValueRow label="API" value={urls.apiUrl || "Not set"} mono />
          <KeyValueRow label="Web viewer" value={urls.webViewerUrl || "Not set"} mono last />
          <View style={styles.testRow}>
            <Button
              label="Test connection"
              variant="outline"
              size="sm"
              icon={<Wifi size={16} color={colors.text} />}
              onPress={() => test.mutate()}
              loading={test.isPending}
              disabled={!urls.apiUrl}
            />
            {test.isSuccess ? <StatusBadge tier="healthy" label="Connected" size="sm" showMarker={false} /> : null}
            {test.isError ? <StatusBadge tier="problem" label="Unreachable" size="sm" showMarker={false} /> : null}
          </View>
        </Card>
      </View>

      <View>
        <SectionHeader title="Appearance" />
        <Card>
          <AppText variant="caption" tone="muted" style={styles.label}>
            Theme
          </AppText>
          <View style={styles.chips}>
            {THEMES.map((t) => (
              <Chip key={t.key} label={t.label} selected={theme === t.key} onPress={() => setTheme(t.key)} />
            ))}
          </View>
          <AppText variant="caption" tone="muted" style={[styles.label, { marginTop: spacing.lg }]}>
            Detail level
          </AppText>
          <View style={styles.chips}>
            <Chip label="Simple" selected={!advanced} onPress={() => setAdvanced(false)} />
            <Chip label="Advanced" selected={advanced} onPress={() => setAdvanced(true)} />
          </View>
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            Advanced shows measurement methods, camera geometry and technical layer names by default.
          </AppText>
        </Card>
      </View>

      <View>
        <SectionHeader title="Shortcuts" />
        <View style={styles.list}>
          <Button label="Upload a survey" variant="outline" icon={<Upload size={18} color={colors.text} />} onPress={() => router.push("/upload")} fullWidth />
          <Button label="Settings" variant="outline" icon={<Settings size={18} color={colors.text} />} onPress={() => router.push("/settings")} fullWidth />
        </View>
      </View>

      <View>
        <SectionHeader title="About" />
        <Card>
          <View style={styles.aboutRow}>
            <Info size={16} color={colors.textMuted} />
            <AppText variant="caption" tone="muted" style={{ flex: 1 }}>
              AgroTwin Mobile {Constants.expoConfig?.version ?? ""} — a farmer-friendly view of the same data as the AgroTwin web app. Analysis runs on your computer; this app only displays results.
            </AppText>
          </View>
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            Accounts, farms and sign-in will arrive with the multi-user version. Nothing is sent to the cloud.
          </AppText>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  testRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.md, flexWrap: "wrap" },
  label: { marginBottom: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  list: { gap: spacing.sm },
  aboutRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
});
