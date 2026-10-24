import { Router } from "express";
import { prisma } from "@stocksentry/database";
import { requireMerchant } from "../middleware/auth.js";
import {
  EntitlementError,
  assertSupplierCapacity,
} from "../services/billing.js";

export const suppliersRouter = Router();

suppliersRouter.get("/suppliers", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const suppliers = await prisma.supplier.findMany({
      where: {
        shopId,
        ...(q
          ? { name: { contains: q, mode: "insensitive" as const } }
          : {}),
      },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { items: true } },
        items: {
          select: { inventoryItemId: true },
        },
      },
    });

    const allItemIds = [
      ...new Set(suppliers.flatMap((s) => s.items.map((i) => i.inventoryItemId))),
    ];

    const openByItem =
      allItemIds.length === 0
        ? []
        : await prisma.incident.groupBy({
            by: ["inventoryItemId"],
            where: {
              shopId,
              inventoryItemId: { in: allItemIds },
              status: { in: ["NEW", "INVESTIGATING"] },
            },
            _count: { _all: true },
          });

    const openMap = new Map(
      openByItem.map((r) => [r.inventoryItemId!, r._count._all]),
    );

    res.json({
      items: suppliers.map((s) => {
        const openIncidentCount = s.items.reduce(
          (sum, i) => sum + (openMap.get(i.inventoryItemId) ?? 0),
          0,
        );
        return {
          id: s.id,
          name: s.name,
          contactEmail: s.contactEmail,
          contactName: s.contactName,
          notes: s.notes,
          leadTimeDays: s.leadTimeDays,
          active: s.active,
          verified: s.verified,
          verifiedAt: s.verifiedAt,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          itemCount: s._count.items,
          openIncidentCount,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

suppliersRouter.post("/suppliers", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const body = req.body as {
      name?: string;
      contactEmail?: string | null;
      contactName?: string | null;
      notes?: string | null;
      leadTimeDays?: number | null;
      active?: boolean;
    };

    if (!body.name?.trim()) {
      res.status(400).json({ error: "name_required" });
      return;
    }

    await assertSupplierCapacity(shopId, 1);

    const supplier = await prisma.supplier.create({
      data: {
        shopId,
        name: body.name.trim(),
        contactEmail: body.contactEmail?.trim() || null,
        contactName: body.contactName?.trim() || null,
        notes: body.notes?.trim() || null,
        leadTimeDays:
          typeof body.leadTimeDays === "number" ? body.leadTimeDays : null,
        active: body.active ?? true,
      },
    });

    res.status(201).json(supplier);
  } catch (err) {
    if (err instanceof EntitlementError) {
      res.status(403).json({
        error: err.code.toLowerCase(),
        code: err.code,
        message: err.message,
      });
      return;
    }
    next(err);
  }
});

suppliersRouter.get(
  "/suppliers/:id",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const supplier = await prisma.supplier.findFirst({
        where: { id: req.params.id, shopId },
        include: {
          items: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  productTitle: true,
                  variantTitle: true,
                  sku: true,
                  imageUrl: true,
                  tracked: true,
                },
              },
            },
          },
        },
      });
      if (!supplier) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const itemIds = supplier.items.map((i) => i.inventoryItemId);
      const openIncidents =
        itemIds.length === 0
          ? []
          : await prisma.incident.findMany({
              where: {
                shopId,
                inventoryItemId: { in: itemIds },
                status: { in: ["NEW", "INVESTIGATING"] },
              },
              orderBy: { lastDetectedAt: "desc" },
              take: 50,
              include: {
                inventoryItem: {
                  select: {
                    id: true,
                    productTitle: true,
                    variantTitle: true,
                    sku: true,
                    imageUrl: true,
                  },
                },
                location: { select: { name: true } },
              },
            });

      res.json({
        ...supplier,
        openIncidents,
        openIncidentCount: openIncidents.length,
      });
    } catch (err) {
      next(err);
    }
  },
);

