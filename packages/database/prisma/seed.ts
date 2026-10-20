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
    isFree: true,
    active: true,
    sortOrder: 0,
  },
  {
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
    isFree: false,
    active: true,
    sortOrder: 1,
  },
  {
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
    isFree: false,
    active: true,
    sortOrder: 2,
  },
  {
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
    isFree: false,
    active: true,
    sortOrder: 3,
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
