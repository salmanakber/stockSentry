import {
  prisma,
  type AiReport,
  type Prisma,
} from "@stocksentry/database";
import {
  AI_DEFAULTS,
  AI_SYSTEM_PROMPT,
  ENTITLEMENT_ERROR_CODES,
  aiReportOutputSchema,
  canGenerateAiReport,
  fallbackAiReport,
  getPlanEntitlements,
  requireShopId,
  type AiReportOutput,
} from "@stocksentry/shared";
import { EntitlementError } from "./billing.js";

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
  const plan = getPlanEntitlements(shop.planSlug);
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

async function callOpenAi(
  evidencePackage: unknown,
): Promise<{ output: AiReportOutput; inputTokens?: number; outputTokens?: number }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_NOT_SET");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Explain this inventory incident using only the evidence JSON.\n\n${JSON.stringify(evidencePackage)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OPENAI_HTTP_${res.status}:${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OPENAI_EMPTY_CONTENT");

  const raw = JSON.parse(content) as unknown;
  const parsed = aiReportOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("OPENAI_SCHEMA_INVALID");
  }

  return {
    output: parsed.data,
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
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
    const { output, inputTokens, outputTokens } =
      await callOpenAi(evidencePackage);
    const validated = aiReportOutputSchema.parse({
      ...output,
      evidence_version: evidenceVersion,
    });

    const updated = await prisma.aiReport.update({
      where: { id: reportId },
      data: {
        status: "GENERATED",
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

    return prisma.aiReport.update({
      where: { id: reportId },
      data: {
        status: code.includes("OPENAI_API_KEY") ? "FAILED" : "GENERATED",
        outputJson: fallback as unknown as Prisma.InputJsonValue,
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
