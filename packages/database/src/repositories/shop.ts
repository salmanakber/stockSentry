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
          ...(isReinstall ? { installedAt: new Date() } : {}),
        },
      });
    }

    return prisma.shop.create({
      data: {
        shopDomain,
        installationStatus: "INSTALLED",
        installedAt: new Date(),
      },
    });
  },

  markUninstalled(shopDomain: string) {
    return prisma.shop.update({
      where: { shopDomain },
      data: {
        installationStatus: "UNINSTALLED",
        uninstalledAt: new Date(),
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
