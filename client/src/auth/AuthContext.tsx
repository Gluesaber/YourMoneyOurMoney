import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, onUnauthorized } from "../api/client.js";

export type Role = "USER" | "ADMIN";

// Same shape as GET /api/auth/me and the server's req.user.
export interface CurrentUser {
  id: number;
  username: string;
  role: Role;
}

export interface AuthState {
  user: CurrentUser | null;
  // True until the first GET /api/auth/me finishes, so route guards don't redirect too early.
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

// Exported so component tests can render with a fixed AuthState.
export const AuthContext = createContext<AuthState | null>(null);

// Integration point 10. Track A (S1-05, S1-08) owns the endpoints and the login/logout behaviour.
// Keep the useAuth() shape stable; Track B's pages depend on it.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onUnauthorized(() => {
      setUser(null);
    });
  }, []);

  useEffect(() => {
    api<CurrentUser>("/api/auth/me")
      .then(setUser)
      .catch((err) => {
        // 401 = not logged in. 404 = /api/auth/me does not exist yet (before S1-05 merges).
        if (!(err instanceof ApiError)) console.error(err);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const me = await api<CurrentUser>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(me);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api<void>("/api/auth/logout", { method: "POST" });
    } catch (err) {
      // F-01 §5: if the session already expired or the user was disabled (401), still clear local state.
      if (!(err instanceof ApiError)) console.error(err);
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>.");
  return ctx;
}

// Where each role lands after login or when it opens a page meant for the other role.
export function homePathFor(role: Role): string {
  return role === "ADMIN" ? "/admin/users" : "/dashboard";
}
