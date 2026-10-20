import { prisma, shopRepository } from "@stocksentry/database";

/**
 * GDPR shop/redact — wipe shop-scoped operational data while keeping a
 * minimal Shop row marked UNINSTALLED for audit.
 *
 * Deletes every tenant-scoped table row for the shop, clears sessions for
 * the domain, and resets billing / AI quota fields on the residual Shop row.
 */
export async function handleShopRedact(shopDomain: string): Promise<void> {
  const shop = await prisma.shop.findUnique({ where: { shopDomain } });
  if (!shop) return;

  await prisma.$transaction([
    prisma.notificationDelivery.deleteMany({ where: { shopId: shop.id } }),
    prisma.notificationPreference.deleteMany({ where: { shopId: shop.id } }),
    prisma.incidentNote.deleteMany({ where: { shopId: shop.id } }),
    prisma.incidentActivity.deleteMany({ where: { shopId: shop.id } }),
    prisma.incidentEvidence.deleteMany({ where: { shopId: shop.id } }),
    prisma.aiReport.deleteMany({ where: { shopId: shop.id } }),
    prisma.incident.deleteMany({ where: { shopId: shop.id } }),
    prisma.bundleGroupItem.deleteMany({ where: { shopId: shop.id } }),
    prisma.bundleGroup.deleteMany({ where: { shopId: shop.id } }),
    prisma.inventoryObservation.deleteMany({ where: { shopId: shop.id } }),
    prisma.inventoryItem.deleteMany({ where: { shopId: shop.id } }),
    prisma.inventoryLocation.deleteMany({ where: { shopId: shop.id } }),
    prisma.webhookEvent.deleteMany({ where: { shopId: shop.id } }),
    prisma.detectionRule.deleteMany({ where: { shopId: shop.id } }),
    prisma.exportJob.deleteMany({ where: { shopId: shop.id } }),
    prisma.shopSettings.deleteMany({ where: { shopId: shop.id } }),
  ]);

  await shopRepository.markUninstalled(shopDomain);

  // Clear residual billing / usage fields on the audit Shop row
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      planSlug: "free",
      billingStatus: "NONE",
      shopifySubscriptionGid: null,
      onboardingCompleted: false,
      lastWebhookAt: null,
      lastReconciledAt: null,
      aiReportsUsedMonth: 0,
      aiReportsMonthKey: null,
    },
  });

  await prisma.session.deleteMany({ where: { shop: shopDomain } });
}

/**
 * App uninstall — mark uninstalled and wipe sensitive operational data.
 */
export async function handleUninstall(shopDomain: string): Promise<void> {
  await handleShopRedact(shopDomain);
}

/**
 * Customer data request — StockSentry stores inventory ops data, not
 * personal customer PII. Return an empty payload acknowledgment.
 */
export async function handleCustomerDataRequest(_payload: unknown): Promise<{
  ok: true;
  customerData: Record<string, never>;
}> {
  return { ok: true, customerData: {} };
}

/**
 * Customer redact — no customer PII stored in shop-scoped inventory tables.
 */
export async function handleCustomerRedact(_payload: unknown): Promise<void> {
  // No-op: inventory monitoring does not persist Shopify customer records.
}
