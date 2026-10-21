import type { OverviewResponse, IncidentRow } from "./types";

/** Design-QA sample payload — only used when `?demo=1`. Never used for live metrics. */
export const DEMO_OVERVIEW: OverviewResponse = {
  shop: "northwind-home.myshopify.com",
  shopDisplay: "northwind-home",
  dateRangeLabel: "Oct 7 – Oct 20, 2026 · last 14 days · sample data",
  monitoring: {
    status: "healthy",
    lastReconciliation: "14 min ago",
    nextReconciliation: "in 5 h 46 m",
    lastWebhook: "38 s ago",
    sources: [
      { label: "Webhook", pct: 71, color: "var(--acc)" },
      { label: "Inventory verification", pct: 19, color: "#2b6cb0" },
      { label: "API read", pct: 8, color: "#c2680a" },
      { label: "Baseline", pct: 2, color: "#98a2b3" },
    ],
  },
  kpis: [
    {
      label: "New incidents",
      value: 4,
      subtitle: "awaiting first review",
      color: "var(--hot)",
      sparkline: [1, 2, 2, 3, 2, 3, 4],
      stroke: "var(--hot)",
    },
    {
      label: "Unresolved",
      value: 12,
      subtitle: "4 new · 8 investigating",
      color: "var(--warn)",
      sparkline: [7, 8, 8, 9, 10, 11, 12],
      stroke: "var(--warn)",
    },
    {
      label: "High priority",
      value: 3,
      subtitle: "1 detected in the last hour",
      color: "var(--hot)",
      sparkline: [1, 1, 2, 1, 2, 2, 3],
      stroke: "var(--hot)",
    },
    {
      label: "Monitored items",
      value: 1284,
      subtitle: "across 3 active locations",
      color: "var(--acc)",
      sparkline: [1210, 1224, 1240, 1251, 1262, 1274, 1284],
      stroke: "var(--acc)",
    },
  ],
  trend: Array.from({ length: 14 }, (_, i) => ({
    date: `2026-10-${String(7 + i).padStart(2, "0")}`,
    label: `Oct ${7 + i}`,
    detected: [2, 3, 4, 3, 3, 2, 3, 4, 3, 3, 4, 3, 5, 3][i]!,
    closed: [2, 2, 3, 2, 2, 3, 1, 3, 3, 2, 2, 3, 2, 3][i]!,
  })),
  recentIncidents: null, // filled from DEMO_INCIDENTS
  reviewOutcomes: {
    resolved: 21,
    dismissed: 12,
    open: 12,
    detected: 45,
  },
  repeatIncidents: [
    { name: "Soy Wax Refill 250g", count: 4, pct: 100 },
    { name: "Linen Napkin 4-Pack", count: 3, pct: 75 },
    { name: "Ceramic Mug — Sage", count: 3, pct: 75 },
  ],
  bundleRisk: [
    {
      name: "Aurora Gift Collection",
      mapping: "Manual",
      components: [
        { name: "Candle Gift Set", atRisk: true },
        { name: "Linen Napkin 4-Pack", atRisk: true },
        { name: "Tea Light ×6" },
        { name: "Gift Wrap" },
        { name: "Ribbon" },
      ],
    },
    {
      name: "Spa Night Kit",
      mapping: "Integration-derived",
      components: [
        { name: "Bath Salts 200g", atRisk: true },
        { name: "Body Oil" },
        { name: "Face Mask" },
        { name: "Pouch" },
      ],
    },
  ],
  aiReports: {
    used: 18,
    limit: 50,
    generated: 14,
    queued: 1,
    stale: 2,
    failed: 1,
  },
  pipeline: [
    { icon: "zp", value: "4,126", label: "Webhooks received" },
    { icon: "sh", value: "4,126", label: "HMAC verified · 0 rejected" },
    { icon: "bu", value: "−318", label: "Duplicates removed" },
    { icon: "db", value: "3,808", label: "Observations stored" },
    { icon: "se", value: "3,808", label: "Rules evaluated" },
    { icon: "in", value: "21", label: "Incidents created or updated" },
    { icon: "no", value: "9", label: "Notifications sent" },
  ],
  plan: { name: "Starter trial", aiUsed: 18, aiLimit: 50 },
  badges: { incidents: 12, notifications: 3 },
  user: {
    initials: "NH",
    name: "northwind-home",
    role: "Owner · read-only access",
  },
};

