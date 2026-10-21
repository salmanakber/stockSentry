import { Router } from "express";
import { prisma } from "@stocksentry/database";
import { requireMerchant } from "../middleware/auth.js";
import { ensureFreshOfflineSession } from "../shopify/client.js";
import { enqueue, QUEUE_NAMES } from "../queues/index.js";
import { getShopMonitoringSnapshot } from "../services/monitoring.js";
import { enqueueProductReport } from "../services/product-report.js";
import { EntitlementError } from "../services/billing.js";

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

productsRouter.get("/products/:id", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const id = req.params.id;
    const historyPage = Math.max(1, Number(req.query.historyPage) || 1);
    const historyPageSize = Math.min(
      100,
      Math.max(1, Number(req.query.historyPageSize) || 25),
    );
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const item = await prisma.inventoryItem.findFirst({
      where: { id, shopId, deletedAt: null },
    });
    if (!item) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const [
      locations,
      latestObs,
      historyTotal,
      observations,
      openIncidents,
      recentIncidents,
      incidentCount30d,
      bundleItems,
      supplierLinks,
      monitoring,
      latestProductReport,
      openIncidentAi,
    ] = await Promise.all([
      prisma.inventoryLocation.findMany({
        where: { shopId, active: true },
        orderBy: { name: "asc" },
      }),
      prisma.inventoryObservation.findMany({
        where: { shopId, inventoryItemId: id },
        orderBy: { observedAt: "desc" },
        distinct: ["locationId"],
        include: { location: { select: { id: true, name: true } } },
      }),
      prisma.inventoryObservation.count({
        where: { shopId, inventoryItemId: id },
      }),
      prisma.inventoryObservation.findMany({
        where: { shopId, inventoryItemId: id },
        orderBy: { observedAt: "desc" },
        skip: (historyPage - 1) * historyPageSize,
        take: historyPageSize,
        include: {
          location: { select: { id: true, name: true } },
        },
      }),
      prisma.incident.findMany({
        where: {
          shopId,
          inventoryItemId: id,
          status: { in: ["NEW", "INVESTIGATING"] },
        },
        orderBy: { lastDetectedAt: "desc" },
        take: 20,
        include: {
          location: { select: { id: true, name: true } },
        },
      }),
      prisma.incident.findMany({
        where: { shopId, inventoryItemId: id },
        orderBy: { lastDetectedAt: "desc" },
        take: 15,
        include: {
          location: { select: { id: true, name: true } },
        },
      }),
      prisma.incident.count({
        where: {
          shopId,
          inventoryItemId: id,
          firstDetectedAt: { gte: since30d },
        },
      }),
      prisma.bundleGroupItem.findMany({
        where: { shopId, inventoryItemId: id },
        include: {
          bundleGroup: {
            select: {
              id: true,
              name: true,
              active: true,
              description: true,
            },
          },
        },
      }),
      prisma.supplierItem.findMany({
        where: { shopId, inventoryItemId: id },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              contactEmail: true,
              contactName: true,
              leadTimeDays: true,
              active: true,
            },
          },
        },
      }),
      getShopMonitoringSnapshot(shopId),
      prisma.productReport.findFirst({
        where: { shopId, inventoryItemId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.incident.findFirst({
        where: {
          shopId,
          inventoryItemId: id,
          status: { in: ["NEW", "INVESTIGATING"] },
        },
        orderBy: { lastDetectedAt: "desc" },
        include: {
          aiReports: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
    ]);

    // absDeltaSum30d from observation history
    const obsForDelta = await prisma.inventoryObservation.findMany({
      where: {
        shopId,
        inventoryItemId: id,
        observedAt: {
          gte: new Date(since30d.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { observedAt: "asc" },
      select: { locationId: true, quantity: true, observedAt: true },
    });
    let absDeltaSum30d = 0;
    const prevByLoc = new Map<string, number>();
    for (const obs of obsForDelta) {
      const prev = prevByLoc.get(obs.locationId);
      if (prev != null && obs.observedAt >= since30d) {
        absDeltaSum30d += Math.abs(obs.quantity - prev);
      }
      prevByLoc.set(obs.locationId, obs.quantity);
    }

    const lastChangeAt = latestObs[0]?.observedAt ?? null;

    const locationQuantities = locations.map((loc) => {
      const latest = latestObs.find((o) => o.locationId === loc.id);
      return {
        locationId: loc.id,
        name: loc.name,
        quantity: latest?.quantity ?? null,
        lastObservedAt: latest?.observedAt ?? null,
        source: latest?.source ?? null,
      };
    });

    res.json({
      item: {
        id: item.id,
        productTitle: item.productTitle,
        variantTitle: item.variantTitle,
        sku: item.sku,
        tracked: item.tracked,
        shopifyInventoryItemGid: item.shopifyInventoryItemGid,
        productGid: item.productGid,
        variantGid: item.variantGid,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
      locations: locationQuantities,
      history: {
        items: observations,
        page: historyPage,
        pageSize: historyPageSize,
        total: historyTotal,
        totalPages: Math.ceil(historyTotal / historyPageSize) || 1,
      },
      incidents: {
        open: openIncidents,
        recent: recentIncidents,
      },
      bundles: bundleItems.map((b) => ({
        id: b.bundleGroup.id,
        name: b.bundleGroup.name,
        active: b.bundleGroup.active,
        description: b.bundleGroup.description,
        role: b.role,
      })),
      suppliers: supplierLinks.map((s) => ({
        ...s.supplier,
        skuOverride: s.skuOverride,
        notes: s.notes,
        linkId: s.id,
      })),
      stats: {
        incidentCount30d,
        absDeltaSum30d,
        lastChangeAt,
        openIncidentCount: openIncidents.length,
        monitoringHealth: monitoring.monitoringStatus,
      },
      productReport: latestProductReport,
      latestIncidentAiReport:
        openIncidentAi?.aiReports?.[0] ?? null,
    });
  } catch (err) {
    next(err);
  }
});

productsRouter.post(
  "/products/:id/report",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const id = req.params.id;
      const item = await prisma.inventoryItem.findFirst({
        where: { id, shopId, deletedAt: null },
        select: { id: true },
      });
      if (!item) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const report = await enqueueProductReport({
        shopId,
        inventoryItemId: id,
      });

      await enqueue(QUEUE_NAMES.PRODUCT_REPORT, {
        reportId: report.id,
        shopId,
        inventoryItemId: id,
      });

      res.status(202).json(report);
    } catch (err) {
      if (err instanceof EntitlementError) {
        res.status(403).json({
          error: err.code,
          code: err.code,
          message: err.message,
        });
        return;
      }
      next(err);
    }
  },
);

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
