import type { CurrencyCode } from "../currency";

// /api/account — the signed-in user's profile, credentials and data.

export interface UpdateProfileInput {
  name?: string;
  currency?: CurrencyCode;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// Step 1: emails a 6-digit code to the new address (password required).
export interface RequestEmailChangeInput {
  newEmail: string;
  password: string;
}

// Step 2: the code from the new address confirms the change.
export interface ConfirmEmailChangeInput {
  code: string;
}

export interface DeleteAccountInput {
  password: string;
}
