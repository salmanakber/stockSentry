import {
  prisma,
  type DetectionRule,
  type Incident,
  type IncidentSeverity,
  type Prisma,
} from "@stocksentry/database";
import {
  DETECTION_DEFAULTS,
  absoluteDelta,
  buildIncidentKey,
  defaultRuleConfigurations,
  detectionRuleConfigSchema,
  exceedsAbsoluteThreshold,
  exceedsPercentageThreshold,
  type DetectionRuleConfig,
} from "@stocksentry/shared";
import {
  createEmailNotification,
  createInAppNotification,
  isHighOrCritical,
  isMediumOrAbove,
} from "./notify.js";
import { enqueue, QUEUE_NAMES } from "../queues/index.js";
import { getRefillThreshold } from "./refill.js";

async function enqueuePendingDelivery(
  delivery: { id: string; status: string } | null,
  shopId: string,
) {
  if (delivery && delivery.status === "PENDING") {
    await enqueue(QUEUE_NAMES.NOTIFY_DELIVER, {
      deliveryId: delivery.id,
      shopId,
    }).catch(() => undefined);
  }
}

async function notifyNewOrUpgradedIncident(input: {
  shopId: string;
  incidentId: string;
  severity: IncidentSeverity;
  created: boolean;
  severityUpgradedToHigh: boolean;
}) {
  if (input.created && isMediumOrAbove(input.severity)) {
    const inApp = await createInAppNotification({
      shopId: input.shopId,
      incidentId: input.incidentId,
      severity: input.severity,
    }).catch(() => null);
    await enqueuePendingDelivery(inApp, input.shopId);

    const email = await createEmailNotification({
      shopId: input.shopId,
      incidentId: input.incidentId,
      severity: input.severity,
      forceIfDestination: isHighOrCritical(input.severity),
    }).catch(() => null);
    await enqueuePendingDelivery(email, input.shopId);
    return;
  }

  if (input.severityUpgradedToHigh) {
    const email = await createEmailNotification({
      shopId: input.shopId,
      incidentId: input.incidentId,
      severity: input.severity,
      forceIfDestination: true,
    }).catch(() => null);
    await enqueuePendingDelivery(email, input.shopId);
  }
}

export type EvaluateObservationContext = {
  shopId: string;
  inventoryItemId: string;
  locationId: string;
  observationId: string;
  quantity: number;
  previousQuantity: number | null;
  observedAt: Date;
  source: string;
};

