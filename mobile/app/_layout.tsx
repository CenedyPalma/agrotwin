import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/hooks/useTheme";
import { AppProviders } from "@/providers/AppProviders";

function RootStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: "600" },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="field/[id]" options={{ title: "Field" }} />
        <Stack.Screen name="survey/[id]" options={{ title: "Survey" }} />
        <Stack.Screen name="analysis/[surveyId]" options={{ title: "Analysis" }} />
        <Stack.Screen name="gallery/[surveyId]" options={{ title: "Drone images" }} />
        <Stack.Screen name="map/[surveyId]" options={{ headerShown: false }} />
        <Stack.Screen name="twin/[surveyId]" options={{ headerShown: false }} />
        <Stack.Screen name="ai/chat" options={{ title: "Ask AgroTwin AI" }} />
        <Stack.Screen name="upload/index" options={{ title: "Upload" }} />
        <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
        <Stack.Screen name="+not-found" options={{ title: "Not found" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootStack />
    </AppProviders>
  );
}
