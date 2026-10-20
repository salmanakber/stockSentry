import { Router, type Request, type Response } from "express";
import {
  sessionRepository,
} from "@stocksentry/database";
import {
  shopify,
  sessionStorage,
  ensureFreshOfflineSession,
} from "../shopify/client.js";
import { ensureShop } from "../services/ensure-shop.js";

const embeddedAppUrl = (
  process.env.EMBEDDED_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

export async function beginAuth(req: Request, res: Response) {
  const shop = req.query.shop as string | undefined;
  if (!shop) {
    res.status(400).send("Missing shop parameter");
    return;
  }

  await shopify.auth.begin({
    shop: shopify.utils.sanitizeShop(shop, true)!,
    callbackPath: "/auth/callback",
    isOnline: false,
    rawRequest: req,
    rawResponse: res,
  });
}

export const authRouter = Router();

authRouter.get("/", beginAuth);

authRouter.get("/callback", async (req, res) => {
  const callback = await shopify.auth.callback({
    rawRequest: req,
    rawResponse: res,
  });

  const { session } = callback;
  await sessionStorage.storeSession(session);
  await ensureShop(session.shop);

  if (!session.isOnline) {
    try {
      await sessionRepository.deleteBrokenOfflineSessions(
        session.shop,
        session.id,
      );
    } catch {
      /* best-effort cleanup of stale offline tokens */
    }
  }

  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  const host = typeof req.query.host === "string" ? req.query.host : "";
  if (host) {
    const params = new URLSearchParams({
      shop: session.shop,
      host,
      embedded: "1",
    });
    res.redirect(`${embeddedAppUrl}/?${params.toString()}`);
    return;
  }

  if (apiKey) {
    const storeHandle = session.shop.replace(/\.myshopify\.com$/i, "");
    res.redirect(
      `https://admin.shopify.com/store/${storeHandle}/apps/${apiKey}`,
    );
    return;
  }

  res.redirect(
    `${embeddedAppUrl}/?shop=${encodeURIComponent(session.shop)}&embedded=1`,
  );
});

authRouter.get("/session", async (req, res) => {
  const shopParam = (req.query.shop as string) ?? "";
  const shop = shopParam
    ? shopify.utils.sanitizeShop(shopParam, true)
    : null;
  if (!shop) {
    res.status(400).json({ ok: false, error: "Missing shop" });
    return;
  }

  const offline = await sessionRepository.findOfflineForShop(shop);

  let shopifyReachable = false;
  if (offline?.accessToken) {
    try {
      await ensureFreshOfflineSession(shop);
      shopifyReachable = true;
    } catch {
      shopifyReachable = false;
    }
  }

  const hasOfflineSession = Boolean(offline?.accessToken);

  res.json({
    ok: Boolean(hasOfflineSession && shopifyReachable),
    shop,
    hasOfflineSession,
    reconnectRequired: Boolean(hasOfflineSession && !shopifyReachable),
  });
});
