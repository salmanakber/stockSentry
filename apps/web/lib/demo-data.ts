import type {
  BundleGroup,
  IncidentRow,
  IncidentSummary,
  OverviewResponse,
  ProductItem,
  ProductsStatsResponse,
  SupplierListItem,
} from "./types";

/** Design-QA sample payload — only used when `?demo=1`. Never written to a live shop DB. */

function summary(
  openCount: number,
  highestSeverity: IncidentSummary["highestSeverity"],
  latestStatus: IncidentSummary["latestStatus"],
  latestIncidentId: string | null,
): IncidentSummary {
  return { openCount, highestSeverity, latestStatus, latestIncidentId };
}

const LOC = {
  a: { id: "loc-wh-a", name: "Warehouse A" },
  b: { id: "loc-wh-b", name: "Warehouse B" },
  r: { id: "loc-retail", name: "Retail Store" },
} as const;

export const DEMO_LOCATIONS = [
  { id: LOC.a.id, name: LOC.a.name, active: true },
  { id: LOC.b.id, name: LOC.b.name, active: true },
  { id: LOC.r.id, name: LOC.r.name, active: true },
];

function obs(
  quantity: number,
  location: { id: string; name: string },
  observedAt: string,
) {
  return [{ quantity, observedAt, location }];
}

/** Catalog used by Inventory, ProductPickerModal, and related ?demo=1 screens. */
export const DEMO_PRODUCTS: ProductItem[] = [
  {
    id: "prod-aurora-candle",
    productTitle: "Aurora Candle Gift Set",
    variantTitle: "Default Title",
    sku: "AUR-CND-GS",
    tracked: true,
    incidentSummary: summary(1, "HIGH", "NEW", "INC-0142"),
    observations: obs(61, LOC.a, "2026-10-20T10:49:00Z"),
  },
  {
    id: "prod-linen-napkin",
    productTitle: "Linen Napkin 4-Pack",
    variantTitle: "Natural",
    sku: "LIN-NPK-4N",
    tracked: true,
    incidentSummary: summary(1, "HIGH", "INVESTIGATING", "INC-0141"),
    observations: obs(96, LOC.a, "2026-10-20T09:55:00Z"),
  },
  {
    id: "prod-bath-salts",
    productTitle: "Bath Salts 200g",
    variantTitle: "Lavender",
    sku: "SPA-BSL-200",
    tracked: true,
    incidentSummary: summary(1, "HIGH", "NEW", "INC-0139"),
    observations: obs(46, LOC.b, "2026-10-20T07:12:00Z"),
  },
  {
    id: "prod-ceramic-mug",
    productTitle: "Ceramic Mug",
    variantTitle: "Sage",
    sku: "CER-MUG-SG",
    tracked: true,
    incidentSummary: summary(1, "MEDIUM", "INVESTIGATING", "INC-0136"),
    observations: obs(42, LOC.r, "2026-10-20T06:00:00Z"),
  },
  {
    id: "prod-soy-wax",
    productTitle: "Soy Wax Refill 250g",
    variantTitle: "Default Title",
    sku: "SWX-REF-250",
    tracked: true,
    incidentSummary: summary(1, "MEDIUM", "INVESTIGATING", "INC-0133"),
    observations: obs(38, LOC.b, "2026-10-19T16:22:00Z"),
  },
  {
    id: "prod-wooden-box",
    productTitle: "Wooden Gift Box",
    variantTitle: "Small",
    sku: "WGB-SM",
    tracked: true,
    incidentSummary: summary(1, "LOW", "NEW", "INC-0130"),
    observations: obs(12, LOC.a, "2026-10-19T08:00:00Z"),
  },
  {
    id: "prod-tea-light",
    productTitle: "Tea Light ×6",
    variantTitle: "Warm White",
    sku: "AUR-TL-6",
    tracked: true,
    incidentSummary: summary(0, null, null, null),
    observations: obs(240, LOC.a, "2026-10-20T11:02:00Z"),
  },
  {
    id: "prod-gift-wrap",
    productTitle: "Gift Wrap",
    variantTitle: "Kraft Roll",
    sku: "PKG-WRAP-KR",
    tracked: true,
    incidentSummary: summary(0, null, null, null),
    observations: obs(88, LOC.a, "2026-10-20T10:10:00Z"),
  },
  {
    id: "prod-ribbon",
    productTitle: "Ribbon",
    variantTitle: "Sage 10m",
    sku: "PKG-RIB-SG",
    tracked: true,
    incidentSummary: summary(0, null, null, null),
    observations: obs(54, LOC.a, "2026-10-19T14:40:00Z"),
  },
  {
    id: "prod-body-oil",
    productTitle: "Body Oil",
    variantTitle: "Citrus",
    sku: "SPA-OIL-CT",
    tracked: true,
    incidentSummary: summary(0, null, null, null),
    observations: obs(71, LOC.b, "2026-10-20T08:30:00Z"),
  },
  {
    id: "prod-face-mask",
    productTitle: "Face Mask",
    variantTitle: "Clay Single",
    sku: "SPA-MSK-CL",
    tracked: true,
    incidentSummary: summary(0, null, null, null),
    observations: obs(120, LOC.b, "2026-10-20T08:31:00Z"),
  },
  {
    id: "prod-pouch",
    productTitle: "Pouch",
    variantTitle: "Cotton Drawstring",
    sku: "SPA-PCH-CT",
    tracked: true,
    incidentSummary: summary(0, null, null, null),
    observations: obs(95, LOC.b, "2026-10-19T12:00:00Z"),
  },
  {
    id: "prod-linen-charcoal",
    productTitle: "Linen Napkin 4-Pack",
    variantTitle: "Charcoal",
    sku: "LIN-NPK-4C",
    tracked: true,
    incidentSummary: summary(0, null, null, null),
    observations: obs(64, LOC.r, "2026-10-18T17:20:00Z"),
  },
  {
    id: "prod-ceramic-cream",
    productTitle: "Ceramic Mug",
    variantTitle: "Cream",
    sku: "CER-MUG-CR",
    tracked: true,
    incidentSummary: summary(0, null, null, null),
    observations: obs(33, LOC.r, "2026-10-20T06:05:00Z"),
  },
];

