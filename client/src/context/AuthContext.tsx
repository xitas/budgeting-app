import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as authApi from "../features/auth/api";
import type { User } from "../features/auth/types";
import { setAccessToken } from "../lib/authToken";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // No access token exists yet on a fresh page load (it's memory-only).
    // This 401s, which triggers apiClient's silent-refresh interceptor using
    // the httpOnly refresh cookie — that's what actually restores the session.
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const res = await authApi.login(email, password);
    setAccessToken(res.accessToken);
    setUser(res.user);
  }

  async function signup(email: string, password: string, name: string): Promise<void> {
    const res = await authApi.signup(email, password, name);
    setAccessToken(res.accessToken);
    setUser(res.user);
  }

  async function logout(): Promise<void> {
    await authApi.logout();
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
