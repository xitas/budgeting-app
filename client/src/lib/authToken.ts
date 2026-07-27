// Access token lives in memory only — never localStorage — so it can't be
// read by an injected script (XSS). It's lost on full page reload, which is
// fine: the httpOnly refresh cookie survives reloads and apiClient silently
// re-issues an access token on the first 401 it sees.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