/** Open-incident product count matches DEMO_PRODUCTS with openCount > 0 (6). */
export const DEMO_PRODUCTS_STATS: ProductsStatsResponse = {
  monitoredCount: DEMO_PRODUCTS.length,
  openIncidentProductCount: DEMO_PRODUCTS.filter(
    (p) => (p.incidentSummary?.openCount ?? 0) > 0,
  ).length,
  lastVerifiedAt: "2026-10-20T09:55:00Z",
  locationCount: DEMO_LOCATIONS.length,
};

export const DEMO_BUNDLES: BundleGroup[] = [
  {
    id: "bundle-aurora",
    name: "Aurora Gift Collection",
    description: "Candle set + linens + packaging for seasonal kits.",
    relationshipSource: "MANUAL",
    active: true,
    hasOpenIncidents: true,
    hasRefillRisk: true,
    openComponentCount: 2,
    items: [
      {
        id: "bi-1",
        role: "BUNDLE",
        inventoryItemId: "prod-aurora-candle",
        quantity: 1,
        refillAtRisk: true,
        refillThreshold: 10,
        openIncidents: 1,
        incidentSummary: summary(1, "HIGH", "NEW", "INC-0142"),
        inventoryItem: DEMO_PRODUCTS[0],
      },
      {
        id: "bi-2",
        role: "COMPONENT",
        inventoryItemId: "prod-linen-napkin",
        quantity: 1,
        refillAtRisk: true,
        refillThreshold: 10,
        openIncidents: 1,
        incidentSummary: summary(1, "HIGH", "INVESTIGATING", "INC-0141"),
        inventoryItem: DEMO_PRODUCTS[1],
      },
      {
        id: "bi-3",
        role: "COMPONENT",
        inventoryItemId: "prod-tea-light",
        quantity: 1,
        inventoryItem: DEMO_PRODUCTS[6],
      },
      {
        id: "bi-4",
        role: "COMPONENT",
        inventoryItemId: "prod-gift-wrap",
        quantity: 1,
        inventoryItem: DEMO_PRODUCTS[7],
      },
      {
        id: "bi-5",
        role: "COMPONENT",
        inventoryItemId: "prod-ribbon",
        quantity: 1,
        inventoryItem: DEMO_PRODUCTS[8],
      },
    ],
  },
  {
    id: "bundle-spa",
    name: "Spa Night Kit",
    description: "Integration-derived mapping from kit SKU.",
    relationshipSource: "INTEGRATION",
    active: true,
    hasOpenIncidents: true,
    hasRefillRisk: true,
    openComponentCount: 1,
    items: [
      {
        id: "bi-6",
        role: "COMPONENT",
        inventoryItemId: "prod-bath-salts",
        quantity: 1,
        refillAtRisk: true,
        refillThreshold: 10,
        openIncidents: 1,
        incidentSummary: summary(1, "HIGH", "NEW", "INC-0139"),
        inventoryItem: DEMO_PRODUCTS[2],
      },
      {
        id: "bi-7",
        role: "COMPONENT",
        inventoryItemId: "prod-body-oil",
        quantity: 1,
        inventoryItem: DEMO_PRODUCTS[9],
      },
      {
        id: "bi-8",
        role: "COMPONENT",
        inventoryItemId: "prod-face-mask",
        quantity: 1,
        inventoryItem: DEMO_PRODUCTS[10],
      },
      {
        id: "bi-9",
        role: "COMPONENT",
        inventoryItemId: "prod-pouch",
        quantity: 1,
        inventoryItem: DEMO_PRODUCTS[11],
      },
    ],
  },
];

