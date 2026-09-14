import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import Constants from "expo-constants";
import { Wifi } from "lucide-react-native";
import { env, isValidHttpUrl } from "@/constants/config";
import { radius, spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useTestConnection } from "@/features/settings/hooks";
import { describeError } from "@/services/errors";
import { effectiveUrls, useSettingsStore, type ThemePreference } from "@/stores/settingsStore";
import { Button, Card, Chip, Disclosure, KeyValueRow, Screen, SectionHeader, StatusBadge, AppText } from "@/components/ui";

const THEMES: Array<{ key: ThemePreference; label: string }> = [
  { key: "system", label: "System" },
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
];

export default function SettingsScreen() {
  const { colors } = useTheme();
  const store = useSettingsStore();
  const urls = effectiveUrls(store);
  const [apiUrl, setApiUrl] = useState(store.apiUrl || env.apiUrl);
  const [webUrl, setWebUrl] = useState(store.webViewerUrl || env.webViewerUrl);
  const [saved, setSaved] = useState(false);
  const test = useTestConnection();

  const apiValid = apiUrl.trim() === "" || isValidHttpUrl(apiUrl);
  const webValid = webUrl.trim() === "" || isValidHttpUrl(webUrl);
  const localhost = /localhost|127\.0\.0\.1/i.test(`${apiUrl} ${webUrl}`);

  const save = () => {
    store.setApiUrl(apiUrl.trim() === env.apiUrl ? "" : apiUrl.trim());
    store.setWebViewerUrl(webUrl.trim() === env.webViewerUrl ? "" : webUrl.trim());
    setSaved(true);
    test.reset();
  };

  const resetToEnv = () => {
    store.resetServer();
    setApiUrl(env.apiUrl);
    setWebUrl(env.webViewerUrl);
    setSaved(true);
    test.reset();
  };

  const inputStyle = (valid: boolean) => [styles.input, { color: colors.text, backgroundColor: colors.surface2, borderColor: valid ? colors.border : colors.problem }];

  return (
    <Screen>
      <View>
        <SectionHeader title="AgroTwin server" subtitle="The computer running the backend and web app" />
        <Card>
          <AppText variant="caption" tone="muted">
            API address (FastAPI, port 8000)
          </AppText>
          <TextInput
            value={apiUrl}
            onChangeText={(t) => {
              setApiUrl(t);
              setSaved(false);
            }}
            placeholder="http://192.168.1.100:8000"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="API address"
            style={inputStyle(apiValid)}
          />
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.md }}>
            Web viewer address (Next.js, port 3000)
          </AppText>
          <TextInput
            value={webUrl}
            onChangeText={(t) => {
              setWebUrl(t);
              setSaved(false);
            }}
            placeholder="http://192.168.1.100:3000"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel="Web viewer address"
            style={inputStyle(webValid)}
          />
          {!apiValid || !webValid ? (
            <AppText variant="caption" tone="problem" style={{ marginTop: spacing.sm }}>
              Addresses must start with http:// or https://
            </AppText>
          ) : null}
          {localhost ? (
            <AppText variant="caption" tone="attention" style={{ marginTop: spacing.sm }}>
              ⚠ “localhost” only works in a web browser on the computer itself. On the Android emulator use 10.0.2.2; on a phone use the computer's Wi-Fi IP address.
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button label="Save" onPress={save} disabled={!apiValid || !webValid} />
            <Button label="Reset to defaults" variant="outline" onPress={resetToEnv} disabled={!store.apiUrl && !store.webViewerUrl} />
          </View>
          {saved ? (
            <AppText variant="caption" tone="healthy" style={{ marginTop: spacing.sm }}>
              Saved. Pull to refresh on any screen to reload data from the new server.
            </AppText>
          ) : null}
          <View style={[styles.actions, { marginTop: spacing.md }]}>
            <Button label="Test connection" variant="outline" icon={<Wifi size={16} color={colors.text} />} onPress={() => test.mutate()} loading={test.isPending} disabled={!urls.apiUrl} />
            {test.isSuccess ? <StatusBadge tier="healthy" label={`Connected · ${test.data.service}`} size="sm" showMarker={false} /> : null}
            {test.isError ? <StatusBadge tier="problem" label="Unreachable" size="sm" showMarker={false} /> : null}
          </View>
          {test.isError ? (
            <AppText variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
              {describeError(test.error).message}
            </AppText>
          ) : null}
        </Card>
      </View>

      <Disclosure title="How to find the right address" subtitle="Emulator vs. phone">
        <KeyValueRow label="Android Emulator" value="http://10.0.2.2:8000" mono />
        <KeyValueRow label="Physical phone" value="http://<laptop LAN IP>:8000" mono />
        <KeyValueRow label="Laptop LAN IP" value="ipconfig (Windows) / ip addr (Linux)" />
        <KeyValueRow label="Backend must listen on" value="0.0.0.0, not 127.0.0.1" last />
        <AppText variant="caption" tone="muted">
          Both devices need to be on the same Wi-Fi network and the laptop firewall must allow ports 8000 and 3000. Details in mobile/README.md.
        </AppText>
      </Disclosure>

      <View>
        <SectionHeader title="Appearance" />
        <Card>
          <AppText variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
            Theme
          </AppText>
          <View style={styles.chips}>
            {THEMES.map((t) => (
              <Chip key={t.key} label={t.label} selected={store.theme === t.key} onPress={() => store.setTheme(t.key)} />
            ))}
          </View>
          <AppText variant="caption" tone="muted" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
            Detail level
          </AppText>
          <View style={styles.chips}>
            <Chip label="Simple" selected={!store.advancedMode} onPress={() => store.setAdvancedMode(false)} />
            <Chip label="Advanced" selected={store.advancedMode} onPress={() => store.setAdvancedMode(true)} />
          </View>
        </Card>
      </View>

      <View>
        <SectionHeader title="About" />
        <Card>
          <KeyValueRow label="App version" value={Constants.expoConfig?.version ?? "dev"} />
          <KeyValueRow label="Environment" value={env.environment} />
          <KeyValueRow label="Built-in API address" value={env.apiUrl || "not set in .env"} mono />
          <KeyValueRow label="Built-in web address" value={env.webViewerUrl || "not set in .env"} mono last />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { height: 48, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 15, marginTop: spacing.xs },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg, alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
