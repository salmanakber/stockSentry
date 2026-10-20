import {
  prisma,
  shopRepository,
  type Prisma,
} from "@stocksentry/database";
import {
  AI_DEFAULTS,
  DEFAULT_THRESHOLDS,
  DETECTION_DEFAULTS,
  RULE_TYPES,
  defaultRuleConfigurations,
} from "@stocksentry/shared";

/**
 * Ensure a Shop row exists (INSTALLED) and seed default rules / settings /
 * notification preferences on first install (idempotent upserts).
 */
export async function ensureShop(shopDomain: string) {
  const shop = await shopRepository.ensureShop(shopDomain);
  await seedInstallDefaults(shop.id);
  return shop;
}

async function seedInstallDefaults(shopId: string) {
  const configs = defaultRuleConfigurations();

  for (const ruleType of RULE_TYPES) {
    const def = configs[ruleType];
    await prisma.detectionRule.upsert({
      where: { shopId_ruleType: { shopId, ruleType } },
      create: {
        shopId,
        ruleType,
        enabled: def.enabled,
        configuration: def.configuration as Prisma.InputJsonValue,
        version: def.version,
      },
      update: {},
    });
  }

  await prisma.shopSettings.upsert({
    where: { shopId },
    create: {
      shopId,
      thresholds: DEFAULT_THRESHOLDS as unknown as Prisma.InputJsonValue,
      monitoring: {
        reconciliationIntervalHours:
          DETECTION_DEFAULTS.reconciliationIntervalHours,
      } as Prisma.InputJsonValue,
      ai: {
        monthlyReportLimit: AI_DEFAULTS.monthlyReportLimit,
        promptVersion: AI_DEFAULTS.promptVersion,
        provider: AI_DEFAULTS.provider,
      } as Prisma.InputJsonValue,
    },
    update: {},
  });

  await prisma.notificationPreference.upsert({
    where: {
      shopId_channel: { shopId, channel: "IN_APP" },
    },
    create: {
      shopId,
      channel: "IN_APP",
      enabled: true,
      minSeverity: "MEDIUM",
      digestEnabled: false,
    },
    update: {},
  });
}