export const DEMO_INCIDENTS: IncidentRow[] = [
  {
    id: "INC-0142",
    severity: "high",
    severityLabel: "High",
    title: "Aurora Candle Gift Set",
    subtitle: "AUR-CND-GS · Warehouse A",
    quantity: "148 → 61",
    quantityDelta: "−87 units",
    rule: "Large absolute change",
    ruleDetail: "v3 · ≥ 30 units",
    source: "webhook",
    status: "new",
    statusColor: "var(--hot)",
    detectedAt: "12 min ago",
    evidence: {
      confirmed:
        "2 observations from inventory_levels/update, 10:41 → 10:49. Prior quantity 148 was observed at 10:41.",
      unknown:
        "Whether a sale, transfer or manual adjustment caused the drop.",
      suggested:
        "Mapped to Aurora Gift Collection (manual). Review before the next bundle sync.",
    },
  },
  {
    id: "INC-0141",
    severity: "high",
    severityLabel: "High",
    title: "Linen Napkin 4-Pack — Natural",
    subtitle: "LIN-NPK-4N · Warehouse A",
    quantity: "214 → 96",
    quantityDelta: "−118 · −55%",
    rule: "Large % change",
    ruleDetail: "v2 · ≥ 50%, baseline ≥ 20",
    source: "reconciliation",
    status: "investigating",
    statusColor: "var(--warn)",
    detectedAt: "1 h ago",
    evidence: {
      confirmed:
        "Last webhook observation was 214 at 07:12. Inventory verification at 09:55 read 96 from Shopify.",
      unknown:
        "Every change between 07:12 and 09:55. This is an observed discrepancy, not a confirmed transition.",
      suggested:
        "Check the stock adjustment log and any transfer in Shopify for this window.",
    },
  },
  {
    id: "INC-0139",
    severity: "high",
    severityLabel: "High",
    title: "Bath Salts 200g",
    subtitle: "SPA-BSL-200 · Warehouse B",
    quantity: "92 → 46",
    quantityDelta: "−46 units",
    rule: "Large absolute change",
    ruleDetail: "v3 · ≥ 30 units",
    source: "webhook",
    status: "new",
    statusColor: "var(--hot)",
    detectedAt: "3 h ago",
    evidence: {
      confirmed:
        "Two consecutive webhook reads show 46 after a stable run of 92.",
      unknown: "Whether a bundle sync app touched this component.",
      suggested:
        "Mapped to Spa Night Kit (integration-derived), so relationship accuracy depends on the integration.",
    },
  },
  {
    id: "INC-0136",
    severity: "med",
    severityLabel: "Medium",
    title: "Ceramic Mug — Sage",
    subtitle: "CER-MUG-SG · Retail Store",
    quantity: "57 vs 42",
    quantityDelta: "observed mismatch",
    rule: "Inventory verification mismatch",
    ruleDetail: "v2 · any mismatch",
    source: "reconciliation",
    status: "investigating",
    statusColor: "var(--warn)",
    detectedAt: "Yesterday",
    evidence: {
      confirmed:
        "Last observed 57 (webhook, 18:20). Shopify current 42 at the 06:00 inventory verification.",
      unknown:
        "No events were received in between. The timing and cause of the change.",
      suggested: "Compare against POS sessions at Retail Store.",
    },
  },
  {
    id: "INC-0133",
    severity: "med",
    severityLabel: "Medium",
    title: "Soy Wax Refill 250g",
    subtitle: "SWX-REF-250 · Warehouse B",
    quantity: "6 changes",
    quantityDelta: "net −14 units",
    rule: "Repeated changes",
    ruleDetail: "v1 · 10 min window",
    source: "webhook",
    status: "investigating",
    statusColor: "var(--warn)",
    detectedAt: "Yesterday",
    evidence: {
      confirmed:
        "6 observations inside a 10-minute window, grouped into one incident (30-minute suppression).",
      unknown: "Whether the changes were one process or several.",
      suggested: "Open the evidence timeline to view each observation.",
    },
  },
  {
    id: "INC-0130",
    severity: "low",
    severityLabel: "Low",
    title: "Wooden Gift Box — Small",
    subtitle: "WGB-SM · Warehouse A",
    quantity: "12 units",
    quantityDelta: "new observation",
    rule: "Stale monitoring",
    ruleDetail: "v1 · no update ≥ 24 h",
    source: "baseline",
    status: "new",
    statusColor: "#98a2b3",
    detectedAt: "Yesterday",
    evidence: {
      confirmed:
        "Only a baseline observation exists. No prior quantity is known, so none is shown.",
      unknown: "Whether the item is simply inactive.",
      suggested: "Confirm the item is tracked at this location.",
    },
  },
];

export function getDemoOverview(): OverviewResponse {
  return { ...DEMO_OVERVIEW, recentIncidents: DEMO_INCIDENTS };
}
