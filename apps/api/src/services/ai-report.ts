import {
  prisma,
  type AiReport,
  type Prisma,
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

export async function buildEvidencePackage(incidentId: string) {
  const incident = await prisma.incident.findUniqueOrThrow({
    where: { id: incidentId },
    include: {
      inventoryItem: true,
      location: true,
      evidence: { orderBy: { createdAt: "asc" }, take: 20 },
      notes: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  return {
    evidenceVersion: incident.evidenceVersion,
    incident: {
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      status: incident.status,
      ruleType: incident.ruleType,
      ruleVersion: incident.ruleVersion,
      firstDetectedAt: incident.firstDetectedAt.toISOString(),
      lastDetectedAt: incident.lastDetectedAt.toISOString(),
    },
    item: incident.inventoryItem
      ? {
          productTitle: incident.inventoryItem.productTitle,
          variantTitle: incident.inventoryItem.variantTitle,
          sku: incident.inventoryItem.sku,
        }
      : null,
    location: incident.location
      ? { name: incident.location.name }
      : null,
    evidence: incident.evidence.map((e) => ({
      type: e.evidenceType,
      payload: e.evidencePayload,
      observationIds: e.observationIds,
      createdAt: e.createdAt.toISOString(),
    })),
    notes: incident.notes.map((n) => ({
      content: n.content,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

export async function enqueueAiReport(input: {
  shopId: string;
  incidentId: string;
}): Promise<AiReport> {
  const shopId = requireShopId(input.shopId);
  const incident = await prisma.incident.findFirstOrThrow({
    where: { id: input.incidentId, shopId },
  });

  const quota = await ensureMonthlyQuota(shopId);
  if (!quota.allowed) {
    throw new EntitlementError(
      ENTITLEMENT_ERROR_CODES.AI_QUOTA_EXCEEDED,
      `AI report quota exceeded for plan ${quota.planSlug} (${quota.used}/${quota.limit} this month).`,
    );
  }

  return prisma.aiReport.upsert({
    where: {
      shopId_incidentId_evidenceVersion: {
        shopId,
        incidentId: incident.id,
        evidenceVersion: incident.evidenceVersion,
      },
    },
    create: {
      shopId,
      incidentId: incident.id,
      evidenceVersion: incident.evidenceVersion,
      provider: AI_DEFAULTS.provider,
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      promptVersion: AI_DEFAULTS.promptVersion,
      status: "QUEUED",
    },
    update: {
      status: "QUEUED",
      errorCode: null,
    },
  });
}

export async function generateAiReport(reportId: string): Promise<AiReport> {
  const report = await prisma.aiReport.findUniqueOrThrow({
    where: { id: reportId },
  });

  const quota = await ensureMonthlyQuota(report.shopId);
  if (!quota.allowed) {
    return prisma.aiReport.update({
      where: { id: reportId },
      data: {
        status: "FAILED",
        errorCode: ENTITLEMENT_ERROR_CODES.AI_QUOTA_EXCEEDED,
      },
    });
  }

  const evidencePackage = await buildEvidencePackage(report.incidentId);
  const evidenceVersion = evidencePackage.evidenceVersion;

  try {
    const {
      output,
      inputTokens,
      outputTokens,
      provider,
      model,
    } = await generateWithFallback(evidencePackage);

    const validated = aiReportOutputSchema.parse({
      ...output,
      evidence_version: evidenceVersion,
    });

    const updated = await prisma.aiReport.update({
      where: { id: reportId },
      data: {
        status: "GENERATED",
        provider,
        model,
        outputJson: validated as unknown as Prisma.InputJsonValue,
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
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

    return updated;
  } catch (err) {
    const code =
      err instanceof Error ? err.message.slice(0, 64) : "AI_GENERATION_FAILED";
    const fallback = fallbackAiReport(evidenceVersion);
    const noKeys =
      code.includes("ALL_AI_PROVIDERS_FAILED") ||
      code.includes("not configured");

    return prisma.aiReport.update({
      where: { id: reportId },
      data: {
        status: noKeys ? "FAILED" : "GENERATED",
        provider: "fallback",
        model: "deterministic",
        outputJson: {
          ...fallback,
          _fallback: true,
        } as unknown as Prisma.InputJsonValue,
        errorCode: code,
        generatedAt: new Date(),
        evidenceVersion,
      },
    });
  }
}

export async function aiReportUsageSummary(shopId: string) {
  const quota = await ensureMonthlyQuota(shopId);
  const [generated, queued, stale, failed] = await Promise.all([
    prisma.aiReport.count({ where: { shopId, status: "GENERATED" } }),
    prisma.aiReport.count({ where: { shopId, status: "QUEUED" } }),
    prisma.aiReport.count({ where: { shopId, status: "STALE" } }),
    prisma.aiReport.count({ where: { shopId, status: "FAILED" } }),
  ]);

  return {
    used: quota.used,
    limit: quota.limit,
    generated,
    queued,
    stale,
    failed,
  };
}
