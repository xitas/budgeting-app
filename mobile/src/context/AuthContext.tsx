import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { AuthResponse, User } from "shared";
import * as authApi from "../features/auth/api";
import { refreshSession } from "../lib/apiClient";
import { clearTokens, setAccessToken, setRefreshToken } from "../lib/tokenStore";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  // Doesn't sign in: the code emailed by sign-up does (verifyEmail).
  signup: (email: string, password: string, name: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // App launch: trade the stored refresh token (if any) for a fresh session.
    refreshSession()
      .then((session) => setUser(session?.user ?? null))
      .finally(() => setIsLoading(false));
  }, []);

  async function startSession(res: AuthResponse): Promise<void> {
    setAccessToken(res.accessToken);
    await setRefreshToken(res.refreshToken ?? null);
    setUser(res.user);
  }

  async function login(email: string, password: string): Promise<void> {
    await startSession(await authApi.login(email, password));
  }

  async function signup(email: string, password: string, name: string): Promise<void> {
    await authApi.signup(email, password, name);
  }

  async function verifyEmail(email: string, code: string): Promise<void> {
    await startSession(await authApi.verifyEmail(email, code));
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // Offline or already expired — still log out locally.
    }
    await clearTokens();
    queryClient.clear();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, verifyEmail, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
