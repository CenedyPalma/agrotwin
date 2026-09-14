import { Tabs } from "expo-router";
import { Camera, Home, User, Wheat } from "lucide-react-native";
import { useTheme } from "@/hooks/useTheme";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600", paddingBottom: 6 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Home color={color} size={size} />, tabBarAccessibilityLabel: "Home" }} />
      <Tabs.Screen name="fields" options={{ title: "Fields", tabBarIcon: ({ color, size }) => <Wheat color={color} size={size} />, tabBarAccessibilityLabel: "Fields" }} />
      <Tabs.Screen name="surveys" options={{ title: "Surveys", tabBarIcon: ({ color, size }) => <Camera color={color} size={size} />, tabBarAccessibilityLabel: "Surveys" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <User color={color} size={size} />, tabBarAccessibilityLabel: "Profile" }} />
    </Tabs>
  );
}
