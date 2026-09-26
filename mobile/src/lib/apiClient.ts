import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AuthResponse } from "shared";
import { API_URL } from "./config";
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "./tokenStore";

// Tells the server to hand back the refresh token in the JSON body instead of
// a cookie (see "Mobile clients" in docs/architecture.md).
const MOBILE_HEADERS = { "X-Client-Type": "mobile" };

export const apiClient = axios.create({ baseURL: API_URL, headers: MOBILE_HEADERS, timeout: 15_000 });

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshPromise: Promise<AuthResponse | null> | null = null;

// Plain axios (not apiClient) so this call never re-enters the response
// interceptor below and can't cause an infinite refresh loop.
async function doRefresh(): Promise<AuthResponse | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }
  try {
    const res = await axios.post<AuthResponse>(`${API_URL}/auth/refresh`, { refreshToken }, { headers: MOBILE_HEADERS });
    setAccessToken(res.data.accessToken);
    await setRefreshToken(res.data.refreshToken ?? null);
    return res.data;
  } catch (err) {
    // Only a definite rejection logs the user out; a network blip keeps the
    // stored token so the next attempt (e.g. back on Wi-Fi) can still succeed.
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      setAccessToken(null);
      await setRefreshToken(null);
    }
    return null;
  }
}

// Concurrent 401s share one in-flight refresh — the server rotates the
// refresh token, so two parallel refreshes would race and one would fail.
export function refreshSession(): Promise<AuthResponse | null> {
  refreshPromise ??= doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const session = await refreshSession();
      if (session) {
        originalRequest.headers.set("Authorization", `Bearer ${session.accessToken}`);
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);
