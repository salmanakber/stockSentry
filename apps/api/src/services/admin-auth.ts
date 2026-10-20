import jwt from "jsonwebtoken";

export const ADMIN_TOKEN_HEADER = "x-stocksentry-admin-token";

export type AdminJwtPayload = {
  userId: string;
  role: string;
  email: string;
};

function adminSecret(): string {
  const sec =
    process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || "";
  if (!sec) {
    throw new Error("ADMIN_JWT_SECRET (or SESSION_SECRET) is not configured");
  }
  return sec;
}

export function adminTokenHeaderName(): string {
  return ADMIN_TOKEN_HEADER;
}

export function signAdminToken(payload: AdminJwtPayload): string {
  const hours = Number(process.env.ADMIN_JWT_TTL_HOURS ?? 12);
  const ttl = Number.isFinite(hours) && hours > 0 ? hours : 12;
  return jwt.sign(payload, adminSecret(), { expiresIn: `${ttl}h` });
}

export function verifyAdminToken(token: string): AdminJwtPayload | null {
  if (!token) return null;
  try {
    const sec =
      process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET || "";
    if (!sec) return null;
    return jwt.verify(token, sec) as AdminJwtPayload;
  } catch {
    return null;
  }
}
