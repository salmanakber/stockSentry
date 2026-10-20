import { z } from "zod";
import { AI_DEFAULTS } from "./defaults.js";

export const PLAN_SLUGS = ["free", "starter", "pro"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export const planSlugSchema = z.enum(PLAN_SLUGS);

export type PlanEntitlements = {
  slug: PlanSlug;
  displayName: string;
  /** Recurring USD price hypothesis for Shopify Billing stubs. Free = 0. */
  priceUsdMonthly: number;
  maxMonitoredItems: number;
  historyDays: number;
  maxOpenIncidents: number;
  aiReportsPerMonth: number;
  advancedRules: boolean;
  exportsEnabled: boolean;
  teamWorkflows: boolean;
};

/** Clear server-side entitlement error codes for API/UI handling. */
export const ENTITLEMENT_ERROR_CODES = {
  AI_QUOTA_EXCEEDED: "ENTITLEMENT_AI_QUOTA_EXCEEDED",
  MONITORED_ITEMS_EXCEEDED: "ENTITLEMENT_MONITORED_ITEMS_EXCEEDED",
  EXPORTS_NOT_ENABLED: "ENTITLEMENT_EXPORTS_NOT_ENABLED",
  INVALID_PLAN: "ENTITLEMENT_INVALID_PLAN",
} as const;

export const PLAN_ENTITLEMENTS: Record<PlanSlug, PlanEntitlements> = {
  free: {
    slug: "free",
    displayName: "Free / Trial",
    priceUsdMonthly: 0,
    maxMonitoredItems: 100,
    historyDays: 14,
    maxOpenIncidents: 25,
    aiReportsPerMonth: 5,
    advancedRules: false,
    exportsEnabled: false,
    teamWorkflows: false,
  },
  starter: {
    slug: "starter",
    displayName: "Starter",
    priceUsdMonthly: 19,
    maxMonitoredItems: 1000,
    historyDays: 90,
    maxOpenIncidents: 200,
    aiReportsPerMonth: AI_DEFAULTS.monthlyReportLimit,
    advancedRules: false,
    exportsEnabled: true,
    teamWorkflows: false,
  },
  pro: {
    slug: "pro",
    displayName: "Pro",
    priceUsdMonthly: 49,
    maxMonitoredItems: 10000,
    historyDays: 365,
    maxOpenIncidents: 2000,
    aiReportsPerMonth: 500,
    advancedRules: true,
    exportsEnabled: true,
    teamWorkflows: true,
  },
};

export function getPlanEntitlements(slug: string): PlanEntitlements {
  if (slug in PLAN_ENTITLEMENTS) {
    return PLAN_ENTITLEMENTS[slug as PlanSlug];
  }
  return PLAN_ENTITLEMENTS.free;
}

export function canGenerateAiReport(
  planSlug: string,
  usedThisMonth: number,
  overrideLimit?: number,
): boolean {
  const plan = getPlanEntitlements(planSlug);
  const limit = overrideLimit ?? plan.aiReportsPerMonth;
  return usedThisMonth < limit;
}
