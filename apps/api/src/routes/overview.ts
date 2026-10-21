import { Router } from "express";
import { prisma } from "@stocksentry/database";
import { requireMerchant } from "../middleware/auth.js";
import {
  dailyIncidentCounts,
  getShopMonitoringSnapshot,
  incidentTrendLastDays,
  observationSourceBreakdown,
  pipelineStatsLast24h,
} from "../services/monitoring.js";
import { aiReportUsageSummary } from "../services/ai-report.js";
import {
  countRefillAttentionItems,
  getRefillThreshold,
  latestQuantitiesByShop,
} from "../services/refill.js";

export const overviewRouter = Router();

overviewRouter.get("/overview", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const snapshot = await getShopMonitoringSnapshot(shopId);

    const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      sourceBreakdown,
      incidentTrend,
      sparkline,
      newIncidents,
      unresolved,
      highPriority,
      monitoredItems,
      recentIncidents,
      reviewResolved,
      reviewDismissed,
      reviewOpen,
      reviewTotal,
      repeatGroups,
      bundleGroups,
      aiReports,
      pipelineStats,
      supplierLinks,
      refillAttention,
      refillThreshold,
      latestQtys,
    ] = await Promise.all([
      observationSourceBreakdown(shopId, 14),
      incidentTrendLastDays(shopId, 14),
      dailyIncidentCounts(shopId, 14),
      prisma.incident.count({
        where: { shopId, firstDetectedAt: { gte: since24h } },
      }),
      prisma.incident.count({
        where: { shopId, status: { in: ["NEW", "INVESTIGATING"] } },
      }),
      prisma.incident.count({
        where: {
          shopId,
          status: { in: ["NEW", "INVESTIGATING"] },
          severity: { in: ["HIGH", "CRITICAL"] },
        },
      }),
      prisma.inventoryItem.count({
        where: { shopId, deletedAt: null, tracked: true },
      }),
      prisma.incident.findMany({
        where: { shopId },
        orderBy: { lastDetectedAt: "desc" },
        take: 6,
        include: {
          inventoryItem: {
            select: { productTitle: true, variantTitle: true, sku: true },
          },
          location: { select: { name: true } },
        },
      }),
      prisma.incident.count({ where: { shopId, status: "RESOLVED" } }),
      prisma.incident.count({ where: { shopId, status: "DISMISSED" } }),
      prisma.incident.count({
        where: { shopId, status: { in: ["NEW", "INVESTIGATING"] } },
      }),
      prisma.incident.count({ where: { shopId } }),
      prisma.incident.groupBy({
        by: ["inventoryItemId"],
        where: {
          shopId,
          inventoryItemId: { not: null },
          firstDetectedAt: { gte: since14d },
        },
        _count: { _all: true },
      }),
      prisma.bundleGroup.findMany({
        where: { shopId, active: true },
        include: {
          items: {
            include: {
              inventoryItem: {
                include: {
                  incidents: {
                    where: { status: { in: ["NEW", "INVESTIGATING"] } },
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      }),
      aiReportUsageSummary(shopId),
      pipelineStatsLast24h(shopId),
      prisma.supplierItem.findMany({
        where: { shopId },
        select: { inventoryItemId: true },
      }),
      countRefillAttentionItems(shopId),
      getRefillThreshold(shopId),
      latestQuantitiesByShop(shopId),
    ]);

    const qtyByItem = new Map<string, number>();
    for (const row of latestQtys) {
      const prev = qtyByItem.get(row.inventoryItemId);
      if (prev == null || row.quantity < prev) {
        qtyByItem.set(row.inventoryItemId, row.quantity);
      }
    }

    const supplierItemIds = [
      ...new Set(supplierLinks.map((s) => s.inventoryItemId)),
    ];
    const supplierItemsAtRisk =
      supplierItemIds.length === 0
        ? 0
        : await prisma.incident.count({
            where: {
              shopId,
              inventoryItemId: { in: supplierItemIds },
              status: { in: ["NEW", "INVESTIGATING"] },
            },
          });

    const repeatGroupsFiltered = repeatGroups.filter(
      (g) => g._count._all >= 3,
    );
    const repeatItemIds = repeatGroupsFiltered
      .map((g) => g.inventoryItemId)
      .filter((id): id is string => Boolean(id));
    const repeatItems =
      repeatItemIds.length === 0
        ? []
        : await prisma.inventoryItem.findMany({
            where: { id: { in: repeatItemIds } },
            select: {
              id: true,
              productTitle: true,
              variantTitle: true,
              sku: true,
            },
          });

    const bundleRisk = bundleGroups
      .map((g) => {
        const components = g.items.map((i) => {
          const title =
            [i.inventoryItem.productTitle, i.inventoryItem.variantTitle]
              .filter(Boolean)
              .join(" · ") ||
            i.inventoryItem.sku ||
            "Item";
          const minQty = qtyByItem.get(i.inventoryItemId);
          const openIncidents = i.inventoryItem.incidents.length > 0;
          const refillAtRisk =
            minQty != null && minQty <= refillThreshold;
          return {
            name: title,
            atRisk: openIncidents || refillAtRisk,
            refillAtRisk,
            openIncidents,
            quantity: minQty ?? null,
          };
        });
        const openComponents = components.filter((c) => c.atRisk);
        return {
          id: g.id,
          name: g.name,
          mapping: "Manual",
          openComponentCount: openComponents.length,
          componentCount: g.items.length,
          components,
        };
      })
      .filter((g) => g.openComponentCount > 0);

    res.json({
      monitoringStatus: snapshot.monitoringStatus,
      lastReconciledAt: snapshot.shop.lastReconciledAt,
      lastWebhookAt: snapshot.shop.lastWebhookAt,
      nextReconcileAt: snapshot.nextReconcileAt,
      observationSources: sourceBreakdown,
      kpis: {
        newIncidents,
        unresolved,
        highPriority,
        monitoredItems,
        sparklines: {
          newIncidents: sparkline,
          unresolved: [],
          highPriority: [],
          monitoredItems: [],
        },
      },
      incidentTrend,
      recentIncidents,
      reviewOutcomes: {
        resolved: reviewResolved,
        dismissed: reviewDismissed,
        open: reviewOpen,
        total: reviewTotal,
      },
      repeatIncidents: repeatItems.map((item) => ({
        ...item,
        count:
          repeatGroupsFiltered.find((g) => g.inventoryItemId === item.id)
            ?._count._all ?? 0,
      })),
      bundleRisk,
      refillAttention: {
        count: refillAttention.count,
        threshold: refillAttention.threshold,
      },
      aiReports,
      pipelineStats,
      supplierRisk: {
        linkedItems: supplierItemIds.length,
        openIncidents: supplierItemsAtRisk,
      },
    });
  } catch (err) {
    next(err);
  }
});
