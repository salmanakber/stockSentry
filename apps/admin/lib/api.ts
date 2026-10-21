import { clearAdminToken, getAdminToken } from "./auth";

function apiBase(): string {
  // Browser: same-origin /api → nginx → API (6081).
  // Server: NEXT_PUBLIC_API_URL only when set and non-empty.
  if (typeof window !== "undefined") return "";
  const raw = (process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  return raw.replace(/\/$/, "");
}

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function adminRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAdminToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("x-stocksentry-admin-token", token);
  }

  const url = `${apiBase()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    clearAdminToken();
    if (
      typeof window !== "undefined" &&
      !path.includes("/api/admin/login")
    ) {
      window.location.href = "/admin/login";
    }
    throw new AdminApiError("Unauthorized", 401);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const msg =
      data &&
      typeof data === "object" &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Request failed (${res.status})`;
    throw new AdminApiError(msg, res.status);
  }

  return data as T;
}
