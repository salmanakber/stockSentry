import { Router } from "express";
import { prisma } from "@stocksentry/database";
import { requireMerchant } from "../middleware/auth.js";
import { enqueue, QUEUE_NAMES } from "../queues/index.js";
import { ensureFreshOfflineSession } from "../shopify/client.js";
import { enqueueTestEmail } from "../services/notify.js";

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

      const [
        itemCount,
        locationCount,
        ruleCount,
        prefCount,
        observationCount,
        emailPref,
        deliveryCount,
      ] = await Promise.all([
        prisma.inventoryItem.count({
          where: { shopId, deletedAt: null },
        }),
        prisma.inventoryLocation.count({ where: { shopId } }),
        prisma.detectionRule.count({ where: { shopId, enabled: true } }),
        prisma.notificationPreference.count({
          where: { shopId, enabled: true },
        }),
        prisma.inventoryObservation.count({ where: { shopId } }),
        prisma.notificationPreference.findUnique({
          where: { shopId_channel: { shopId, channel: "EMAIL" } },
        }),
        prisma.notificationDelivery.count({ where: { shopId } }),
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
          id: "test_alert",
          label: "Test notification sent",
          done:
            deliveryCount > 0 ||
            Boolean(emailPref?.destinationRef?.includes("@")),
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
  "/onboarding/sync",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shop = req.shop!;
      const shopId = req.shopId!;
      await ensureFreshOfflineSession(shop, req.sessionToken);
      await enqueue(QUEUE_NAMES.INVENTORY_BASELINE, {
        shopId,
        shopDomain: shop,
        sessionToken: req.sessionToken,
      });
      await enqueue(QUEUE_NAMES.INVENTORY_RECONCILE, {
        shopId,
        shopDomain: shop,
        sessionToken: req.sessionToken,
      });
      res.status(202).json({
        ok: true,
        enqueued: ["inventory.baseline", "inventory.reconcile"],
      });
    } catch (err) {
      next(err);
    }
  },
);

onboardingRouter.post(
  "/onboarding/test-notification",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      // Always create an in-app delivery so checklist can advance without email
      const inApp = await prisma.notificationDelivery.create({
        data: {
          shopId,
          channel: "IN_APP",
          status: "SENT",
          sentAt: new Date(),
          destination: "onboarding_test",
        },
      });

      let email: { deliveryId: string; to: string } | null = null;
      try {
        email = await enqueueTestEmail({
          shopId,
          shopDomain: req.shop!,
          to:
            typeof req.body?.to === "string" ? req.body.to.trim() : undefined,
        });
      } catch {
        // Email optional during onboarding when destination not set
      }

      res.json({
        ok: true,
        inAppDeliveryId: inApp.id,
        email,
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
