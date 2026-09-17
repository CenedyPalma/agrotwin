import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { env } from "@/constants/config";
import { setBaseUrls } from "@/services/runtimeConfig";
import { secureStorage } from "./secureStorage";

export type ThemePreference = "system" | "light" | "dark";

interface SettingsState {
  /** User override of EXPO_PUBLIC_API_URL; empty string means "use the .env value". */
  apiUrl: string;
  /** User override of EXPO_PUBLIC_WEB_VIEWER_URL. */
  webViewerUrl: string;
  theme: ThemePreference;
  /** Show technical details (methods, CRS-free metadata, model names) by default. */
  advancedMode: boolean;
  hasHydrated: boolean;

  setApiUrl: (url: string) => void;
  setWebViewerUrl: (url: string) => void;
  setTheme: (theme: ThemePreference) => void;
  setAdvancedMode: (on: boolean) => void;
  resetServer: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiUrl: "",
      webViewerUrl: "",
      theme: "system",
      advancedMode: false,
      hasHydrated: false,

      setApiUrl: (apiUrl) => set({ apiUrl: apiUrl.trim() }),
      setWebViewerUrl: (webViewerUrl) => set({ webViewerUrl: webViewerUrl.trim() }),
      setTheme: (theme) => set({ theme }),
      setAdvancedMode: (advancedMode) => set({ advancedMode }),
      resetServer: () => set({ apiUrl: "", webViewerUrl: "" }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: "agrotwin.settings",
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ apiUrl: s.apiUrl, webViewerUrl: s.webViewerUrl, theme: s.theme, advancedMode: s.advancedMode }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** The URLs actually in use (override → .env). */
export function effectiveUrls(state: Pick<SettingsState, "apiUrl" | "webViewerUrl">) {
  return {
    apiUrl: state.apiUrl || env.apiUrl,
    webViewerUrl: state.webViewerUrl || env.webViewerUrl,
    apiFromEnv: !state.apiUrl,
    webFromEnv: !state.webViewerUrl,
  };
}

// Keep the API client in sync with the persisted override (also runs after rehydration).
const pushUrls = (s: SettingsState) => setBaseUrls({ apiUrl: s.apiUrl, webViewerUrl: s.webViewerUrl });
pushUrls(useSettingsStore.getState());
useSettingsStore.subscribe(pushUrls);
