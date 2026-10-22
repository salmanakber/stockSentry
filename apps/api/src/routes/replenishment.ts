import { Router } from "express";
import { prisma } from "@stocksentry/database";
import { requireMerchant } from "../middleware/auth.js";
import {
  EntitlementError,
  assertSupplierAutomation,
} from "../services/billing.js";
import {
  approveReplenishmentRequest,
  assertNoActiveRuleConflict,
  cancelReplenishmentRequest,
} from "../services/replenishment.js";

export const replenishmentRouter = Router();

function isDemoRequest(req: { headers: Record<string, unknown>; query: Record<string, unknown> }): boolean {
  const h = req.headers["x-demo-mode"];
  if (h === "1" || h === "true") return true;
  const q = req.query.demo;
  return q === "1" || q === "true";
}

replenishmentRouter.get(
  "/replenishment/rules",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const rules = await prisma.supplierReplenishmentRule.findMany({
        where: { shopId },
        orderBy: { updatedAt: "desc" },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
              verified: true,
            },
          },
          inventoryItem: {
            select: {
              id: true,
              productTitle: true,
              variantTitle: true,
              sku: true,
            },
          },
          bundleGroup: {
            select: { id: true, name: true },
          },
        },
      });
      res.json({ items: rules });
    } catch (err) {
      next(err);
    }
  },
);

replenishmentRouter.post(
  "/replenishment/rules",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const body = req.body as {
        supplierId?: string;
        inventoryItemId?: string | null;
        bundleGroupId?: string | null;
        lowStockThreshold?: number;
        restockQuantity?: number;
        autoEmailEnabled?: boolean;
        requireApproval?: boolean;
        active?: boolean;
      };

      if (!body.supplierId) {
        res.status(400).json({ error: "supplierId_required" });
        return;
      }
      if (
        typeof body.lowStockThreshold !== "number" ||
        typeof body.restockQuantity !== "number"
      ) {
        res.status(400).json({ error: "threshold_and_quantity_required" });
        return;
      }
      if (!body.inventoryItemId && !body.bundleGroupId) {
        res.status(400).json({ error: "target_required" });
        return;
      }
      if (body.inventoryItemId && body.bundleGroupId) {
        res.status(400).json({ error: "single_target_required" });
        return;
      }

      const supplier = await prisma.supplier.findFirst({
        where: { id: body.supplierId, shopId },
      });
      if (!supplier) {
        res.status(404).json({ error: "supplier_not_found" });
        return;
      }

      if (body.inventoryItemId) {
        const item = await prisma.inventoryItem.findFirst({
          where: { id: body.inventoryItemId, shopId, deletedAt: null },
        });
        if (!item) {
          res.status(404).json({ error: "inventory_item_not_found" });
          return;
        }
      }
      if (body.bundleGroupId) {
        const group = await prisma.bundleGroup.findFirst({
          where: { id: body.bundleGroupId, shopId },
        });
        if (!group) {
          res.status(404).json({ error: "bundle_group_not_found" });
          return;
        }
      }

      try {
        await assertNoActiveRuleConflict({
          shopId,
          supplierId: body.supplierId,
          inventoryItemId: body.inventoryItemId,
          bundleGroupId: body.bundleGroupId,
        });
      } catch {
        res.status(409).json({ error: "active_rule_exists" });
        return;
      }

      if (body.autoEmailEnabled) {
        await assertSupplierAutomation(shopId);
      }

      const rule = await prisma.supplierReplenishmentRule.create({
        data: {
          shopId,
          supplierId: body.supplierId,
          inventoryItemId: body.inventoryItemId ?? null,
          bundleGroupId: body.bundleGroupId ?? null,
          lowStockThreshold: Math.max(0, Math.floor(body.lowStockThreshold)),
          restockQuantity: Math.max(1, Math.floor(body.restockQuantity)),
          autoEmailEnabled: body.autoEmailEnabled ?? false,
          requireApproval: body.requireApproval ?? true,
          active: body.active ?? true,
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
              verified: true,
            },
          },
          inventoryItem: {
            select: {
              id: true,
              productTitle: true,
              variantTitle: true,
              sku: true,
            },
          },
          bundleGroup: { select: { id: true, name: true } },
        },
      });

      res.status(201).json(rule);
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
  },
);

