// Jest setup: native modules that have no JS fallback are mocked here.
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    isAvailableAsync: jest.fn(async () => true),
  };
});

// Reanimated 4 ships a JS-only mock for tests (animations resolve immediately).
jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));
