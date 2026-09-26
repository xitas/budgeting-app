import * as SecureStore from "expo-secure-store";

// Access token: memory only, same as the web app — short-lived and cheap to
// re-issue. Refresh token: the device's encrypted storage (iOS Keychain /
// Android Keystore), since a native app has no httpOnly cookie to hide it in.
const REFRESH_TOKEN_KEY = "refreshToken";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setRefreshToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

export async function clearTokens(): Promise<void> {
  setAccessToken(null);
  await setRefreshToken(null);
}
