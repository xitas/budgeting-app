import Constants from "expo-constants";

const API_PORT = 4000;

// A phone can't reach the dev machine's "localhost", but Expo already knows
// the dev machine's LAN address — it's where the JS bundle is served from
// (hostUri, e.g. "192.168.1.20:8081"). Point the API at that host by default,
// and let EXPO_PUBLIC_API_URL override it (e.g. for a deployed API).
function resolveApiUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) {
    return override;
  }
  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${devHost ?? "localhost"}:${API_PORT}/api`;
}

export const API_URL = resolveApiUrl();
