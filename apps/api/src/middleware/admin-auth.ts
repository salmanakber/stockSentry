import type { NextFunction, Request, Response } from "express";
import {
  adminTokenHeaderName,
  verifyAdminToken,
} from "../services/admin-auth.js";

declare global {
  namespace Express {
    interface Request {
      adminUserId?: string;
      adminRole?: string;
      adminEmail?: string;
    }
  }
}

/**
 * Require `x-stocksentry-admin-token` JWT (ADMIN_JWT_SECRET), like tidySync.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = adminTokenHeaderName();
  const raw = req.headers[header];
  const token = typeof raw === "string" ? raw : "";
  const payload = verifyAdminToken(token);
  if (!payload?.userId) {
    res.status(401).json({
      error: "unauthorized",
      message: "Valid admin token required",
    });
    return;
  }
  req.adminUserId = payload.userId;
  req.adminRole = payload.role;
  req.adminEmail = payload.email;
  next();
}
