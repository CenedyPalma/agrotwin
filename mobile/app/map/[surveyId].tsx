import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { ArrowLeft } from "lucide-react-native";
import { spacing, radius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useField } from "@/features/fields/hooks";
import { useFieldBoundary, useSurvey, useSurveyAssets, useSurveyImages } from "@/features/surveys/hooks";
import { useAnalysis } from "@/features/analysis/hooks";
import { enrichZones } from "@/features/analysis/zones";
import { useMapLayerStore } from "@/stores/mapLayerStore";
import { useUiStore } from "@/stores/uiStore";
import type { DetectionZone } from "@/types";
import { ErrorState, IconButton, LoadingState, Screen, AppText } from "@/components/ui";
import { LayerControl, MapControls, MapViewer, ZoneDetails, type MapViewerHandle } from "@/components/map";

export default function FieldMapScreen() {
  const { surveyId, zone: zoneParam, image: imageParam } = useLocalSearchParams<{ surveyId: string; zone?: string; image?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const setActiveSurvey = useUiStore((s) => s.setActiveSurvey);
  const baseLayer = useMapLayerStore((s) => s.baseLayer);
  const setBaseLayer = useMapLayerStore((s) => s.setBaseLayer);

  const mapRef = useRef<MapViewerHandle>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(zoneParam ?? null);
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const survey = useSurvey(surveyId);
  const field = useField(survey.data?.field_id);
  const boundary = useFieldBoundary(surveyId);
  const analysis = useAnalysis(surveyId);
  const images = useSurveyImages(surveyId);
  const assets = useSurveyAssets(surveyId);

  useEffect(() => {
    if (surveyId) setActiveSurvey(surveyId);
  }, [surveyId, setActiveSurvey]);

  const zones = useMemo(() => analysis.data?.detections ?? [], [analysis.data]);
  const zoneViews = useMemo(
    () =>
      enrichZones(zones, {
        center: boundary.data?.center_lat != null && boundary.data.center_lon != null ? { latitude: boundary.data.center_lat, longitude: boundary.data.center_lon } : null,
        boundary: boundary.data?.boundary ?? null,
      }),
    [zones, boundary.data]
  );
  const selected = zoneViews.find((v) => v.zone.id === selectedId) ?? null;

  // Focus the zone requested by the route once the map exists.
  useEffect(() => {
    if (mapReady && selected?.bbox) mapRef.current?.focusOn(selected.bbox);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, selectedId]);

  // Focus a photo position requested by the gallery.
  useEffect(() => {
    if (!mapReady || !imageParam) return;
    const img = images.data?.find((i) => i.id === imageParam);
    if (img?.lat != null && img.lon != null) mapRef.current?.focusOn({ latitude: img.lat, longitude: img.lon });
  }, [mapReady, imageParam, images.data]);

  const onSelectZone = useCallback((z: DetectionZone | null) => {
    setSelectedId(z?.id ?? null);
    if (z) setLayersOpen(false);
  }, []);

  const locate = useCallback(async () => {
    setLocating(true);
    setLocationNote(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocationNote("Location permission was not granted.");
        return;
      }
      setUserLocation(true);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.focusOn({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      setLocationNote("Could not read your position. Is GPS on?");
    } finally {
      setLocating(false);
    }
  }, []);

  const loading = survey.isPending || boundary.isPending || analysis.isPending || assets.isPending;
  const fatal = survey.isError ? survey.error : boundary.isError ? boundary.error : null;

  const header = (
    <View style={[styles.topBar, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      <IconButton overlay icon={<ArrowLeft size={20} color="#fff" />} accessibilityLabel="Go back" onPress={() => router.back()} />
      <View style={styles.titlePill}>
        <AppText variant="bodyStrong" style={styles.titleText} numberOfLines={1}>
          {field.data?.name ?? "Field map"}
        </AppText>
        {survey.data ? (
          <AppText variant="caption" style={styles.subtitleText} numberOfLines={1}>
            {survey.data.name}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  if (loading) {
    return (
      <Screen scroll={false} safeTop>
        <LoadingState message="Loading field map…" />
      </Screen>
    );
  }
  if (fatal) {
    return (
      <Screen scroll={false} safeTop>
        <ErrorState error={fatal} onRetry={() => (survey.isError ? survey.refetch() : boundary.refetch())} />
      </Screen>
    );
  }

  const hasBoundary = !!boundary.data?.boundary;
  const imageList = images.data ?? [];
  const noGeometry = !hasBoundary && zones.length === 0 && imageList.every((i) => i.lat == null) && !(assets.data ?? []).some((a) => a.bounds_geojson);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {noGeometry ? (
        <Screen scroll={false} safeTop>
          <ErrorState
            error={new Error("no geometry")}
            title="Nothing to show on the map yet"
            onRetry={() => {
              boundary.refetch();
              images.refetch();
            }}
          />
          <AppText variant="body" tone="muted" style={{ textAlign: "center", paddingHorizontal: spacing.xl }}>
            This survey has no field boundary, GPS photo positions or georeferenced map yet. Run processing from the survey page.
          </AppText>
        </Screen>
      ) : (
        <MapViewer
          ref={mapRef}
          boundary={boundary.data?.boundary}
          zones={zones}
          images={imageList}
          assets={assets.data}
          selectedZoneId={selectedId}
          onSelectZone={onSelectZone}
          highlightImageId={imageParam ?? null}
          showsUserLocation={userLocation}
          onMapReady={() => setMapReady(true)}
          edgePadding={{ top: insets.top + 90, right: 70, bottom: insets.bottom + 120, left: 30 }}
        />
      )}

      {header}
      <MapControls
        top={insets.top + 70}
        onFitField={() => mapRef.current?.fitToField()}
        onToggleLayers={() => setLayersOpen((v) => !v)}
        layersOpen={layersOpen}
        onToggleBase={() => setBaseLayer(baseLayer === "standard" ? "hybrid" : "standard")}
        baseIsSatellite={baseLayer !== "standard"}
        onLocate={locate}
        locating={locating}
      />

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.md }]} pointerEvents="box-none">
        {locationNote ? (
          <View style={styles.note}>
            <AppText variant="caption" style={styles.titleText}>
              {locationNote}
            </AppText>
          </View>
        ) : null}
        {analysis.isError ? (
          <View style={styles.note}>
            <AppText variant="caption" style={styles.titleText}>
              Attention zones could not be loaded.
            </AppText>
          </View>
        ) : null}
        {layersOpen ? (
          <LayerControl
            rasters={{}}
            hasZones={zones.length > 0}
            hasImages={imageList.some((i) => i.lat != null)}
            hasBoundary={hasBoundary}
          />
        ) : null}
        {selected ? (
          <ZoneDetails
            zone={selected.zone}
            areaM2={selected.areaM2}
            locationLabel={selected.locationLabel}
            onClose={() => setSelectedId(null)}
            onViewDetails={() => surveyId && router.push({ pathname: "/analysis/[surveyId]", params: { surveyId } })}
            onOpenTwin={() => surveyId && router.push({ pathname: "/twin/[surveyId]", params: { surveyId, zone: selected.zone.id } })}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { position: "absolute", left: spacing.md, right: 76, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  titlePill: { flex: 1, backgroundColor: "rgba(11, 15, 12, 0.72)", borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  titleText: { color: "#fff" },
  subtitleText: { color: "rgba(255,255,255,0.75)" },
  bottom: { position: "absolute", left: spacing.md, right: spacing.md, bottom: 0, gap: spacing.sm },
  note: { backgroundColor: "rgba(11, 15, 12, 0.8)", borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignSelf: "center" },
});
