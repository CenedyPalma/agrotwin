import { StyleSheet, View } from "react-native";
import { spacing } from "@/constants/theme";
import { BAND_LABEL } from "@/constants/labels";
import type { SurveyImage } from "@/types";
import { formatCoordinate, formatDateTime, formatMeters, formatPercent } from "@/utils/format";
import { Disclosure, KeyValueRow, AppText } from "@/components/ui";

interface ImageMetadataProps {
  image: SurveyImage;
  advanced?: boolean;
}

/** EXIF/XMP facts about a frame. Camera geometry and RTK details sit behind "Advanced details". */
export function ImageMetadata({ image, advanced = false }: ImageMetadataProps) {
  return (
    <View style={styles.wrap}>
      <AppText variant="heading" numberOfLines={1}>
        {image.filename}
      </AppText>
      <KeyValueRow label="Captured" value={formatDateTime(image.captured_at)} />
      <KeyValueRow label="GPS" value={formatCoordinate(image.lat, image.lon)} mono />
      <KeyValueRow label="Altitude (GPS)" value={formatMeters(image.altitude_m)} />
      <KeyValueRow label="Height above takeoff" value={formatMeters(image.rel_altitude_m)} />
      <KeyValueRow label="Band" value={BAND_LABEL[image.band] ?? image.band} />
      <KeyValueRow
        label="Vegetation cover"
        value={image.vegetation_fraction != null ? formatPercent(image.vegetation_fraction * 100) : "Not analysed"}
        last={!advanced}
      />
      <Disclosure title="Advanced details" subtitle="Camera geometry and positioning quality" defaultOpen={advanced}>
        <KeyValueRow label="Resolution" value={image.width && image.height ? `${image.width} × ${image.height}` : "—"} />
        <KeyValueRow label="Gimbal yaw" value={image.gimbal_yaw_deg != null ? `${image.gimbal_yaw_deg.toFixed(1)}°` : "—"} />
        <KeyValueRow label="Gimbal pitch" value={image.gimbal_pitch_deg != null ? `${image.gimbal_pitch_deg.toFixed(1)}°` : "—"} />
        <KeyValueRow label="RTK fix" value={image.rtk_fix ?? "—"} />
        <KeyValueRow label="RTK horizontal σ" value={image.rtk_std_m != null ? `${(image.rtk_std_m * 100).toFixed(1)} cm` : "—"} />
        <KeyValueRow label="NDVI mean" value={image.ndvi_mean != null ? image.ndvi_mean.toFixed(3) : "—"} />
        <KeyValueRow label="NDRE mean" value={image.ndre_mean != null ? image.ndre_mean.toFixed(3) : "—"} />
        <KeyValueRow label="GNDVI mean" value={image.gndvi_mean != null ? image.gndvi_mean.toFixed(3) : "—"} />
        <KeyValueRow label="Frame key" value={image.frame_key ?? image.id} mono last />
      </Disclosure>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { gap: spacing.xs } });