replenishmentRouter.patch(
  "/replenishment/rules/:id",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const existing = await prisma.supplierReplenishmentRule.findFirst({
        where: { id: req.params.id, shopId },
      });
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const body = req.body as {
        lowStockThreshold?: number;
        restockQuantity?: number;
        autoEmailEnabled?: boolean;
        requireApproval?: boolean;
        active?: boolean;
        supplierId?: string;
        inventoryItemId?: string | null;
        bundleGroupId?: string | null;
      };

      const nextSupplierId = body.supplierId ?? existing.supplierId;
      const nextItemId =
        body.inventoryItemId !== undefined
          ? body.inventoryItemId
          : existing.inventoryItemId;
      const nextGroupId =
        body.bundleGroupId !== undefined
          ? body.bundleGroupId
          : existing.bundleGroupId;

      if (!nextItemId && !nextGroupId) {
        res.status(400).json({ error: "target_required" });
        return;
      }
      if (nextItemId && nextGroupId) {
        res.status(400).json({ error: "single_target_required" });
        return;
      }

      if (body.autoEmailEnabled === true) {
        await assertSupplierAutomation(shopId);
      }

      const willBeActive = body.active !== undefined ? body.active : existing.active;
      if (willBeActive) {
        try {
          await assertNoActiveRuleConflict({
            shopId,
            supplierId: nextSupplierId,
            inventoryItemId: nextItemId,
            bundleGroupId: nextGroupId,
            excludeId: existing.id,
          });
        } catch {
          res.status(409).json({ error: "active_rule_exists" });
          return;
        }
      }

      const rule = await prisma.supplierReplenishmentRule.update({
        where: { id: existing.id },
        data: {
          ...(body.supplierId !== undefined
            ? { supplierId: body.supplierId }
            : {}),
          ...(body.inventoryItemId !== undefined
            ? { inventoryItemId: body.inventoryItemId, bundleGroupId: null }
            : {}),
          ...(body.bundleGroupId !== undefined
            ? { bundleGroupId: body.bundleGroupId, inventoryItemId: null }
            : {}),
          ...(body.lowStockThreshold !== undefined
            ? {
                lowStockThreshold: Math.max(
                  0,
                  Math.floor(body.lowStockThreshold),
                ),
              }
            : {}),
          ...(body.restockQuantity !== undefined
            ? {
                restockQuantity: Math.max(1, Math.floor(body.restockQuantity)),
              }
            : {}),
          ...(body.autoEmailEnabled !== undefined
            ? { autoEmailEnabled: body.autoEmailEnabled }
            : {}),
          ...(body.requireApproval !== undefined
            ? { requireApproval: body.requireApproval }
            : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
              verified: true,
            },
          },
          inventoryItem: {
            select: {
              id: true,
              productTitle: true,
              variantTitle: true,
              sku: true,
            },
          },
          bundleGroup: { select: { id: true, name: true } },
        },
      });

      res.json(rule);
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
  },
);

replenishmentRouter.delete(
  "/replenishment/rules/:id",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const result = await prisma.supplierReplenishmentRule.deleteMany({
        where: { id: req.params.id, shopId },
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

replenishmentRouter.get(
  "/replenishment/requests",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const items = await prisma.replenishmentRequest.findMany({
        where: {
          shopId,
          ...(status ? { status: status as never } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: Math.min(100, Number(req.query.limit) || 50),
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
              verified: true,
            },
          },
          inventoryItem: {
            select: {
              id: true,
              productTitle: true,
              variantTitle: true,
              sku: true,
            },
          },
          bundleGroup: { select: { id: true, name: true } },
        },
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

replenishmentRouter.post(
  "/replenishment/requests/:id/approve",
  requireMerchant,
  async (req, res, next) => {
    try {
      if (isDemoRequest(req)) {
        res.status(403).json({ error: "demo_mode" });
        return;
      }
      const updated = await approveReplenishmentRequest({
        shopId: req.shopId!,
        shopDomain: req.shop!,
        requestId: req.params.id,
        demoMode: false,
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "NOT_FOUND") {
          res.status(404).json({ error: "not_found" });
          return;
        }
        if (err.message === "ALREADY_CANCELLED") {
          res.status(409).json({ error: "already_cancelled" });
          return;
        }
        if (err.message === "DEMO_MODE") {
          res.status(403).json({ error: "demo_mode" });
          return;
        }
      }
      next(err);
    }
  },
);

replenishmentRouter.post(
  "/replenishment/requests/:id/cancel",
  requireMerchant,
  async (req, res, next) => {
    try {
      const updated = await cancelReplenishmentRequest({
        shopId: req.shopId!,
        requestId: req.params.id,
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "NOT_FOUND") {
          res.status(404).json({ error: "not_found" });
          return;
        }
        if (err.message === "ALREADY_SENT") {
          res.status(409).json({ error: "already_sent" });
          return;
        }
      }
      next(err);
    }
  },
);
