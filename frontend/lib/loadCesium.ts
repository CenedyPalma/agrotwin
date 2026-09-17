let cesiumPromise: Promise<typeof import("cesium")> | null = null;

/** Lazily imports CesiumJS in the browser, pointed at the static assets
 * copied to public/cesium by scripts/copy-cesium.mjs (no Cesium Ion token
 * anywhere). Cached so repeated mounts of CesiumViewer reuse one module. */
export function loadCesium(): Promise<typeof import("cesium")> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cesium can only be loaded in the browser"));
  }
  if (!cesiumPromise) {
    (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = "/cesium";
    cesiumPromise = import("cesium");
  }
  return cesiumPromise;
}
