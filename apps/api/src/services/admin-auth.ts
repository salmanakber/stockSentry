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
  return jwt.sign(payload, adminSecret(), { expiresIn: "12h" });
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
