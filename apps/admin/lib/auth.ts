const TOKEN_KEY = "stocksentry-admin-token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY)
    );
  } catch {
    return null;
  }
}

export function setAdminToken(token: string, persist = true): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    if (persist) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAdminToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function isLoggedIn(): boolean {
  return Boolean(getAdminToken());
}
