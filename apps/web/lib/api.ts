import { clearSessionTokenCache, getAuthSessionToken } from "./session-token";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

/** Prefer same-origin `/api` + `/auth` (Next rewrites) when running in the browser. */
function resolveUrl(path: string): string {
  if (path.startsWith("http")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (
    typeof window !== "undefined" &&
    (normalized.startsWith("/api") || normalized.startsWith("/auth"))
  ) {
    return normalized;
  }
  return `${API_URL}${normalized}`;
}

export async function authHeaders(
  shop?: string,
  forceRefresh = false,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const token = await getAuthSessionToken(forceRefresh);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (shop) {
    headers["x-shopify-shop"] = shop;
  }
  return headers;
}

const REQUEST_TIMEOUT_MS = 90_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

function shouldRetrySession(response: Response): boolean {
  const retryHeader = response.headers.get(
    "X-Shopify-Retry-Invalid-Session-Request",
  );
  return retryHeader === "1" || response.status === 401;
}

/** Authenticated JSON API helper with Bearer + x-shopify-shop and 401 retry. */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit & { shop?: string; forceAuthRefresh?: boolean } = {},
): Promise<T> {
  const { shop, forceAuthRefresh, ...init } = options;
  const url = resolveUrl(path);

  const send = async (forceRefresh = false) => {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(await authHeaders(shop, forceRefresh)),
    };
    if (init.body && !(init.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const merged = new Headers(init.headers);
    for (const [k, v] of Object.entries(headers)) {
      if (!merged.has(k)) merged.set(k, v);
    }
    return fetchWithTimeout(url, { ...init, headers: merged });
  };

  let res = await send(Boolean(forceAuthRefresh));

  if (shouldRetrySession(res)) {
    clearSessionTokenCache();
    res = await send(true);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text || `Request failed (${res.status})`,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
