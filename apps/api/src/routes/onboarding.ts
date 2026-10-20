import { Router } from "express";
import { prisma } from "@stocksentry/database";
import { requireMerchant } from "../middleware/auth.js";

export const onboardingRouter = Router();

onboardingRouter.get(
  "/onboarding",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const shop = await prisma.shop.findUniqueOrThrow({
        where: { id: shopId },
      });

      const [itemCount, locationCount, ruleCount, prefCount, observationCount] =
        await Promise.all([
          prisma.inventoryItem.count({
            where: { shopId, deletedAt: null },
          }),
          prisma.inventoryLocation.count({ where: { shopId } }),
          prisma.detectionRule.count({ where: { shopId, enabled: true } }),
          prisma.notificationPreference.count({
            where: { shopId, enabled: true },
          }),
          prisma.inventoryObservation.count({ where: { shopId } }),
        ]);

      const checklist = [
        {
          id: "installed",
          label: "App installed",
          done: shop.installationStatus === "INSTALLED",
        },
        {
          id: "baseline",
          label: "Inventory baseline imported",
          done: itemCount > 0 && observationCount > 0,
        },
        {
          id: "locations",
          label: "Locations discovered",
          done: locationCount > 0,
        },
        {
          id: "rules",
          label: "Detection rules enabled",
          done: ruleCount > 0,
        },
        {
          id: "notifications",
          label: "Notifications configured",
          done: prefCount > 0,
        },
        {
          id: "completed",
          label: "Onboarding completed",
          done: shop.onboardingCompleted,
        },
      ];

      res.json({
        completed: shop.onboardingCompleted,
        checklist,
        progress: {
          done: checklist.filter((c) => c.done).length,
          total: checklist.length,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

onboardingRouter.post(
  "/onboarding/complete",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shop = await prisma.shop.update({
        where: { id: req.shopId! },
        data: { onboardingCompleted: true },
        select: {
          id: true,
          onboardingCompleted: true,
          shopDomain: true,
        },
      });
      res.json(shop);
    } catch (err) {
      next(err);
    }
  },
);
