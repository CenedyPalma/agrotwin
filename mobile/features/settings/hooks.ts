import { useMutation } from "@tanstack/react-query";
import { healthService } from "@/services/health";

/** "Test connection" in Settings — pings GET /api/health with a short timeout. */
export function useTestConnection() {
  return useMutation({ mutationFn: () => healthService.ping() });
}
