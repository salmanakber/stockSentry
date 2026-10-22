import { z } from "zod";

export const PLAN_SLUGS = ["free", "starter", "pro", "growth"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export const planSlugSchema = z.enum(PLAN_SLUGS);

export type PlanEntitlements = {
  slug: string;
  displayName: string;
  description?: string | null;
  /** Recurring USD price hypothesis for Shopify Billing stubs. Free = 0. */
  priceUsdMonthly: number;
  trialDays?: number;
  maxMonitoredItems: number;
  historyDays: number;
  maxOpenIncidents: number;
  aiReportsPerMonth: number;
  advancedRules: boolean;
  exportsEnabled: boolean;
  teamWorkflows: boolean;
  /** Auto-email / replenishment automation for suppliers. */
  supplierAutomation: boolean;
  maxBundleGroups: number;
  maxSuppliers: number;
  isFree?: boolean;
  active?: boolean;
  sortOrder?: number;
  /** Set when loaded from Plan table. */
  planId?: string;
};

/** Clear server-side entitlement error codes for API/UI handling. */
export const ENTITLEMENT_ERROR_CODES = {
  AI_QUOTA_EXCEEDED: "ENTITLEMENT_AI_QUOTA_EXCEEDED",
  MONITORED_ITEMS_EXCEEDED: "ENTITLEMENT_MONITORED_ITEMS_EXCEEDED",
  EXPORTS_NOT_ENABLED: "ENTITLEMENT_EXPORTS_NOT_ENABLED",
  INVALID_PLAN: "ENTITLEMENT_INVALID_PLAN",
  BUNDLE_GROUPS_EXCEEDED: "ENTITLEMENT_BUNDLE_GROUPS_EXCEEDED",
  SUPPLIERS_EXCEEDED: "ENTITLEMENT_SUPPLIERS_EXCEEDED",
  SUPPLIER_AUTOMATION_REQUIRED: "ENTITLEMENT_SUPPLIER_AUTOMATION_REQUIRED",
  ADVANCED_RULES_REQUIRED: "ENTITLEMENT_ADVANCED_RULES_REQUIRED",
  HISTORY_RANGE_EXCEEDED: "ENTITLEMENT_HISTORY_RANGE_EXCEEDED",
} as const;

/** Rule types that require `advancedRules` entitlement to enable. */
export const ADVANCED_RULE_TYPES = [
  "REPEATED_CHANGES",
  "STALE_MONITORING",
  "BUNDLE_COMPONENT_RISK",
  "CUSTOM_THRESHOLD",
] as const;

export const PLAN_ENTITLEMENTS: Record<PlanSlug, PlanEntitlements> = {
  free: {
    slug: "free",
    displayName: "Free",
    description:
      "Try Bundle Safety on a small catalog — monitoring, basic alerts, limited AI.",
    priceUsdMonthly: 0,
    trialDays: 0,
    maxMonitoredItems: 75,
    historyDays: 7,
    maxOpenIncidents: 15,
    aiReportsPerMonth: 3,
    advancedRules: false,
    exportsEnabled: false,
    teamWorkflows: false,
    supplierAutomation: false,
    maxBundleGroups: 2,
    maxSuppliers: 1,
    isFree: true,
    active: true,
    sortOrder: 0,
  },
  starter: {
    slug: "starter",
    displayName: "Starter",
    description:
      "For growing stores — more items, CSV exports, and monthly AI incident reports.",
    priceUsdMonthly: 14.99,
    trialDays: 14,
    maxMonitoredItems: 500,
    historyDays: 60,
    maxOpenIncidents: 100,
    aiReportsPerMonth: 40,
    advancedRules: false,
    exportsEnabled: true,
    teamWorkflows: false,
    supplierAutomation: false,
    maxBundleGroups: 10,
    maxSuppliers: 5,
    isFree: false,
    active: true,
    sortOrder: 1,
  },
  pro: {
    slug: "pro",
    displayName: "Pro",
    description:
      "Advanced detection rules, team workflows, and deeper history for serious ops teams.",
    priceUsdMonthly: 39.99,
    trialDays: 14,
    maxMonitoredItems: 5000,
    historyDays: 180,
    maxOpenIncidents: 1000,
    aiReportsPerMonth: 200,
    advancedRules: true,
    exportsEnabled: true,
    teamWorkflows: true,
    supplierAutomation: true,
    maxBundleGroups: 50,
    maxSuppliers: 25,
    isFree: false,
    active: true,
    sortOrder: 2,
  },
  growth: {
    slug: "growth",
    displayName: "Growth",
    description:
      "High-volume catalogs and multi-location merchants who need scale.",
    priceUsdMonthly: 99,
    trialDays: 14,
    maxMonitoredItems: 50000,
    historyDays: 365,
    maxOpenIncidents: 10000,
    aiReportsPerMonth: 1000,
    advancedRules: true,
    exportsEnabled: true,
    teamWorkflows: true,
    supplierAutomation: true,
    maxBundleGroups: 500,
    maxSuppliers: 200,
    isFree: false,
    active: true,
    sortOrder: 3,
  },
};

/** Sync static fallback — use when DB is unavailable. */
export function getStaticPlanEntitlements(slug: string): PlanEntitlements {
  if (slug in PLAN_ENTITLEMENTS) {
    return PLAN_ENTITLEMENTS[slug as PlanSlug];
  }
  return PLAN_ENTITLEMENTS.free;
}

type PlanEntitlementsLoader = (
  slug: string,
) => Promise<PlanEntitlements | null>;

let planLoader: PlanEntitlementsLoader | null = null;
const planCache = new Map<string, { at: number; value: PlanEntitlements }>();
const PLAN_CACHE_TTL_MS = 60_000;

/** API registers a DB-backed loader at boot. */
export function registerPlanEntitlementsLoader(
  loader: PlanEntitlementsLoader,
): void {
  planLoader = loader;
  planCache.clear();
}

export function clearPlanEntitlementsCache(): void {
  planCache.clear();
}

/**
 * Async entitlements lookup: in-memory cache → registered DB loader → static PLAN_ENTITLEMENTS.
 */
export async function getPlanEntitlements(
  slug: string,
): Promise<PlanEntitlements> {
  const key = (slug || "free").toLowerCase();
  const cached = planCache.get(key);
  if (cached && Date.now() - cached.at < PLAN_CACHE_TTL_MS) {
    return cached.value;
  }

  if (planLoader) {
    try {
      const fromDb = await planLoader(key);
      if (fromDb) {
        planCache.set(key, { at: Date.now(), value: fromDb });
        return fromDb;
      }
    } catch {
      // fall through to static
    }
  }

  const fallback = getStaticPlanEntitlements(key);
  planCache.set(key, { at: Date.now(), value: fallback });
  return fallback;
}

export function canGenerateAiReport(
  planSlug: string,
  usedThisMonth: number,
  overrideLimit?: number,
): boolean {
  const plan = getStaticPlanEntitlements(planSlug);
  const limit = overrideLimit ?? plan.aiReportsPerMonth;
  return usedThisMonth < limit;
}

export async function canGenerateAiReportAsync(
  planSlug: string,
  usedThisMonth: number,
  overrideLimit?: number,
): Promise<boolean> {
  const plan = await getPlanEntitlements(planSlug);
  const limit = overrideLimit ?? plan.aiReportsPerMonth;
  return usedThisMonth < limit;
}
