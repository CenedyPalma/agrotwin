import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { setAuthTokenGetter } from "@/services/runtimeConfig";
import { secureStorage } from "./secureStorage";

/**
 * Authentication is not part of the local MVP (the backend has no login
 * flow yet). This store is the extension point: when JWT auth lands, the
 * token saved here is sent as `Authorization: Bearer …` by the API client.
 */
interface AuthState {
  token: string | null;
  userName: string | null;
  setSession: (token: string, userName?: string | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      userName: null,
      setSession: (token, userName = null) => set({ token, userName }),
      clearSession: () => set({ token: null, userName: null }),
    }),
    { name: "agrotwin.auth", storage: createJSONStorage(() => secureStorage) }
  )
);

setAuthTokenGetter(() => useAuthStore.getState().token);
