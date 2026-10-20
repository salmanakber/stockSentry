import { Router } from "express";
import { prisma } from "@stocksentry/database";
import { requireMerchant } from "../middleware/auth.js";
import { ensureFreshOfflineSession } from "../shopify/client.js";
import { enqueue, QUEUE_NAMES } from "../queues/index.js";

export const productsRouter = Router();

productsRouter.get("/products", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 50;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const where = {
      shopId,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { productTitle: { contains: q, mode: "insensitive" as const } },
              { variantTitle: { contains: q, mode: "insensitive" as const } },
              { sku: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, items, locations] = await Promise.all([
      prisma.inventoryItem.count({ where }),
      prisma.inventoryItem.findMany({
        where,
        orderBy: { productTitle: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          observations: {
            orderBy: { observedAt: "desc" },
            take: 1,
            include: { location: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.inventoryLocation.findMany({
        where: { shopId, active: true },
        orderBy: { name: "asc" },
      }),
    ]);

    res.json({
      items,
      locations,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    next(err);
  }
});

productsRouter.post("/sync", requireMerchant, async (req, res, next) => {
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
});
