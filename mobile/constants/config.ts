/**
 * Environment configuration. Expo inlines EXPO_PUBLIC_* variables at bundle
 * time, so they must be referenced literally (not via a computed key).
 *
 * Nothing here falls back to localhost: a phone cannot reach the laptop's
 * loopback interface. See mobile/README.md for the emulator (10.0.2.2) and
 * physical-device (LAN IP) values.
 */
export const env = {
  /** FastAPI base URL, e.g. http://192.168.1.50:8000 */
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? "").trim(),
  /** Next.js web app base URL (Cesium viewer + static tile pyramids), e.g. http://192.168.1.50:3000 */
  webViewerUrl: (process.env.EXPO_PUBLIC_WEB_VIEWER_URL ?? "").trim(),
  environment: (process.env.EXPO_PUBLIC_ENVIRONMENT ?? "development").trim(),
} as const;

/** Removes trailing slashes so paths can be appended with a single "/". */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function isValidHttpUrl(url: string): boolean {
  return /^https?:\/\/[^\s/]+(\/.*)?$/i.test(url.trim());
}

/** Request timeout for ordinary JSON calls. Uploads use uploadTimeoutMs. */
export const requestTimeoutMs = 15_000;
export const uploadTimeoutMs = 10 * 60_000;

/** Files per multipart request when uploading drone images (the web app uses 20; phones have less memory). */
export const uploadBatchSize = 10;

/** Above this many selected images the UI recommends uploading from the web app instead. */
export const mobileUploadSoftLimit = 60;

/** Poll interval for an active processing job (matches the web app's 2 s). */
export const jobPollIntervalMs = 2000;

/** Gallery page size — thumbnails are fetched lazily as the list scrolls. */
export const galleryPageSize = 60;
