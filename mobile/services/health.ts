import type { HealthResponse } from "@/types";
import { getJson } from "./apiClient";

export const healthService = {
  /** GET /api/health — used by Settings to test the connection. */
  ping: () => getJson<HealthResponse>("/api/health", { timeoutMs: 6000 }),
};
