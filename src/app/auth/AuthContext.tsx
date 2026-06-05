import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authTokenStore } from "../api/client";
import { authService } from "../api/services";
import type { AuthUser } from "../api/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: {
    email: string;
    password: string;
    remember: boolean;
    otp_code?: string;
  }) => Promise<{ twoFactorRequired: boolean; emailHint?: string | null }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const authRequestVersionRef = useRef(0);

  const refreshUser = async () => {
    const token = authTokenStore.get();
    if (!token) {
      setUser(null);
      return;
    }

    const requestVersion = ++authRequestVersionRef.current;

    try {
      const me = await authService.me();
      if (authRequestVersionRef.current === requestVersion && authTokenStore.get() === token) {
        setUser(me);
      }
    } catch {
      if (authRequestVersionRef.current === requestVersion && authTokenStore.get() === token) {
        authTokenStore.clear();
        setUser(null);
      }
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await refreshUser();
      setLoading(false);
    };

    void load();
  }, []);

  const login = async (payload: {
    email: string;
    password: string;
    remember: boolean;
    otp_code?: string;
  }) => {
    authRequestVersionRef.current += 1;
    authTokenStore.clear();

    const loggedInUser = await authService.login(payload);

    if ("two_factor_required" in loggedInUser && loggedInUser.two_factor_required) {
      return {
        twoFactorRequired: true,
        emailHint: loggedInUser.email_hint,
      };
    }

    authTokenStore.set(loggedInUser.access_token);
    authRequestVersionRef.current += 1;
    setUser(loggedInUser.user);

    return {
      twoFactorRequired: false,
    };
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Local sign-out should always complete even if server token is already invalid.
    } finally {
      authRequestVersionRef.current += 1;
      authTokenStore.clear();
    }

    setUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      refreshUser,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
