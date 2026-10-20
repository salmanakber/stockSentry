/**
 * Seeds DB-driven plans from static PLAN_ENTITLEMENTS values.
 * Run: `npx prisma db seed` (from packages/database) or via migrate.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Mirrors packages/shared PLAN_ENTITLEMENTS — keep in sync on seed. */
const PLAN_SEEDS = [
  {
    slug: "free",
    displayName: "Free / Trial",
    description: "Free trial plan with limited monitoring.",
    priceUsdMonthly: 0,
    trialDays: 0,
    maxMonitoredItems: 100,
    historyDays: 14,
    maxOpenIncidents: 25,
    aiReportsPerMonth: 5,
    advancedRules: false,
    exportsEnabled: false,
    teamWorkflows: false,
    isFree: true,
    active: true,
    sortOrder: 0,
  },
  {
    slug: "starter",
    displayName: "Starter",
    description: "Starter plan for growing merchants.",
    priceUsdMonthly: 19,
    trialDays: 7,
    maxMonitoredItems: 1000,
    historyDays: 90,
    maxOpenIncidents: 200,
    aiReportsPerMonth: 50,
    advancedRules: false,
    exportsEnabled: true,
    teamWorkflows: false,
    isFree: false,
    active: true,
    sortOrder: 1,
  },
  {
    slug: "pro",
    displayName: "Pro",
    description: "Pro plan with advanced rules and team workflows.",
    priceUsdMonthly: 49,
    trialDays: 7,
    maxMonitoredItems: 10000,
    historyDays: 365,
    maxOpenIncidents: 2000,
    aiReportsPerMonth: 500,
    advancedRules: true,
    exportsEnabled: true,
    teamWorkflows: true,
    isFree: false,
    active: true,
    sortOrder: 2,
  },
] as const;

async function ensurePlans() {
  for (const plan of PLAN_SEEDS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: { ...plan },
      update: {
        displayName: plan.displayName,
        description: plan.description,
        priceUsdMonthly: plan.priceUsdMonthly,
        trialDays: plan.trialDays,
        maxMonitoredItems: plan.maxMonitoredItems,
        historyDays: plan.historyDays,
        maxOpenIncidents: plan.maxOpenIncidents,
        aiReportsPerMonth: plan.aiReportsPerMonth,
        advancedRules: plan.advancedRules,
        exportsEnabled: plan.exportsEnabled,
        teamWorkflows: plan.teamWorkflows,
        isFree: plan.isFree,
        active: plan.active,
        sortOrder: plan.sortOrder,
      },
    });
  }
  console.log(`[seed] upserted ${PLAN_SEEDS.length} plans`);
}

async function main() {
  await ensurePlans();
}

main()
  .catch((err) => {
    console.error("[seed] failed", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
