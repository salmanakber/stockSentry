import { prisma, shopRepository } from "@stocksentry/database";
import { cancelShopSubscriptions } from "./billing.js";

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

  const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });

  // Clear residual billing / usage fields on the audit Shop row
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      planSlug: "free",
      planId: freePlan?.id ?? null,
      planAssignedByAdmin: false,
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
 * App uninstall (Shopify App Store 1.2.2):
 * 1. Cancel Shopify subscription(s) while offline token still works
 * 2. Clear plan to free / billing NONE / GID null / planAssignedByAdmin false
 * 3. Delete sessions
 * 4. Wipe tenant data (same as redact)
 */
export async function handleUninstall(shopDomain: string): Promise<void> {
  const shop = await prisma.shop.findUnique({ where: { shopDomain } });
  if (!shop) return;

  // 1. Cancel subscription BEFORE deleting sessions / wiping token
  try {
    const result = await cancelShopSubscriptions(
      shopDomain,
      shop.shopifySubscriptionGid,
    );
    if (result.errors.length) {
      console.warn(
        `[compliance] subscription cancel warnings for ${shopDomain}:`,
        result.errors.join("; "),
      );
    }
  } catch (err) {
    console.warn(
      `[compliance] subscription cancel failed for ${shopDomain}`,
      err instanceof Error ? err.message : err,
    );
  }

  // 2. Clear plan / billing while shop row still exists
  const freePlan = await prisma.plan.findUnique({ where: { slug: "free" } });
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      planSlug: "free",
      planId: freePlan?.id ?? null,
      planAssignedByAdmin: false,
      billingStatus: "NONE",
      shopifySubscriptionGid: null,
    },
  });

  // 3–4. Wipe tenant data + delete sessions (handleShopRedact)
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
