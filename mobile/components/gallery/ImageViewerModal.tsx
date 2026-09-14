import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Info, MapPin, X } from "lucide-react-native";
import { spacing } from "@/constants/theme";
import type { SurveyImage } from "@/types";
import { IconButton, AppText, Button } from "@/components/ui";
import { ImageMetadata } from "./ImageMetadata";

interface ImageViewerModalProps {
  images: SurveyImage[];
  index: number | null;
  displayUrl: (image: SurveyImage) => string;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
  onViewOnMap?: (image: SurveyImage) => void;
  advanced?: boolean;
}

/** Fullscreen frame viewer with pinch-to-zoom, prev/next and a metadata sheet. */
export function ImageViewerModal({ images, index, displayUrl, onClose, onChangeIndex, onViewOnMap, advanced }: ImageViewerModalProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(true);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  useEffect(() => {
    reset();
    setLoading(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 6);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.02) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });
  const pan = Gesture.Pan()
    .minPointers(1)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : 2.5;
      scale.value = withTiming(next);
      savedScale.value = next;
      if (next === 1) {
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });
  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const image = index != null ? images[index] : undefined;
  const visible = index != null && !!image;
  const hasPrev = index != null && index > 0;
  const hasNext = index != null && index < images.length - 1;

  return (
    <Modal visible={visible} onRequestClose={onClose} animationType="fade" statusBarTranslucent presentationStyle="fullScreen">
      <View style={styles.root}>
        {image ? (
          <GestureDetector gesture={composed}>
            <Animated.View style={[styles.stage, animated]}>
              <Image
                source={{ uri: displayUrl(image) }}
                style={{ width, height: height - insets.top - insets.bottom }}
                contentFit="contain"
                cachePolicy="memory-disk"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                accessibilityLabel={`Drone image ${image.filename}`}
              />
            </Animated.View>
          </GestureDetector>
        ) : null}
        {loading ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : null}

        <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
          <IconButton overlay icon={<X size={20} color="#fff" />} accessibilityLabel="Close image" onPress={onClose} />
          <AppText variant="bodyStrong" style={styles.counter}>
            {index != null ? `${index + 1} / ${images.length}` : ""}
          </AppText>
          <IconButton overlay selected={showInfo} icon={<Info size={20} color="#fff" />} accessibilityLabel={showInfo ? "Hide image details" : "Show image details"} onPress={() => setShowInfo((v) => !v)} />
        </View>

        <View style={[styles.nav, { bottom: insets.bottom + spacing.lg }]}>
          <IconButton overlay disabled={!hasPrev} icon={<ChevronLeft size={22} color="#fff" />} accessibilityLabel="Previous image" onPress={() => index != null && onChangeIndex(index - 1)} />
          {image && onViewOnMap && image.lat != null ? (
            <Button label="View on map" variant="secondary" size="sm" icon={<MapPin size={16} color="#121813" />} onPress={() => onViewOnMap(image)} />
          ) : null}
          <IconButton overlay disabled={!hasNext} icon={<ChevronRight size={22} color="#fff" />} accessibilityLabel="Next image" onPress={() => index != null && onChangeIndex(index + 1)} />
        </View>

        {showInfo && image ? (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <ScrollView style={{ maxHeight: height * 0.5 }} contentContainerStyle={styles.sheetContent}>
              <ImageMetadata image={image} advanced={advanced} />
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  stage: { flex: 1, alignItems: "center", justifyContent: "center" },
  loading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  topBar: { position: "absolute", left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  counter: { color: "#fff" },
  nav: { position: "absolute", left: spacing.md, right: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#121812", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetContent: { padding: spacing.lg },
});
