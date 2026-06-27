import * as React from "react";
import {
  type CurrentUser,
  getMe,
  getStoredToken,
  loginRequest,
  logoutRequest,
  registerRequest,
  setStoredToken,
} from "@/lib/authApi";

interface AuthState {
  user: CurrentUser | null;
  ready: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, contact: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [ready, setReady] = React.useState(false);

  const refreshMe = React.useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const me = await getMe();
      if (me.loggedIn && me.user) {
        setUser(me.user);
      } else {
        setStoredToken(null);
        setUser(null);
      }
    } catch {
      setStoredToken(null);
      setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const login = React.useCallback(async (loginId: string, password: string) => {
    const r = await loginRequest(loginId, password);
    setStoredToken(r.token);
    setUser(r.user);
  }, []);

  const register = React.useCallback(async (username: string, contact: string, password: string) => {
    const r = await registerRequest(username, contact, password);
    setStoredToken(r.token);
    setUser(r.user);
  }, []);

  const logout = React.useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = React.useMemo<AuthState>(
    () => ({ user, ready, login, register, logout, refreshMe }),
    [user, ready, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
