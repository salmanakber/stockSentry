import { Router } from "express";
import { requireMerchant } from "../middleware/auth.js";
import {
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
      const items = await listNotifications(req.shopId!, {
        unreadOnly,
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
