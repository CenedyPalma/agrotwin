import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { StateStorage } from "zustand/middleware";

/**
 * Zustand persistence backed by expo-secure-store (encrypted at rest on
 * device). Values kept here are small — preferences and, later, an auth
 * token. On web (expo start --web) it falls back to localStorage.
 */
export const secureStorage: StateStorage = {
  getItem: async (name) => {
    try {
      if (Platform.OS === "web") return globalThis.localStorage?.getItem(name) ?? null;
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      if (Platform.OS === "web") {
        globalThis.localStorage?.setItem(name, value);
        return;
      }
      await SecureStore.setItemAsync(name, value);
    } catch {
      // Persistence is best-effort; the in-memory state still works.
    }
  },
  removeItem: async (name) => {
    try {
      if (Platform.OS === "web") {
        globalThis.localStorage?.removeItem(name);
        return;
      }
      await SecureStore.deleteItemAsync(name);
    } catch {
      // ignore
    }
  },
};
