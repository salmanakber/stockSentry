import type { NextFunction, Request, Response } from "express";
import { shopify } from "../shopify/client.js";
import { ensureShop } from "../services/ensure-shop.js";

declare global {
  namespace Express {
    interface Request {
      shop?: string;
      shopId?: string;
      sessionToken?: string;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

async function resolveShopFromSessionToken(
  token: string,
): Promise<string | null> {
  try {
    const payload = await shopify.session.decodeSessionToken(token);
    const dest = String(payload.dest ?? "")
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    return dest || null;
  } catch {
    return null;
  }
}

/**
 * Extract Bearer session token → decode shop → ensureShop → attach request fields.
 * Does not reject unauthenticated requests; use `requireMerchant` for that.
 */
export async function attachMerchantAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      next();
      return;
    }

    const shopDomain = await resolveShopFromSessionToken(token);
    if (!shopDomain) {
      next();
      return;
    }

    const shop = await ensureShop(shopDomain);
    req.shop = shopDomain;
    req.shopId = shop.id;
    req.sessionToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

/** Require a resolved merchant shop from session-token middleware. */
export function requireMerchant(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.shop || !req.shopId) {
    res.status(401).json({
      error: "unauthorized",
      message: "Merchant session required. Open Bundle Safety from Shopify Admin.",
    });
    return;
  }
  next();
}
