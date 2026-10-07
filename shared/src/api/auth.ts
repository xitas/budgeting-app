import type { CurrencyCode } from "../currency";

export interface User {
  id: string;
  email: string;
  name: string;
  // Display currency for every amount (see shared/src/currency.ts).
  currency: CurrencyCode;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  // Only present for mobile clients (X-Client-Type: mobile); web gets an httpOnly cookie.
  refreshToken?: string;
}
