import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as authApi from "../features/auth/api";
import type { AuthResponse, User } from "shared";
import { setAccessToken } from "../lib/authToken";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  // Doesn't sign in: the code emailed by sign-up does (verifyEmail).
  signup: (email: string, password: string, name: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  // For responses that carry new tokens (e.g. after a password change).
  applyAuth: (res: AuthResponse) => void;
  setUser: (user: User) => void;
  // Forget the session without calling the API — after "sign out
  // everywhere" or deleting the account, the server side is already gone.
  // The optional notice is shown on the login screen the app lands on.
  signOutLocally: (notice?: string) => void;
  signedOutNotice: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signedOutNotice, setSignedOutNotice] = useState<string | null>(null);

  useEffect(() => {
    // No access token exists yet on a fresh page load (it's memory-only).
    // This 401s, which triggers apiClient's silent-refresh interceptor using
    // the httpOnly refresh cookie — that's what actually restores the session.
    authApi
      .me()
      .then((res) => setUserState(res.user))
      .catch(() => setUserState(null))
      .finally(() => setIsLoading(false));
  }, []);

  const applyAuth = useCallback((res: AuthResponse) => {
    setAccessToken(res.accessToken);
    setSignedOutNotice(null);
    setUserState(res.user);
  }, []);

  // The signed-in layout redirects to /login once the user is gone, so the
  // notice travels here rather than in navigation state (a redirect would
  // replace that).
  const signOutLocally = useCallback((notice?: string) => {
    setAccessToken(null);
    setSignedOutNotice(notice ?? null);
    setUserState(null);
  }, []);

  async function login(email: string, password: string): Promise<void> {
    applyAuth(await authApi.login(email, password));
  }

  async function signup(email: string, password: string, name: string): Promise<void> {
    await authApi.signup(email, password, name);
  }

  async function verifyEmail(email: string, code: string): Promise<void> {
    applyAuth(await authApi.verifyEmail(email, code));
  }

  async function logout(): Promise<void> {
    await authApi.logout();
    signOutLocally();
  }

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, signup, verifyEmail, logout, applyAuth, setUser: setUserState, signOutLocally, signedOutNotice }}
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
