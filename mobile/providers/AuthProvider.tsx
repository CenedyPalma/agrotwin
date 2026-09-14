import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useAuthStore } from "@/stores/authStore";

/**
 * Future-ready authentication context. The backend has no login flow yet,
 * so `isAuthenticated` is always true for the local MVP. When JWT auth is
 * added, `signIn` stores the token (SecureStore) and the API client starts
 * sending it — no screen needs to change.
 */
interface AuthContextValue {
  isAuthenticated: boolean;
  token: string | null;
  userName: string | null;
  signIn: (token: string, userName?: string | null) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const token = useAuthStore((s) => s.token);
  const userName = useAuthStore((s) => s.userName);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated: true, token, userName, signIn: setSession, signOut: clearSession }),
    [token, userName, setSession, clearSession]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
