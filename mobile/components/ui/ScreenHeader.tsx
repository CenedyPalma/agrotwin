import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { layout } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { IconButton } from "./IconButton";
import { AppText } from "./Text";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  right?: ReactNode;
}

/** In-page header from the canvas: 44 px square back button, 23 px condensed title, 12 px muted subtitle. */
export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/(tabs)")));
  return (
    <View style={styles.row}>
      <IconButton icon={<ArrowLeft size={20} color={colors.text} strokeWidth={1.6} />} accessibilityLabel="Back" onPress={back} />
      <View style={styles.titles}>
        <AppText variant="title" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: layout.headerPadding.top,
    paddingHorizontal: layout.headerPadding.horizontal,
    paddingBottom: layout.headerPadding.bottom,
  },
  titles: { flex: 1, minWidth: 0 },
});
