import type { CurrencyCode } from "../currency";

export interface User {
  id: string;
  email: string;
  name: string;
  // False until the 6-digit code emailed at sign-up is entered. Unverified
  // users can use the app; the clients show a banner asking them to verify.
  emailVerified: boolean;
  // Display currency for every amount (see shared/src/currency.ts).
  currency: CurrencyCode;
  // Set while an email change waits for its confirmation code.
  pendingEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  // Only present for mobile clients (X-Client-Type: mobile); web gets an httpOnly cookie.
  refreshToken?: string;
}

// Sign-up never starts a session and answers the same whether or not the
// email is already registered (so it can't be used to find accounts). The
// code emailed to a new address verifies it and signs in (POST /auth/verify-email).
export interface SignupResponse {
  message: string;
}

export interface VerifyEmailInput {
  email: string;
  code: string;
}

export interface MessageResponse {
  message: string;
}
