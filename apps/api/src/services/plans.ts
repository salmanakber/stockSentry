import { prisma, type Plan } from "@stocksentry/database";
import {
  PLAN_ENTITLEMENTS,
  clearPlanEntitlementsCache,
  getPlanEntitlements,
  getStaticPlanEntitlements,
  registerPlanEntitlementsLoader,
  type PlanEntitlements,
} from "@stocksentry/shared";

function planRowToEntitlements(row: Plan): PlanEntitlements {
  return {
    slug: row.slug,
    displayName: row.displayName,
    description: row.description,
    priceUsdMonthly: Number(row.priceUsdMonthly),
    trialDays: row.trialDays,
    maxMonitoredItems: row.maxMonitoredItems,
    historyDays: row.historyDays,
    maxOpenIncidents: row.maxOpenIncidents,
    aiReportsPerMonth: row.aiReportsPerMonth,
    advancedRules: row.advancedRules,
    exportsEnabled: row.exportsEnabled,
    teamWorkflows: row.teamWorkflows,
    isFree: row.isFree,
    active: row.active,
    sortOrder: row.sortOrder,
    planId: row.id,
  };
}

async function loadPlanFromDb(slug: string): Promise<PlanEntitlements | null> {
  const row = await prisma.plan.findUnique({ where: { slug } });
  if (!row || !row.active) return null;
  return planRowToEntitlements(row);
}

let loaderRegistered = false;

/** Register DB plan loader once (idempotent). Call at API boot. */
export function registerDbPlanLoader(): void {
  if (loaderRegistered) return;
  registerPlanEntitlementsLoader(loadPlanFromDb);
  loaderRegistered = true;
}

/**
 * Resolve plan entitlements from Plan table (cached via getPlanEntitlements)
 * with static PLAN_ENTITLEMENTS fallback.
 */
export async function resolvePlan(slug: string): Promise<PlanEntitlements> {
  registerDbPlanLoader();
  return getPlanEntitlements(slug || "free");
}

/** Ensure free/starter/pro/growth rows exist from static defaults (migrate/boot). */
export async function ensureDefaultPlans(): Promise<void> {
  const seeds = Object.values(PLAN_ENTITLEMENTS);
  for (const plan of seeds) {
    const data = {
      displayName: plan.displayName,
      description: plan.description ?? null,
      priceUsdMonthly: plan.priceUsdMonthly,
      trialDays: plan.trialDays ?? 0,
      maxMonitoredItems: plan.maxMonitoredItems,
      historyDays: plan.historyDays,
      maxOpenIncidents: plan.maxOpenIncidents,
      aiReportsPerMonth: plan.aiReportsPerMonth,
      advancedRules: plan.advancedRules,
      exportsEnabled: plan.exportsEnabled,
      teamWorkflows: plan.teamWorkflows,
      isFree: plan.isFree ?? plan.priceUsdMonthly <= 0,
      active: plan.active ?? true,
      sortOrder: plan.sortOrder ?? 0,
    };
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: {
        slug: plan.slug,
        ...data,
      },
      update: data,
    });
  }
  clearPlanEntitlementsCache();
}

export async function listActivePlans(): Promise<PlanEntitlements[]> {
  const rows = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  if (rows.length === 0) {
    return Object.values(PLAN_ENTITLEMENTS);
  }
  return rows.map(planRowToEntitlements);
}

export async function findPlanBySlug(slug: string): Promise<Plan | null> {
  return prisma.plan.findUnique({ where: { slug } });
}

/** Sync planSlug + planId on Shop (compat). */
export async function assignShopPlan(input: {
  shopId: string;
  planSlug: string;
  planAssignedByAdmin?: boolean;
  billingStatus?: "NONE" | "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "FROZEN";
  clearShopifySubscription?: boolean;
}) {
  const plan =
    (await findPlanBySlug(input.planSlug)) ??
    (input.planSlug === "free"
      ? null
      : await findPlanBySlug("free"));

  const slug = plan?.slug ?? getStaticPlanEntitlements(input.planSlug).slug;

  return prisma.shop.update({
    where: { id: input.shopId },
    data: {
      planSlug: slug,
      planId: plan?.id ?? null,
      planAssignedByAdmin: input.planAssignedByAdmin ?? false,
      requiresPlanSelection: false,
      ...(input.billingStatus ? { billingStatus: input.billingStatus } : {}),
      ...(input.clearShopifySubscription
        ? { shopifySubscriptionGid: null }
        : {}),
    },
  });
}

export { planRowToEntitlements };
