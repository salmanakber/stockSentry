import { Router } from "express";
import { requireMerchant } from "../middleware/auth.js";
import {
  enqueueTestEmail,
  listNotifications,
  markNotificationsRead,
} from "../services/notify.js";

export const notificationsRouter = Router();

notificationsRouter.get(
  "/notifications",
  requireMerchant,
  async (req, res, next) => {
    try {
      const unreadOnly = req.query.unread === "1" || req.query.unread === "true";
      const channel =
        typeof req.query.channel === "string" ? req.query.channel : undefined;
      const items = await listNotifications(req.shopId!, {
        unreadOnly,
        channel,
        limit: Math.min(100, Number(req.query.limit) || 50),
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.post(
  "/notifications/read",
  requireMerchant,
  async (req, res, next) => {
    try {
      const ids = Array.isArray(req.body?.ids)
        ? (req.body.ids as string[])
        : undefined;
      const result = await markNotificationsRead(req.shopId!, ids);
      res.json({ updated: result.count });
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.post(
  "/notifications/test-email",
  requireMerchant,
  async (req, res, next) => {
    try {
      const to =
        typeof req.body?.to === "string" ? req.body.to.trim() : undefined;
      const result = await enqueueTestEmail({
        shopId: req.shopId!,
        shopDomain: req.shop!,
        to,
      });
      res.status(200).json({
        ok: true,
        deliveryId: result.deliveryId,
        to: result.to,
      });
    } catch (err) {
      if (err instanceof Error && err.message === "NO_EMAIL_DESTINATION") {
        res.status(400).json({
          error: "NO_EMAIL_DESTINATION",
          message: "Set an email address in notification preferences first.",
        });
        return;
      }
      next(err);
    }
  },
);
