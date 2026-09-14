import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { radius, spacing } from "@/constants/theme";
import { BAND_LABEL } from "@/constants/labels";
import { useTheme } from "@/hooks/useTheme";
import type { SurveyImage } from "@/types";
import { AppText } from "@/components/ui";

interface ImageTileProps {
  image: SurveyImage;
  index: number;
  size: number;
  thumbnailUrl: string;
  onPress: () => void;
}

/** One thumbnail in the gallery grid. Memoised: the grid can hold a thousand of these. */
export const ImageTile = memo(function ImageTile({ image, index, size, thumbnailUrl, onPress }: ImageTileProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Image ${index + 1}, ${image.filename}${image.lat != null ? ", has GPS" : ""}`}
      style={({ pressed }) => [styles.tile, { width: size, height: size, backgroundColor: colors.surface2 }, pressed && { opacity: 0.8 }]}
    >
      <Image
        source={{ uri: thumbnailUrl }}
        style={styles.image}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={image.id}
        transition={120}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.badge}>
        <AppText variant="caption" style={styles.badgeText}>
          {index + 1}
        </AppText>
      </View>
      {image.band !== "RGB" ? (
        <View style={[styles.badge, styles.bandBadge]}>
          <AppText variant="caption" style={styles.badgeText}>
            {BAND_LABEL[image.band] ?? image.band}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  tile: { borderRadius: radius.sm, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    left: spacing.xs,
    bottom: spacing.xs,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  bandBadge: { left: undefined, right: spacing.xs },
  badgeText: { color: "#fff", fontSize: 11, lineHeight: 14 },
});
