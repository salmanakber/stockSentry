import { prisma } from "../client.js";

export const shopRepository = {
  findByDomain(shopDomain: string) {
    return prisma.shop.findUnique({ where: { shopDomain } });
  },

  async ensureShop(shopDomain: string) {
    const existing = await prisma.shop.findUnique({ where: { shopDomain } });
    if (existing) {
      const isReinstall = existing.installationStatus === "UNINSTALLED";
      return prisma.shop.update({
        where: { shopDomain },
        data: {
          installationStatus: "INSTALLED",
          uninstalledAt: null,
          ...(isReinstall
            ? {
                installedAt: new Date(),
                // Merchant must repurchase — never restore a paid plan from DB.
                planSlug: "free",
                planId: null,
                planAssignedByAdmin: false,
                requiresPlanSelection: true,
                planChosenAt: null,
                billingStatus: "NONE",
                shopifySubscriptionGid: null,
              }
            : {}),
        },
      });
    }

    return prisma.shop.create({
      data: {
        shopDomain,
        installationStatus: "INSTALLED",
        installedAt: new Date(),
        planSlug: "free",
        billingStatus: "NONE",
        // Merchant must choose Free or paid before using the app.
        requiresPlanSelection: true,
        planChosenAt: null,
      },
    });
  },

  markUninstalled(shopDomain: string) {
    return prisma.shop.update({
      where: { shopDomain },
      data: {
        installationStatus: "UNINSTALLED",
        uninstalledAt: new Date(),
        requiresPlanSelection: true,
        planChosenAt: null,
      },
    });
  },

  touchWebhook(shopId: string) {
    return prisma.shop.update({
      where: { id: shopId },
      data: { lastWebhookAt: new Date() },
    });
  },

  touchReconciled(shopId: string) {
    return prisma.shop.update({
      where: { id: shopId },
      data: { lastReconciledAt: new Date() },
    });
  },
};
