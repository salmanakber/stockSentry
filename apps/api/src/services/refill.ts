import { prisma } from "@stocksentry/database";
import { DETECTION_DEFAULTS } from "@stocksentry/shared";

export type LatestQtyRow = {
  inventoryItemId: string;
  locationId: string;
  quantity: number;
  observedAt: Date;
};

/** Resolve shop refill threshold from ShopSettings.monitoring (default 10). */
export async function getRefillThreshold(shopId: string): Promise<number> {
  const settings = await prisma.shopSettings.findUnique({
    where: { shopId },
    select: { monitoring: true },
  });
  const monitoring = (settings?.monitoring ?? {}) as {
    refillThreshold?: unknown;
  };
  const n = Number(monitoring.refillThreshold);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return DETECTION_DEFAULTS.refillThreshold;
}

/**
 * Latest available quantity per inventory item + location (PostgreSQL DISTINCT ON).
 */
export async function latestQuantitiesByShop(
  shopId: string,
): Promise<LatestQtyRow[]> {
  return prisma.$queryRaw<LatestQtyRow[]>`
    SELECT DISTINCT ON ("inventoryItemId", "locationId")
      "inventoryItemId",
      "locationId",
      quantity,
      "observedAt"
    FROM "InventoryObservation"
    WHERE "shopId" = ${shopId}
    ORDER BY "inventoryItemId", "locationId", "observedAt" DESC
  `;
}

export async function latestQuantitiesForItem(
  shopId: string,
  inventoryItemId: string,
): Promise<LatestQtyRow[]> {
  return prisma.$queryRaw<LatestQtyRow[]>`
    SELECT DISTINCT ON ("locationId")
      "inventoryItemId",
      "locationId",
      quantity,
      "observedAt"
    FROM "InventoryObservation"
    WHERE "shopId" = ${shopId}
      AND "inventoryItemId" = ${inventoryItemId}
    ORDER BY "locationId", "observedAt" DESC
  `;
}

/** Distinct inventory items whose latest observed qty at any location is ≤ threshold. */
export async function countRefillAttentionItems(
  shopId: string,
  threshold?: number,
): Promise<{ count: number; threshold: number }> {
  const refillThreshold = threshold ?? (await getRefillThreshold(shopId));
  const rows = await latestQuantitiesByShop(shopId);
  const atRisk = new Set<string>();
  for (const row of rows) {
    if (row.quantity <= refillThreshold) {
      atRisk.add(row.inventoryItemId);
    }
  }
  return { count: atRisk.size, threshold: refillThreshold };
}

export function refillSuggestionText(opts: {
  quantity: number;
  threshold: number;
}): string {
  return `Observed quantity is ${opts.quantity} (threshold ${opts.threshold}). Review Shopify inventory and plan a refill — StockSentry will not change quantities.`;
}