function parseConfig(raw: unknown): DetectionRuleConfig {
  const parsed = detectionRuleConfigSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

function suppressionMinutes(config: DetectionRuleConfig): number {
  return (
    config.suppression?.windowMinutes ??
    DETECTION_DEFAULTS.duplicateSuppressionMinutes
  );
}

function severityForAbsolute(delta: number, threshold: number): IncidentSeverity {
  if (delta >= threshold * 3) return "CRITICAL";
  if (delta >= threshold * 2) return "HIGH";
  if (delta >= threshold) return "MEDIUM";
  return "LOW";
}

async function findOpenIncident(shopId: string, incidentKey: string) {
  return prisma.incident.findFirst({
    where: {
      shopId,
      incidentKey,
      status: { in: ["NEW", "INVESTIGATING"] },
    },
  });
}

async function wasRecentlyTouched(
  shopId: string,
  incidentKey: string,
  windowMinutes: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const recent = await prisma.incident.findFirst({
    where: {
      shopId,
      incidentKey,
      lastDetectedAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(recent);
}

async function upsertIncident(input: {
  shopId: string;
  incidentKey: string;
  type: string;
  ruleType: string;
  ruleVersion: number;
  severity: IncidentSeverity;
  inventoryItemId: string;
  locationId: string;
  evidenceVersion: string;
  detectedAt: Date;
  evidenceType: string;
  observationIds: string[];
  evidencePayload: Prisma.InputJsonValue;
}): Promise<{ incident: Incident; created: boolean }> {
  const existing = await findOpenIncident(input.shopId, input.incidentKey);
  if (existing) {
    const severityUpgradedToHigh =
      isHighOrCritical(input.severity) &&
      !isHighOrCritical(existing.severity);
    const incident = await prisma.incident.update({
      where: { id: existing.id },
      data: {
        lastDetectedAt: input.detectedAt,
        severity: input.severity,
        evidenceVersion: input.evidenceVersion,
      },
    });
    await prisma.incidentEvidence.create({
      data: {
        shopId: input.shopId,
        incidentId: incident.id,
        evidenceType: input.evidenceType,
        observationIds: input.observationIds,
        evidencePayload: input.evidencePayload,
      },
    });
    await prisma.incidentActivity.create({
      data: {
        shopId: input.shopId,
        incidentId: incident.id,
        actorType: "SYSTEM",
        activityType: "REDETECTED",
        content: `Rule ${input.ruleType} matched again`,
      },
    });
    if (severityUpgradedToHigh && incident.status === "NEW") {
      await notifyNewOrUpgradedIncident({
        shopId: input.shopId,
        incidentId: incident.id,
        severity: input.severity,
        created: false,
        severityUpgradedToHigh: true,
      });
    }
    return { incident, created: false };
  }

  const incident = await prisma.incident.create({
    data: {
      shopId: input.shopId,
      incidentKey: input.incidentKey,
      type: input.type,
      severity: input.severity,
      status: "NEW",
      inventoryItemId: input.inventoryItemId,
      locationId: input.locationId,
      ruleType: input.ruleType,
      ruleVersion: input.ruleVersion,
      evidenceVersion: input.evidenceVersion,
      firstDetectedAt: input.detectedAt,
      lastDetectedAt: input.detectedAt,
    },
  });

  await prisma.incidentEvidence.create({
    data: {
      shopId: input.shopId,
      incidentId: incident.id,
      evidenceType: input.evidenceType,
      observationIds: input.observationIds,
      evidencePayload: input.evidencePayload,
    },
  });

  await prisma.incidentActivity.create({
    data: {
      shopId: input.shopId,
      incidentId: incident.id,
      actorType: "SYSTEM",
      activityType: "CREATED",
      content: `Incident created by ${input.ruleType}`,
    },
  });

  await notifyNewOrUpgradedIncident({
    shopId: input.shopId,
    incidentId: incident.id,
    severity: input.severity,
    created: true,
    severityUpgradedToHigh: false,
  });

  return { incident, created: true };
}

async function evaluateAbsolute(
  rule: DetectionRule,
  ctx: EvaluateObservationContext,
): Promise<Incident | null> {
  const config = parseConfig(rule.configuration);
  const threshold =
    config.absolute?.threshold ?? DETECTION_DEFAULTS.absoluteChangeThreshold;
  if (
    !exceedsAbsoluteThreshold(ctx.previousQuantity, ctx.quantity, threshold)
  ) {
    return null;
  }

  const delta = absoluteDelta(ctx.previousQuantity, ctx.quantity)!;
  const incidentKey = buildIncidentKey({
    ruleType: rule.ruleType,
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
  });

  if (await wasRecentlyTouched(ctx.shopId, incidentKey, suppressionMinutes(config))) {
    return null;
  }

  const evidenceVersion = `obs:${ctx.observationId}:abs:${delta}`;
  const { incident } = await upsertIncident({
    shopId: ctx.shopId,
    incidentKey,
    type: "LARGE_ABSOLUTE_CHANGE",
    ruleType: rule.ruleType,
    ruleVersion: rule.version,
    severity: severityForAbsolute(delta, threshold),
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
    evidenceVersion,
    detectedAt: ctx.observedAt,
    evidenceType: "QUANTITY_DELTA",
    observationIds: [ctx.observationId],
    evidencePayload: {
      previousQuantity: ctx.previousQuantity,
      currentQuantity: ctx.quantity,
      absoluteDelta: delta,
      threshold,
      source: ctx.source,
    },
  });
  return incident;
}

async function evaluatePercentage(
  rule: DetectionRule,
  ctx: EvaluateObservationContext,
): Promise<Incident | null> {
  const config = parseConfig(rule.configuration);
  const percentThreshold =
    config.percentage?.percentThreshold ??
    DETECTION_DEFAULTS.percentageChangeThreshold;
  const minBaseline =
    config.percentage?.minBaseline ??
    DETECTION_DEFAULTS.minBaselineForPercentage;

  if (
    !exceedsPercentageThreshold(
      ctx.previousQuantity,
      ctx.quantity,
      percentThreshold,
      minBaseline,
    )
  ) {
    return null;
  }

  const incidentKey = buildIncidentKey({
    ruleType: rule.ruleType,
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
  });

  if (await wasRecentlyTouched(ctx.shopId, incidentKey, suppressionMinutes(config))) {
    return null;
  }

  const pct =
    ctx.previousQuantity && ctx.previousQuantity !== 0
      ? (Math.abs(ctx.quantity - ctx.previousQuantity) /
          Math.abs(ctx.previousQuantity)) *
        100
      : null;

  const evidenceVersion = `obs:${ctx.observationId}:pct:${pct?.toFixed(1)}`;
  const { incident } = await upsertIncident({
    shopId: ctx.shopId,
    incidentKey,
    type: "LARGE_PERCENTAGE_CHANGE",
    ruleType: rule.ruleType,
    ruleVersion: rule.version,
    severity: pct !== null && pct >= percentThreshold * 2 ? "HIGH" : "MEDIUM",
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
    evidenceVersion,
    detectedAt: ctx.observedAt,
    evidenceType: "QUANTITY_PERCENT",
    observationIds: [ctx.observationId],
    evidencePayload: {
      previousQuantity: ctx.previousQuantity,
      currentQuantity: ctx.quantity,
      percentageChange: pct,
      percentThreshold,
      minBaseline,
      source: ctx.source,
    },
  });
  return incident;
}

async function evaluateRepeated(
  rule: DetectionRule,
  ctx: EvaluateObservationContext,
): Promise<Incident | null> {
  const config = parseConfig(rule.configuration);
  const windowMinutes =
    config.repeated?.windowMinutes ??
    DETECTION_DEFAULTS.repeatedChangeWindowMinutes;
  const minChanges = config.repeated?.minChanges ?? 3;
  const since = new Date(ctx.observedAt.getTime() - windowMinutes * 60_000);

  const changes = await prisma.inventoryObservation.count({
    where: {
      shopId: ctx.shopId,
      inventoryItemId: ctx.inventoryItemId,
      locationId: ctx.locationId,
      observedAt: { gte: since, lte: ctx.observedAt },
      source: { in: ["WEBHOOK", "RECONCILIATION", "API_READ"] },
    },
  });

  if (changes < minChanges) return null;

  const incidentKey = buildIncidentKey({
    ruleType: rule.ruleType,
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
  });

  if (await wasRecentlyTouched(ctx.shopId, incidentKey, suppressionMinutes(config))) {
    return null;
  }

  const evidenceVersion = `obs:${ctx.observationId}:rep:${changes}`;
  const { incident } = await upsertIncident({
    shopId: ctx.shopId,
    incidentKey,
    type: "REPEATED_CHANGES",
    ruleType: rule.ruleType,
    ruleVersion: rule.version,
    severity: changes >= minChanges * 2 ? "HIGH" : "MEDIUM",
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
    evidenceVersion,
    detectedAt: ctx.observedAt,
    evidenceType: "REPEATED_CHANGES",
    observationIds: [ctx.observationId],
    evidencePayload: {
      changeCount: changes,
      windowMinutes,
      minChanges,
      source: ctx.source,
    },
  });
  return incident;
}

async function evaluateReconciliationDiscrepancy(
  rule: DetectionRule,
  ctx: EvaluateObservationContext,
): Promise<Incident | null> {
  if (ctx.source !== "RECONCILIATION") return null;
  if (ctx.previousQuantity === null) return null;
  if (ctx.previousQuantity === ctx.quantity) return null;

  const config = parseConfig(rule.configuration);
  const incidentKey = buildIncidentKey({
    ruleType: rule.ruleType,
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
  });

  if (await wasRecentlyTouched(ctx.shopId, incidentKey, suppressionMinutes(config))) {
    return null;
  }

  const delta = absoluteDelta(ctx.previousQuantity, ctx.quantity)!;
  const evidenceVersion = `obs:${ctx.observationId}:recon:${delta}`;
  const { incident } = await upsertIncident({
    shopId: ctx.shopId,
    incidentKey,
    type: "RECONCILIATION_DISCREPANCY",
    ruleType: rule.ruleType,
    ruleVersion: rule.version,
    severity: delta >= 50 ? "HIGH" : "MEDIUM",
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
    evidenceVersion,
    detectedAt: ctx.observedAt,
    evidenceType: "RECONCILIATION_GAP",
    observationIds: [ctx.observationId],
    evidencePayload: {
      expectedFromLastObservation: ctx.previousQuantity,
      shopifyQuantity: ctx.quantity,
      absoluteDelta: delta,
    },
  });
  return incident;
}

async function evaluateRefillRisk(
  rule: DetectionRule,
  ctx: EvaluateObservationContext,
): Promise<Incident | null> {
  const config = parseConfig(rule.configuration);
  const shopThreshold = await getRefillThreshold(ctx.shopId);
  const threshold =
    config.absolute?.threshold ?? shopThreshold ?? DETECTION_DEFAULTS.refillThreshold;

  const atOrBelow = ctx.quantity <= threshold;
  if (!atOrBelow) return null;

  // Fire on already-low qty, or after a drop that lands at/below threshold
  const droppedInto =
    ctx.previousQuantity != null &&
    ctx.previousQuantity > threshold &&
    ctx.quantity <= threshold;
  const sharpDropLeavesLow =
    ctx.previousQuantity != null &&
    ctx.previousQuantity - ctx.quantity >= Math.max(1, Math.floor(threshold / 2)) &&
    ctx.quantity <= threshold;

  if (
    ctx.previousQuantity != null &&
    !droppedInto &&
    !sharpDropLeavesLow &&
    ctx.previousQuantity <= threshold
  ) {
    // Already-low and still low — allow first detection; suppress via window after
  }

  const incidentKey = buildIncidentKey({
    ruleType: rule.ruleType,
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
  });

  if (await wasRecentlyTouched(ctx.shopId, incidentKey, suppressionMinutes(config))) {
    return null;
  }

  const severity: IncidentSeverity =
    ctx.quantity <= 0
      ? "HIGH"
      : ctx.quantity <= Math.floor(threshold / 2)
        ? "MEDIUM"
        : "MEDIUM";

  const evidenceVersion = `obs:${ctx.observationId}:refill:${ctx.quantity}`;
  const { incident } = await upsertIncident({
    shopId: ctx.shopId,
    incidentKey,
    type: "REFILL_RISK",
    ruleType: rule.ruleType,
    ruleVersion: rule.version,
    severity,
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
    evidenceVersion,
    detectedAt: ctx.observedAt,
    evidenceType: "REFILL_SUGGESTION",
    observationIds: [ctx.observationId],
    evidencePayload: {
      previousQuantity: ctx.previousQuantity,
      currentQuantity: ctx.quantity,
      refillThreshold: threshold,
      absoluteDelta:
        ctx.previousQuantity != null
          ? Math.abs(ctx.quantity - ctx.previousQuantity)
          : null,
      droppedIntoThreshold: droppedInto,
      sharpDropLeavesLow,
      suggestion:
        "Review Shopify inventory and plan a refill — StockSentry will not change quantities.",
      source: ctx.source,
    },
  });
  return incident;
}

async function evaluateBundleComponentRisk(
  rule: DetectionRule,
  ctx: EvaluateObservationContext,
): Promise<Incident | null> {
  const memberships = await prisma.bundleGroupItem.findMany({
    where: {
      shopId: ctx.shopId,
      inventoryItemId: ctx.inventoryItemId,
      bundleGroup: { active: true },
    },
    include: {
      bundleGroup: {
        include: {
          items: { select: { inventoryItemId: true, role: true } },
        },
      },
    },
  });

  if (memberships.length === 0) return null;

  const openOnItem = await prisma.incident.count({
    where: {
      shopId: ctx.shopId,
      inventoryItemId: ctx.inventoryItemId,
      status: { in: ["NEW", "INVESTIGATING"] },
      ruleType: { not: "BUNDLE_COMPONENT_RISK" },
    },
  });
  if (openOnItem === 0) return null;

  const config = parseConfig(rule.configuration);
  const incidentKey = buildIncidentKey({
    ruleType: rule.ruleType,
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
  });

  if (await wasRecentlyTouched(ctx.shopId, incidentKey, suppressionMinutes(config))) {
    return null;
  }

  const groupNames = memberships.map((m) => m.bundleGroup.name);
  const evidenceVersion = `obs:${ctx.observationId}:bundle:${openOnItem}`;
  const { incident } = await upsertIncident({
    shopId: ctx.shopId,
    incidentKey,
    type: "BUNDLE_COMPONENT_RISK",
    ruleType: rule.ruleType,
    ruleVersion: rule.version,
    severity: "MEDIUM",
    inventoryItemId: ctx.inventoryItemId,
    locationId: ctx.locationId,
    evidenceVersion,
    detectedAt: ctx.observedAt,
    evidenceType: "BUNDLE_RISK",
    observationIds: [ctx.observationId],
    evidencePayload: {
      openIncidentsOnComponent: openOnItem,
      bundleGroups: groupNames,
    },
  });
  return incident;
}

export async function evaluateStaleMonitoring(shopId: string): Promise<Incident | null> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return null;

  const rule = await prisma.detectionRule.findUnique({
    where: {
      shopId_ruleType: { shopId, ruleType: "STALE_MONITORING" },
    },
  });
  if (!rule?.enabled) return null;

  const interval = shop.reconciliationIntervalHours || 6;
  const now = new Date();
  const last = shop.lastReconciledAt;
  if (!last) return null;
  const hours = (now.getTime() - last.getTime()) / (1000 * 60 * 60);
  if (hours <= interval * 2) return null;

  const config = parseConfig(rule.configuration);
  const incidentKey = `STALE_MONITORING:shop:${shopId}`;
  if (await wasRecentlyTouched(shopId, incidentKey, suppressionMinutes(config))) {
    return null;
  }

  // Use a sentinel item if none exist — shop-level stale needs nullable item
  const evidenceVersion = `stale:${last.toISOString()}`;
  const existing = await findOpenIncident(shopId, incidentKey);
  if (existing) {
    return prisma.incident.update({
      where: { id: existing.id },
      data: {
        lastDetectedAt: now,
        evidenceVersion,
      },
    });
  }

  const incident = await prisma.incident.create({
    data: {
      shopId,
      incidentKey,
      type: "STALE_MONITORING",
      severity: hours > interval * 4 ? "HIGH" : "MEDIUM",
      status: "NEW",
      ruleType: "STALE_MONITORING",
      ruleVersion: rule.version,
      evidenceVersion,
      firstDetectedAt: now,
      lastDetectedAt: now,
    },
  });

  await prisma.incidentEvidence.create({
    data: {
      shopId,
      incidentId: incident.id,
      evidenceType: "STALE_MONITORING",
      observationIds: [],
      evidencePayload: {
        lastReconciledAt: last.toISOString(),
        hoursSinceReconcile: hours,
        intervalHours: interval,
      },
    },
  });

  return incident;
}

/**
 * Evaluate enabled detection rules against a new observation.
 * Returns incidents touched (created or updated).
 */
async function ensureRefillRule(shopId: string): Promise<void> {
  const configs = defaultRuleConfigurations();
  const def = configs.REFILL_RISK;
  await prisma.detectionRule.upsert({
    where: { shopId_ruleType: { shopId, ruleType: "REFILL_RISK" } },
    create: {
      shopId,
      ruleType: "REFILL_RISK",
      enabled: def.enabled,
      configuration: def.configuration as Prisma.InputJsonValue,
      version: def.version,
    },
    update: {},
  });
}

export async function evaluateObservation(
  ctx: EvaluateObservationContext,
): Promise<Incident[]> {
  await ensureRefillRule(ctx.shopId).catch(() => undefined);

  const rules = await prisma.detectionRule.findMany({
    where: { shopId: ctx.shopId, enabled: true },
  });

  const touched: Incident[] = [];

  for (const rule of rules) {
    let result: Incident | null = null;
    switch (rule.ruleType) {
      case "LARGE_ABSOLUTE_CHANGE":
        result = await evaluateAbsolute(rule, ctx);
        break;
      case "LARGE_PERCENTAGE_CHANGE":
        result = await evaluatePercentage(rule, ctx);
        break;
      case "REPEATED_CHANGES":
        result = await evaluateRepeated(rule, ctx);
        break;
      case "RECONCILIATION_DISCREPANCY":
        result = await evaluateReconciliationDiscrepancy(rule, ctx);
        break;
      case "BUNDLE_COMPONENT_RISK":
        result = await evaluateBundleComponentRisk(rule, ctx);
        break;
      case "REFILL_RISK":
        result = await evaluateRefillRisk(rule, ctx);
        break;
      default:
        break;
    }
    if (result) touched.push(result);
  }

  return touched;
}
