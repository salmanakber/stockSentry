import { prisma } from "@stocksentry/database";
import {
  computeMonitoringHealth,
  resolveReconciliationIntervalHours,
  resolveReconciliationIntervalMinutes,
} from "@stocksentry/shared";

export function nextReconcileAt(
  lastReconciledAt: Date | null,
  intervalHoursOrMinutes: number,
  now = new Date(),
  /** When true, treat the number as minutes instead of hours. */
  asMinutes = false,
): Date {
  if (!lastReconciledAt) {
    return now;
  }
  const ms = asMinutes
    ? Math.max(1, intervalHoursOrMinutes) * 60 * 1000
    : Math.max(1 / 60, intervalHoursOrMinutes) * 60 * 60 * 1000;
  return new Date(lastReconciledAt.getTime() + ms);
}

export async function getShopMonitoringSnapshot(shopId: string) {
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
  const intervalMinutes = resolveReconciliationIntervalMinutes(shop);
  const monitoringStatus = computeMonitoringHealth({
    installationStatus: shop.installationStatus,
    lastWebhookAt: shop.lastWebhookAt,
    lastReconciledAt: shop.lastReconciledAt,
    reconciliationIntervalHours: resolveReconciliationIntervalHours(shop),
    reconciliationIntervalMinutes: intervalMinutes,
  });

  return {
    shop,
    monitoringStatus,
    nextReconcileAt: nextReconcileAt(
      shop.lastReconciledAt,
      intervalMinutes,
      new Date(),
      true,
    ),
  };
}

export async function observationSourceBreakdown(
  shopId: string,
  days = 14,
): Promise<Record<string, number>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.inventoryObservation.groupBy({
    by: ["source"],
    where: { shopId, observedAt: { gte: since } },
    _count: { _all: true },
  });
  const total = rows.reduce((sum, r) => sum + r._count._all, 0);
  const percentages: Record<string, number> = {};
  for (const row of rows) {
    percentages[row.source] =
      total === 0 ? 0 : Math.round((row._count._all / total) * 1000) / 10;
  }
  return percentages;
}

export async function incidentTrendLastDays(shopId: string, days = 14) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const detected = await prisma.incident.findMany({
    where: { shopId, firstDetectedAt: { gte: since } },
    select: { firstDetectedAt: true },
  });
  const closed = await prisma.incident.findMany({
    where: {
      shopId,
      resolvedAt: { gte: since },
      status: { in: ["RESOLVED", "DISMISSED"] },
    },
    select: { resolvedAt: true },
  });

  const byDay = new Map<string, { detected: number; closed: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, { detected: 0, closed: 0 });
  }

  for (const row of detected) {
    const key = row.firstDetectedAt.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) bucket.detected += 1;
  }
  for (const row of closed) {
    if (!row.resolvedAt) continue;
    const key = row.resolvedAt.toISOString().slice(0, 10);
    const bucket = byDay.get(key);
    if (bucket) bucket.closed += 1;
  }

  return [...byDay.entries()].map(([date, counts]) => ({
    date,
    detected: counts.detected,
    closed: counts.closed,
  }));
}

export async function dailyIncidentCounts(
  shopId: string,
  days = 14,
): Promise<number[]> {
  const trend = await incidentTrendLastDays(shopId, days);
  return trend.map((t) => t.detected);
}

export async function pipelineStatsLast24h(shopId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    webhooksReceived,
    duplicatesRemoved,
    observationsStored,
    incidentsTouched,
    notificationsSent,
  ] = await Promise.all([
    prisma.webhookEvent.count({
      where: { shopId, receivedAt: { gte: since } },
    }),
    prisma.webhookEvent.count({
      where: { shopId, receivedAt: { gte: since }, status: "IGNORED" },
    }),
    prisma.inventoryObservation.count({
      where: { shopId, createdAt: { gte: since } },
    }),
    prisma.incident.count({
      where: { shopId, updatedAt: { gte: since } },
    }),
    prisma.notificationDelivery.count({
      where: { shopId, status: "SENT", sentAt: { gte: since } },
    }),
  ]);

  return {
    webhooksReceived,
    hmacVerified: webhooksReceived,
    duplicatesRemoved,
    observationsStored,
    rulesEvaluated: observationsStored,
    incidentsTouched,
    notificationsSent,
  };
}