export const DEMO_SUPPLIERS: SupplierListItem[] = [
  {
    id: "sup-north-candle",
    name: "Northwind Candle Co.",
    contactEmail: "ops@northwind-candle.example",
    contactName: "Priya Shah",
    leadTimeDays: 7,
    active: true,
    itemCount: 3,
    openIncidentCount: 2,
  },
  {
    id: "sup-linen-mill",
    name: "Harbor Linen Mill",
    contactEmail: "fulfillment@harborlinen.example",
    contactName: "James Okonkwo",
    leadTimeDays: 14,
    active: true,
    itemCount: 2,
    openIncidentCount: 1,
  },
  {
    id: "sup-spa-essentials",
    name: "Coastal Spa Essentials",
    contactEmail: null,
    leadTimeDays: 10,
    active: true,
    itemCount: 4,
    openIncidentCount: 1,
  },
];

/** Overview KPIs stay internally consistent with products / incidents / bundles. */
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
      value: DEMO_PRODUCTS.length,
      subtitle: `across ${DEMO_LOCATIONS.length} active locations`,
      color: "var(--acc)",
      sparkline: [10, 11, 12, 12, 13, 14, DEMO_PRODUCTS.length],
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
      openComponentCount: 2,
      componentCount: 5,
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
      openComponentCount: 1,
      componentCount: 4,
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
  supplierRisk: {
    linkedItems: DEMO_SUPPLIERS.reduce((n, s) => n + (s.itemCount ?? 0), 0),
    openIncidents: DEMO_SUPPLIERS.reduce(
      (n, s) => n + (s.openIncidentCount ?? 0),
      0,
    ),
  },
  refillAttention: { count: 3, threshold: 10 },
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
    inventoryItemId: "prod-aurora-candle",
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
    inventoryItemId: "prod-linen-napkin",
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
    inventoryItemId: "prod-bath-salts",
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
    inventoryItemId: "prod-ceramic-mug",
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
    inventoryItemId: "prod-soy-wax",
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
    inventoryItemId: "prod-wooden-box",
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

export function filterDemoProducts(opts: {
  q?: string;
  locationId?: string;
  hasOpenIncident?: boolean;
  page?: number;
  pageSize?: number;
}): {
  items: ProductItem[];
  locations: typeof DEMO_LOCATIONS;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
} {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 50;
  const needle = (opts.q ?? "").trim().toLowerCase();

  let items = DEMO_PRODUCTS.filter((p) => {
    if (opts.hasOpenIncident && !(p.incidentSummary?.openCount ?? 0)) {
      return false;
    }
    if (opts.locationId) {
      const loc = p.observations?.[0]?.location?.id;
      if (loc !== opts.locationId) return false;
    }
    if (!needle) return true;
    const hay = [p.productTitle, p.variantTitle, p.sku]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });

  const total = items.length;
  const start = (page - 1) * pageSize;
  items = items.slice(start, start + pageSize);

  return {
    items,
    locations: DEMO_LOCATIONS,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
