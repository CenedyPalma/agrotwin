// Token-free satellite basemap with a per-tile fallback.
//
// Esri World Imagery is the best free aerial layer, but its tile server is
// unreachable from some networks (connection resets / TLS failures — seen
// through Cloudflare WARP and on mobile carriers). When a tile fails, the same
// tile is fetched from EOX's Sentinel-2 cloudless mosaic instead, so the
// globe never stays blank; after several consecutive failures Esri is skipped
// for a while so the view doesn't wait on timeouts for every tile.

export const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
export const EOX_S2_URL =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg";

// Both services stop at zoom 18 (~0.5 m/px here); the survey's own tile
// pyramids carry the detail beyond that.
const MAX_LEVEL = 18;
const SKIP_AFTER_FAILURES = 6;
const PROBE_EVERY = 25;

export function createBasemapProvider(Cesium: any) {
  const primary = new Cesium.UrlTemplateImageryProvider({
    url: ESRI_IMAGERY_URL,
    credit: "Esri, Maxar, Earthstar Geographics",
    maximumLevel: MAX_LEVEL,
  });
  const fallback = new Cesium.UrlTemplateImageryProvider({
    url: EOX_S2_URL,
    credit: "Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data)",
    maximumLevel: MAX_LEVEL,
  });

  const requestPrimary = primary.requestImage.bind(primary);
  let consecutiveFailures = 0;
  let skipped = 0;

  primary.requestImage = (x: number, y: number, level: number, request?: any) => {
    if (consecutiveFailures >= SKIP_AFTER_FAILURES && ++skipped % PROBE_EVERY !== 0) {
      return fallback.requestImage(x, y, level, request);
    }
    const attempt = requestPrimary(x, y, level, request);
    if (!attempt) return attempt; // throttled by Cesium's request scheduler — it will ask again
    return attempt.then(
      (image: unknown) => {
        consecutiveFailures = 0;
        return image;
      },
      () => {
        consecutiveFailures += 1;
        return fallback.requestImage(x, y, level);
      }
    );
  };
  return primary;
}

/** Resolves to `fallback` if `promise` hasn't settled within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}
