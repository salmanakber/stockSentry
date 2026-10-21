import {
  prisma,
  type Prisma,
  type ProductReport,
} from "@stocksentry/database";
import {
  AI_DEFAULTS,
  ENTITLEMENT_ERROR_CODES,
  aiReportOutputSchema,
  canGenerateAiReport,
  fallbackAiReport,
  requireShopId,
} from "@stocksentry/shared";
import { EntitlementError } from "./billing.js";
import { generateWithFallback } from "./ai-providers.js";
import { resolvePlan } from "./plans.js";

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function ensureMonthlyQuota(shopId: string): Promise<{
  used: number;
  limit: number;
  planSlug: string;
  allowed: boolean;
}> {
  const id = requireShopId(shopId);
  const shop = await prisma.shop.findUniqueOrThrow({ where: { id } });
  const key = monthKey();
  let used = shop.aiReportsUsedMonth;
  if (shop.aiReportsMonthKey !== key) {
    await prisma.shop.update({
      where: { id },
      data: { aiReportsUsedMonth: 0, aiReportsMonthKey: key },
    });
    used = 0;
  }

  const settings = await prisma.shopSettings.findUnique({
    where: { shopId: id },
  });
  const aiSettings = (settings?.ai ?? {}) as { monthlyReportLimit?: number };
  const plan = await resolvePlan(shop.planSlug);
  const limit = aiSettings.monthlyReportLimit ?? plan.aiReportsPerMonth;
  const allowed = canGenerateAiReport(shop.planSlug, used, limit);
  return { used, limit, planSlug: shop.planSlug, allowed };
}

export async function buildProductEvidencePackage(
  shopId: string,
  inventoryItemId: string,
) {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const item = await prisma.inventoryItem.findFirstOrThrow({
    where: { id: inventoryItemId, shopId, deletedAt: null },
  });

  const [observations, incidents, locations] = await Promise.all([
    prisma.inventoryObservation.findMany({
      where: { shopId, inventoryItemId },
      orderBy: { observedAt: "desc" },
      take: 40,
      include: { location: { select: { name: true } } },
    }),
    prisma.incident.findMany({
      where: { shopId, inventoryItemId },
      orderBy: { lastDetectedAt: "desc" },
      take: 20,
      include: {
        location: { select: { name: true } },
        evidence: { orderBy: { createdAt: "desc" }, take: 3 },
      },
    }),
    prisma.inventoryLocation.findMany({
      where: { shopId, active: true },
      select: { id: true, name: true },
    }),
  ]);

  // Latest qty per location
  const latestByLocation = new Map<
    string,
    { locationName: string; quantity: number; observedAt: string }
  >();
  for (const obs of observations) {
    if (latestByLocation.has(obs.locationId)) continue;
    latestByLocation.set(obs.locationId, {
      locationName: obs.location.name,
      quantity: obs.quantity,
      observedAt: obs.observedAt.toISOString(),
    });
  }

  let absDeltaSum30d = 0;
  const chron = [...observations].reverse();
  const prevByLoc = new Map<string, number>();
  for (const obs of chron) {
    if (obs.observedAt < since30d) {
      prevByLoc.set(obs.locationId, obs.quantity);
      continue;
    }
    const prev = prevByLoc.get(obs.locationId);
    if (prev != null) absDeltaSum30d += Math.abs(obs.quantity - prev);
    prevByLoc.set(obs.locationId, obs.quantity);
  }

  const evidenceVersion = `product:${item.id}:${observations[0]?.id ?? "none"}:${incidents[0]?.evidenceVersion ?? "none"}`;

  return {
    evidenceVersion,
    kind: "product_risk" as const,
    item: {
      id: item.id,
      productTitle: item.productTitle,
      variantTitle: item.variantTitle,
      sku: item.sku,
      tracked: item.tracked,
    },
    locations: locations.map((l) => ({
      id: l.id,
      name: l.name,
      latest: latestByLocation.get(l.id) ?? null,
    })),
    stats: {
      incidentCount30d: incidents.filter((i) => i.firstDetectedAt >= since30d)
        .length,
      absDeltaSum30d,
      openIncidents: incidents.filter((i) =>
        ["NEW", "INVESTIGATING"].includes(i.status),
      ).length,
      lastChangeAt: observations[0]?.observedAt.toISOString() ?? null,
    },
    recentObservations: observations.slice(0, 15).map((o) => ({
      quantity: o.quantity,
      observedAt: o.observedAt.toISOString(),
      source: o.source,
      location: o.location.name,
    })),
    incidents: incidents.slice(0, 10).map((i) => ({
      id: i.id,
      type: i.type,
      severity: i.severity,
      status: i.status,
      ruleType: i.ruleType,
      lastDetectedAt: i.lastDetectedAt.toISOString(),
      location: i.location?.name ?? null,
      evidence: i.evidence.map((e) => ({
        type: e.evidenceType,
        payload: e.evidencePayload,
      })),
    })),
  };
}