suppliersRouter.patch(
  "/suppliers/:id",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const existing = await prisma.supplier.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const body = req.body as {
        name?: string;
        contactEmail?: string | null;
        contactName?: string | null;
        notes?: string | null;
        leadTimeDays?: number | null;
        active?: boolean;
        verified?: boolean;
      };

      // Verification is only via POST /suppliers/:id/verify
      if (body.verified !== undefined) {
        res.status(400).json({
          error: "use_verify_endpoint",
          message: "Use POST /suppliers/:id/verify to mark a supplier verified.",
        });
        return;
      }

      const supplier = await prisma.supplier.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.contactEmail !== undefined
            ? { contactEmail: body.contactEmail?.trim() || null }
            : {}),
          ...(body.contactName !== undefined
            ? { contactName: body.contactName?.trim() || null }
            : {}),
          ...(body.notes !== undefined
            ? { notes: body.notes?.trim() || null }
            : {}),
          ...(body.leadTimeDays !== undefined
            ? { leadTimeDays: body.leadTimeDays }
            : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
      });

      res.json(supplier);
    } catch (err) {
      next(err);
    }
  },
);

/** Explicit merchant action — only accepts `{ verified: true }`. */
suppliersRouter.post(
  "/suppliers/:id/verify",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const existing = await prisma.supplier.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const body = req.body as { verified?: boolean };
      if (body.verified !== true) {
        res.status(400).json({
          error: "verified_true_required",
          message: "Only { verified: true } is accepted via this action.",
        });
        return;
      }

      const supplier = await prisma.supplier.update({
        where: { id: existing.id },
        data: {
          verified: true,
          verifiedAt: existing.verifiedAt ?? new Date(),
        },
      });

      res.json(supplier);
    } catch (err) {
      next(err);
    }
  },
);

/** Alias matching the PATCH verify contract: `{ verified: true }` only. */
suppliersRouter.patch(
  "/suppliers/:id/verify",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const existing = await prisma.supplier.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const body = req.body as { verified?: boolean };
      if (body.verified !== true) {
        res.status(400).json({
          error: "verified_true_required",
          message: "Only { verified: true } is accepted via this action.",
        });
        return;
      }

      const supplier = await prisma.supplier.update({
        where: { id: existing.id },
        data: {
          verified: true,
          verifiedAt: existing.verifiedAt ?? new Date(),
        },
      });

      res.json(supplier);
    } catch (err) {
      next(err);
    }
  },
);

suppliersRouter.delete(
  "/suppliers/:id",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const existing = await prisma.supplier.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      await prisma.supplierItem.deleteMany({
        where: { shopId, supplierId: existing.id },
      });
      await prisma.supplier.delete({ where: { id: existing.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

suppliersRouter.post(
  "/suppliers/:id/items",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const supplier = await prisma.supplier.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!supplier) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const body = req.body as {
        inventoryItemId?: string;
        skuOverride?: string | null;
        notes?: string | null;
      };
      if (!body.inventoryItemId) {
        res.status(400).json({ error: "inventoryItemId_required" });
        return;
      }

      const item = await prisma.inventoryItem.findFirst({
        where: { id: body.inventoryItemId, shopId, deletedAt: null },
      });
      if (!item) {
        res.status(404).json({ error: "inventory_item_not_found" });
        return;
      }

      const link = await prisma.supplierItem.upsert({
        where: {
          supplierId_inventoryItemId: {
            supplierId: supplier.id,
            inventoryItemId: item.id,
          },
        },
        create: {
          shopId,
          supplierId: supplier.id,
          inventoryItemId: item.id,
          skuOverride: body.skuOverride?.trim() || null,
          notes: body.notes?.trim() || null,
        },
        update: {
          ...(body.skuOverride !== undefined
            ? { skuOverride: body.skuOverride?.trim() || null }
            : {}),
          ...(body.notes !== undefined
            ? { notes: body.notes?.trim() || null }
            : {}),
        },
        include: {
          inventoryItem: {
            select: {
              id: true,
              productTitle: true,
              variantTitle: true,
              sku: true,
              imageUrl: true,
            },
          },
        },
      });

      res.status(201).json(link);
    } catch (err) {
      next(err);
    }
  },
);

suppliersRouter.delete(
  "/suppliers/:id/items/:inventoryItemId",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const result = await prisma.supplierItem.deleteMany({
        where: {
          shopId,
          supplierId: req.params.id,
          inventoryItemId: req.params.inventoryItemId,
        },
      });
      if (result.count === 0) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
