import { Overlay, UrlTile } from "react-native-maps";
import { useTileMeta } from "@/features/surveys/hooks";
import type { RasterSource } from "./mapLayers";

interface OrthomosaicLayerProps {
  source: RasterSource | undefined;
  visible?: boolean;
  opacity?: number;
  zIndex?: number;
}

/**
 * Draws a georeferenced raster (orthomosaic, NDVI, …). Tile pyramids come
 * straight from the web app's static /tiles folder — the phone never
 * downloads the GeoTIFF. The flat preview PNG is only used when no pyramid
 * has been built for the asset.
 */
export function OrthomosaicLayer({ source, visible = true, opacity = 1, zIndex = 1 }: OrthomosaicLayerProps) {
  const meta = useTileMeta(source?.kind === "tiles" ? source.asset : null);
  if (!visible || !source) return null;

  if (source.kind === "tiles") {
    const format = meta.data?.format ?? "webp";
    const template = source.template.replace(/\.\w+$/, `.${format}`);
    return (
      <UrlTile
        urlTemplate={template}
        minimumZ={meta.data?.minzoom ?? 12}
        maximumZ={meta.data?.maxzoom ?? 22}
        maximumNativeZ={meta.data?.maxzoom ?? 22}
        tileSize={meta.data?.tile_size ?? 256}
        opacity={opacity}
        zIndex={zIndex}
        shouldReplaceMapContent={false}
        // Android's Google Maps tile overlay decodes WebP natively.
      />
    );
  }

  return (
    <Overlay
      image={{ uri: source.url }}
      bounds={[
        [source.bounds.south, source.bounds.west],
        [source.bounds.north, source.bounds.east],
      ]}
      opacity={opacity}
    />
  );
}
