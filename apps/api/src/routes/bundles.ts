import { Router } from "express";
import {
  prisma,
  type BundleItemRole,
  type RelationshipSource,
} from "@stocksentry/database";
import { requireMerchant } from "../middleware/auth.js";
import {
  getRefillThreshold,
  latestQuantitiesByShop,
} from "../services/refill.js";

export const bundlesRouter = Router();

bundlesRouter.get("/bundles", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const [groups, threshold, latestQtys] = await Promise.all([
      prisma.bundleGroup.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  productTitle: true,
                  variantTitle: true,
                  sku: true,
                },
              },
            },
          },
        },
      }),
      getRefillThreshold(shopId),
      latestQuantitiesByShop(shopId),
    ]);

    const minQtyByItem = new Map<string, number>();
    for (const row of latestQtys) {
      const prev = minQtyByItem.get(row.inventoryItemId);
      if (prev == null || row.quantity < prev) {
        minQtyByItem.set(row.inventoryItemId, row.quantity);
      }
    }

    const items = groups.map((g) => ({
      ...g,
      items: g.items.map((it) => {
        const qty = minQtyByItem.get(it.inventoryItemId) ?? null;
        const refillAtRisk = qty != null && qty <= threshold;
        return {
          ...it,
          quantity: qty,
          refillAtRisk,
          refillThreshold: threshold,
        };
      }),
    }));

    res.json({ items, refillThreshold: threshold });
  } catch (err) {
    next(err);
  }
});

bundlesRouter.post("/bundles", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const body = req.body as {
      name?: string;
      description?: string;
      relationshipSource?: RelationshipSource;
      items?: Array<{ inventoryItemId: string; role?: BundleItemRole }>;
    };

    if (!body.name?.trim()) {
      res.status(400).json({ error: "name_required" });
      return;
    }

    const group = await prisma.bundleGroup.create({
      data: {
        shopId,
        name: body.name.trim(),
        description: body.description ?? null,
        relationshipSource: body.relationshipSource ?? "MANUAL",
        items: body.items?.length
          ? {
              create: body.items.map((item) => ({
                shopId,
                inventoryItemId: item.inventoryItemId,
                role: item.role ?? "COMPONENT",
              })),
            }
          : undefined,
      },
      include: { items: true },
    });

    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
});

bundlesRouter.get("/bundles/:id", requireMerchant, async (req, res, next) => {
  try {
    const group = await prisma.bundleGroup.findFirst({
      where: { id: req.params.id, shopId: req.shopId! },
      include: {
        items: {
          include: {
            inventoryItem: {
              select: {
                id: true,
                productTitle: true,
                variantTitle: true,
                sku: true,
              },
            },
          },
        },
      },
    });
    if (!group) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(group);
  } catch (err) {
    next(err);
  }
});

bundlesRouter.patch("/bundles/:id", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const existing = await prisma.bundleGroup.findFirst({
      where: { id: req.params.id, shopId },
    });
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const body = req.body as {
      name?: string;
      description?: string | null;
      active?: boolean;
    };

    const group = await prisma.bundleGroup.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
      },
      include: { items: true },
    });

    res.json(group);
  } catch (err) {
    next(err);
  }
});

bundlesRouter.delete(
  "/bundles/:id",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const existing = await prisma.bundleGroup.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      await prisma.bundleGroupItem.deleteMany({
        where: { bundleGroupId: existing.id },
      });
      await prisma.bundleGroup.delete({ where: { id: existing.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

bundlesRouter.post(
  "/bundles/:id/items",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const group = await prisma.bundleGroup.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!group) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const body = req.body as {
        inventoryItemId?: string;
        role?: BundleItemRole;
      };
      if (!body.inventoryItemId) {
        res.status(400).json({ error: "inventoryItemId_required" });
        return;
      }

      const item = await prisma.bundleGroupItem.upsert({
        where: {
          bundleGroupId_inventoryItemId: {
            bundleGroupId: group.id,
            inventoryItemId: body.inventoryItemId,
          },
        },
        create: {
          shopId,
          bundleGroupId: group.id,
          inventoryItemId: body.inventoryItemId,
          role: body.role ?? "COMPONENT",
        },
        update: {
          role: body.role ?? "COMPONENT",
        },
      });

      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  },
);

bundlesRouter.delete(
  "/bundles/:id/items/:itemId",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const item = await prisma.bundleGroupItem.findFirst({
        where: {
          id: req.params.itemId,
          bundleGroupId: req.params.id,
          shopId,
        },
      });
      if (!item) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      await prisma.bundleGroupItem.delete({ where: { id: item.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
