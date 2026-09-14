import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Images } from "lucide-react-native";
import { galleryPageSize } from "@/constants/config";
import { BAND_LABEL } from "@/constants/labels";
import { spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useSurvey, useSurveyImages } from "@/features/surveys/hooks";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { surveysService } from "@/services/surveys";
import type { SurveyImage } from "@/types";
import { formatNumber } from "@/utils/format";
import { Button, Chip, EmptyState, ErrorState, LoadingState, Screen, AppText } from "@/components/ui";
import { ImageTile } from "@/components/gallery/ImageTile";
import { ImageViewerModal } from "@/components/gallery/ImageViewerModal";

const COLUMNS = 3;

export default function GalleryScreen() {
  const { surveyId, frame } = useLocalSearchParams<{ surveyId: string; frame?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const advanced = useSettingsStore((s) => s.advancedMode);
  const setActiveSurvey = useUiStore((s) => s.setActiveSurvey);

  const survey = useSurvey(surveyId);
  const images = useSurveyImages(surveyId);
  const [band, setBand] = useState<string>("RGB");
  const [pages, setPages] = useState(1);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    if (surveyId) setActiveSurvey(surveyId);
  }, [surveyId, setActiveSurvey]);

  const bands = useMemo(() => {
    const set = new Set((images.data ?? []).map((i) => i.band));
    return ["RGB", "GREEN", "RED", "RED_EDGE", "NIR", "THERMAL"].filter((b) => set.has(b));
  }, [images.data]);
  const effectiveBand = bands.includes(band) ? band : (bands[0] ?? "RGB");

  /** One entry per shutter release for the chosen band, oldest first (mirrors the web app's frame grouping). */
  const list = useMemo(() => {
    const all = images.data ?? [];
    const filtered = all.filter((i) => i.band === effectiveBand);
    return [...filtered].sort((a, b) => (a.captured_at ?? "").localeCompare(b.captured_at ?? "") || a.filename.localeCompare(b.filename));
  }, [images.data, effectiveBand]);
  const visible = useMemo(() => list.slice(0, pages * galleryPageSize), [list, pages]);

  // Deep link: /gallery/<id>?frame=<frame_key> opens that frame.
  useEffect(() => {
    if (!frame || list.length === 0) return;
    const i = list.findIndex((img) => (img.frame_key ?? img.id) === frame);
    if (i >= 0) {
      setPages(Math.ceil((i + 1) / galleryPageSize));
      setViewerIndex(i);
    }
  }, [frame, list]);

  const tileSize = Math.floor((width - spacing.lg * 2 - spacing.sm * (COLUMNS - 1)) / COLUMNS);
  const thumbUrl = useCallback((img: SurveyImage) => surveysService.thumbnailUrl(img.survey_id, img.id), []);
  const displayUrl = useCallback((img: SurveyImage) => surveysService.displayUrl(img.survey_id, img.id), []);
  const title = survey.data ? `${formatNumber(list.length)} images` : "Drone images";

  if (images.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <LoadingState message="Loading image list…" />
      </Screen>
    );
  }
  if (images.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ErrorState error={images.error} onRetry={() => images.refetch()} />
      </Screen>
    );
  }
  if ((images.data ?? []).length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <EmptyState icon={<Images size={28} color={colors.brand} />} title="No images in this survey" message="Upload drone images from the Upload screen or the web app." actionLabel="Upload" onAction={() => router.push({ pathname: "/upload", params: { surveyId } })} />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ title }} />
      <FlatList
        data={visible}
        keyExtractor={(i) => i.id}
        numColumns={COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="caption" tone="muted">
              {survey.data?.name} · thumbnails load as you scroll
            </AppText>
            {bands.length > 1 ? (
              <View style={styles.bands}>
                {bands.map((b) => (
                  <Chip key={b} label={BAND_LABEL[b] ?? b} selected={effectiveBand === b} onPress={() => { setBand(b); setPages(1); }} />
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => <ImageTile image={item} index={index} size={tileSize} thumbnailUrl={thumbUrl(item)} onPress={() => setViewerIndex(index)} />}
        onEndReached={() => visible.length < list.length && setPages((p) => p + 1)}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          visible.length < list.length ? (
            <View style={styles.footer}>
              <AppText variant="caption" tone="muted">
                Showing {formatNumber(visible.length)} of {formatNumber(list.length)}
              </AppText>
              <Button label="Load more" variant="outline" size="sm" onPress={() => setPages((p) => p + 1)} />
            </View>
          ) : (
            <View style={styles.footer}>
              <AppText variant="caption" tone="muted">
                All {formatNumber(list.length)} images listed
              </AppText>
            </View>
          )
        }
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        windowSize={7}
        removeClippedSubviews
      />
      <ImageViewerModal
        images={list}
        index={viewerIndex}
        displayUrl={displayUrl}
        onClose={() => setViewerIndex(null)}
        onChangeIndex={setViewerIndex}
        advanced={advanced}
        onViewOnMap={(img) => {
          setViewerIndex(null);
          router.push({ pathname: "/map/[surveyId]", params: { surveyId: img.survey_id, image: img.id } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  row: { gap: spacing.sm, marginBottom: spacing.sm },
  header: { gap: spacing.sm, paddingVertical: spacing.md },
  bands: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  footer: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
});
