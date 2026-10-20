import { prisma } from "../client.js";

export const sessionRepository = {
  async findOfflineForShop(shop: string) {
    const byId = await prisma.session.findUnique({
      where: { id: `offline_${shop}` },
    });
    if (byId?.accessToken) return byId;

    return prisma.session.findFirst({
      where: {
        shop,
        isOnline: false,
        accessToken: { not: "" },
      },
      orderBy: { id: "desc" },
    });
  },

  async deleteBrokenOfflineSessions(shop: string, keepId?: string) {
    await prisma.session.deleteMany({
      where: {
        shop,
        isOnline: false,
        ...(keepId ? { id: { not: keepId } } : {}),
      },
    });
  },
};
