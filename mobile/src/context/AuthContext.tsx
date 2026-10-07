import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
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
  // For responses that carry new tokens (e.g. after a password change).
  applyAuth: (res: AuthResponse) => Promise<void>;
  setUser: (user: User) => void;
  // Forget the session without calling the API — after "sign out
  // everywhere" or deleting the account, the server side is already gone.
  signOutLocally: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // App launch: trade the stored refresh token (if any) for a fresh session.
    refreshSession()
      .then((session) => setUserState(session?.user ?? null))
      .finally(() => setIsLoading(false));
  }, []);

  const applyAuth = useCallback(async (res: AuthResponse) => {
    setAccessToken(res.accessToken);
    await setRefreshToken(res.refreshToken ?? null);
    setUserState(res.user);
  }, []);

  const signOutLocally = useCallback(async () => {
    await clearTokens();
    queryClient.clear();
    setUserState(null);
  }, [queryClient]);

  async function login(email: string, password: string): Promise<void> {
    await applyAuth(await authApi.login(email, password));
  }

  async function signup(email: string, password: string, name: string): Promise<void> {
    await authApi.signup(email, password, name);
  }

  async function verifyEmail(email: string, code: string): Promise<void> {
    await applyAuth(await authApi.verifyEmail(email, code));
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // Offline or already expired — still log out locally.
    }
    await signOutLocally();
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, signup, verifyEmail, logout, applyAuth, setUser: setUserState, signOutLocally }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