export async function enqueueProductReport(input: {
  shopId: string;
  inventoryItemId: string;
}): Promise<ProductReport> {
  const shopId = requireShopId(input.shopId);
  const evidence = await buildProductEvidencePackage(
    shopId,
    input.inventoryItemId,
  );

  const quota = await ensureMonthlyQuota(shopId);
  if (!quota.allowed) {
    throw new EntitlementError(
      ENTITLEMENT_ERROR_CODES.AI_QUOTA_EXCEEDED,
      `AI report quota exceeded for plan ${quota.planSlug} (${quota.used}/${quota.limit} this month).`,
    );
  }

  return prisma.productReport.upsert({
    where: {
      shopId_inventoryItemId_evidenceVersion: {
        shopId,
        inventoryItemId: input.inventoryItemId,
        evidenceVersion: evidence.evidenceVersion,
      },
    },
    create: {
      shopId,
      inventoryItemId: input.inventoryItemId,
      evidenceVersion: evidence.evidenceVersion,
      status: "QUEUED",
      provider: AI_DEFAULTS.provider,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    },
    update: {
      status: "QUEUED",
      errorCode: null,
    },
  });
}

export async function generateProductReport(
  reportId: string,
): Promise<ProductReport> {
  const report = await prisma.productReport.findUniqueOrThrow({
    where: { id: reportId },
  });

  const quota = await ensureMonthlyQuota(report.shopId);
  if (!quota.allowed) {
    return prisma.productReport.update({
      where: { id: reportId },
      data: {
        status: "FAILED",
        errorCode: ENTITLEMENT_ERROR_CODES.AI_QUOTA_EXCEEDED,
      },
    });
  }

  const evidencePackage = await buildProductEvidencePackage(
    report.shopId,
    report.inventoryItemId,
  );
  const evidenceVersion = evidencePackage.evidenceVersion;

  try {
    const { output, inputTokens, outputTokens, provider, model } =
      await generateWithFallback(evidencePackage);

    const validated = aiReportOutputSchema.parse({
      ...output,
      evidence_version: evidenceVersion,
    });

    const updated = await prisma.productReport.update({
      where: { id: reportId },
      data: {
        status: "GENERATED",
        provider,
        model,
        summaryJson: validated as unknown as Prisma.InputJsonValue,
        generatedAt: new Date(),
        evidenceVersion,
        errorCode: null,
      },
    });

    await prisma.shop.update({
      where: { id: report.shopId },
      data: {
        aiReportsUsedMonth: { increment: 1 },
        aiReportsMonthKey: monthKey(),
      },
    });

    // silence unused — tokens tracked for parity with incident reports
    void inputTokens;
    void outputTokens;

    return updated;
  } catch (err) {
    const code =
      err instanceof Error ? err.message.slice(0, 64) : "AI_GENERATION_FAILED";
    const fallback = fallbackAiReport(evidenceVersion);
    const noKeys =
      code.includes("ALL_AI_PROVIDERS_FAILED") ||
      code.includes("not configured");

    // Product-specific fallback copy
    const productFallback = {
      ...fallback,
      title: "Product risk summary unavailable",
      summary:
        "A deterministic product risk summary was used because AI generation did not complete.",
      why_flagged:
        "This report is based only on this product's observations and incidents.",
      _fallback: true,
    };

    return prisma.productReport.update({
      where: { id: reportId },
      data: {
        status: noKeys ? "FAILED" : "GENERATED",
        provider: "fallback",
        model: "deterministic",
        summaryJson: productFallback as unknown as Prisma.InputJsonValue,
        errorCode: code,
        generatedAt: new Date(),
        evidenceVersion,
      },
    });
  }
}
