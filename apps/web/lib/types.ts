/** API shapes used by the Bundle Safety UI. Fields are optional — empty responses show empty states. */

export type MonitoringHealth =
  | "healthy"
  | "delayed"
  | "degraded"
  | "disconnected";

export type IncidentSeverity = "high" | "med" | "low";
export type IncidentStatus =
  | "new"
  | "investigating"
  | "resolved"
  | "dismissed";

export interface SourceMixItem {
  label: string;
  pct: number;
  color: string;
}

export interface MonitoringStatus {
  status: MonitoringHealth;
  lastReconciliation?: string | null;
  nextReconciliation?: string | null;
  lastWebhook?: string | null;
  sources?: SourceMixItem[];
}

export interface KpiSpark {
  label: string;
  value: number;
  subtitle: string;
  color: string;
  sparkline: number[];
  stroke: string;
}

export interface TrendPoint {
  date: string;
  label: string;
  detected: number;
  closed: number;
}

export interface IncidentEvidence {
  confirmed?: string;
  unknown?: string;
  suggested?: string;
}

export interface IncidentRow {
  id: string;
  severity: IncidentSeverity;
  severityLabel?: string;
  title: string;
  subtitle: string;
  quantity: string;
  quantityDelta?: string;
  rule: string;
  ruleDetail?: string;
  source: string;
  status: IncidentStatus | string;
  statusColor?: string;
  detectedAt: string;
  evidence?: IncidentEvidence;
  inventoryItemId?: string | null;
}

export interface ReviewOutcomes {
  resolved: number;
  dismissed: number;
  open: number;
  detected: number;
}

export interface RepeatIncident {
  name: string;
  count: number;
  pct: number;
}

export interface BundleRiskGroup {
  name: string;
  mapping: string;
  components: {
    name: string;
    atRisk?: boolean;
    refillAtRisk?: boolean;
    quantity?: number | null;
  }[];
  openComponentCount?: number;
  componentCount?: number;
}

export interface AiReportsSummary {
  used: number;
  limit: number;
  generated: number;
  queued: number;
  stale: number;
  failed: number;
}

export interface PipelineNode {
  icon: string;
  value: string;
  label: string;
}

export interface OverviewResponse {
  shop?: string;
  shopDisplay?: string;
  dateRangeLabel?: string;
  monitoring?: MonitoringStatus | null;
  kpis?: KpiSpark[] | null;
  trend?: TrendPoint[] | null;
  recentIncidents?: IncidentRow[] | null;
  reviewOutcomes?: ReviewOutcomes | null;
  repeatIncidents?: RepeatIncident[] | null;
  bundleRisk?: BundleRiskGroup[] | null;
  aiReports?: AiReportsSummary | null;
  pipeline?: PipelineNode[] | null;
  plan?: {
    name: string;
    aiUsed: number;
    aiLimit: number;
  } | null;
  badges?: {
    incidents?: number;
    notifications?: number;
  } | null;
  user?: {
    initials: string;
    name: string;
    role: string;
  } | null;
  supplierRisk?: {
    linkedItems?: number;
    openIncidents?: number;
  } | null;
  refillAttention?: {
    count: number;
    threshold: number;
  } | null;
}

export interface IncidentsListResponse {
  items?: IncidentRow[];
  total?: number;
  badges?: { incidents?: number };
}

export interface IncidentDetailResponse extends IncidentRow {
  activity?: { at: string; text: string }[];
  notes?: { at: string; author: string; text: string }[];
  aiReport?: {
    summary?: string;
    status?: string;
    title?: string;
    why_flagged?: string;
    confirmed_facts?: string[];
    possible_explanations?: string[];
    recommended_checks?: string[];
    unknowns?: string[];
    confidence_note?: string;
  } | null;
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface HistoryObservation {
  id: string;
  observedAt: string;
  source: string;
  quantity: number;
  quantityName?: string;
  dataQuality: string;
  inventoryItem?: {
    id?: string;
    productTitle?: string | null;
    variantTitle?: string | null;
    sku?: string | null;
  };
  location?: { id?: string; name?: string };
}

export interface HistoryListResponse extends Partial<PaginatedMeta> {
  items?: HistoryObservation[];
}

export type ApiIncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ApiIncidentStatus =
  | "NEW"
  | "INVESTIGATING"
  | "RESOLVED"
  | "DISMISSED";

export interface IncidentSummary {
  openCount: number;
  highestSeverity: ApiIncidentSeverity | null;
  latestStatus: ApiIncidentStatus | null;
  latestIncidentId: string | null;
}

export interface ProductItem {
  id: string;
  productTitle?: string | null;
  variantTitle?: string | null;
  sku?: string | null;
  tracked?: boolean;
  incidentSummary?: IncidentSummary;
  observations?: Array<{
    quantity?: number;
    observedAt?: string;
    location?: { id?: string; name?: string };
  }>;
}

export interface ProductsListResponse extends Partial<PaginatedMeta> {
  items?: ProductItem[];
  locations?: Array<{ id: string; name: string; active?: boolean }>;
}

export interface ProductsStatsResponse {
  monitoredCount: number;
  openIncidentProductCount: number;
  lastVerifiedAt?: string | null;
  locationCount?: number;
}

export interface ProductDetailResponse {
  item: {
    id: string;
    productTitle?: string | null;
    variantTitle?: string | null;
    sku?: string | null;
    tracked?: boolean;
    shopifyInventoryItemGid?: string;
    productGid?: string | null;
    variantGid?: string | null;
    incidentSummary?: IncidentSummary;
  };
  locations?: Array<{
    locationId: string;
    name: string;
    quantity: number | null;
    lastObservedAt?: string | null;
    source?: string | null;
  }>;
  history?: {
    items?: Array<{
      id: string;
      quantity: number;
      observedAt: string;
      source: string;
      dataQuality?: string;
      location?: { id?: string; name?: string };
    }>;
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
  incidents?: {
    open?: Array<{
      id: string;
      type?: string;
      severity?: string;
      status?: string;
      lastDetectedAt?: string;
      location?: { name?: string } | null;
    }>;
    recent?: Array<{
      id: string;
      type?: string;
      severity?: string;
      status?: string;
      lastDetectedAt?: string;
      location?: { name?: string } | null;
    }>;
  };
  bundles?: Array<{
    id: string;
    name: string;
    active?: boolean;
    role?: string;
  }>;
  suppliers?: Array<{
    id: string;
    name: string;
    contactEmail?: string | null;
    leadTimeDays?: number | null;
    active?: boolean;
  }>;
  stats?: {
    incidentCount30d?: number;
    absDeltaSum30d?: number;
    lastChangeAt?: string | null;
    openIncidentCount?: number;
    monitoringHealth?: string;
  };
  refillRisk?: {
    atRisk: boolean;
    threshold: number;
    minQuantity: number | null;
    locations: Array<{
      locationId: string;
      name: string;
      quantity: number;
      threshold: number;
      suggestion: string;
    }>;
    suggestedAction: string;
  };
  productReport?: {
    id: string;
    status: string;
    summaryJson?: Record<string, unknown> | null;
    generatedAt?: string | null;
    errorCode?: string | null;
  } | null;
}

export interface SupplierListItem {
  id: string;
  name: string;
  contactEmail?: string | null;
  contactName?: string | null;
  notes?: string | null;
  leadTimeDays?: number | null;
  active?: boolean;
  verified?: boolean;
  verifiedAt?: string | null;
  itemCount?: number;
  openIncidentCount?: number;
}

export interface ReplenishmentRule {
  id: string;
  shopId?: string;
  inventoryItemId?: string | null;
  bundleGroupId?: string | null;
  supplierId: string;
  lowStockThreshold: number;
  restockQuantity: number;
  autoEmailEnabled?: boolean;
  requireApproval?: boolean;
  active?: boolean;
  lastTriggeredAt?: string | null;
  supplier?: {
    id: string;
    name: string;
    contactEmail?: string | null;
    verified?: boolean;
  };
  inventoryItem?: ProductItem | null;
  bundleGroup?: { id: string; name: string } | null;
}

export interface ReplenishmentRequest {
  id: string;
  status: string;
  quantity: number;
  threshold: number;
  supplierEmail?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  dedupeKey?: string;
  sentAt?: string | null;
  approvedAt?: string | null;
  errorCode?: string | null;
  createdAt?: string;
  supplier?: {
    id: string;
    name: string;
    contactEmail?: string | null;
    verified?: boolean;
  };
  inventoryItem?: ProductItem | null;
  bundleGroup?: { id: string; name: string } | null;
}

export interface SuppliersListResponse {
  items?: SupplierListItem[];
}

export interface SupplierDetail extends SupplierListItem {
  items?: Array<{
    id: string;
    inventoryItemId: string;
    skuOverride?: string | null;
    notes?: string | null;
    inventoryItem?: ProductItem;
  }>;
  openIncidents?: Array<{
    id: string;
    type?: string;
    severity?: string;
    status?: string;
    inventoryItem?: ProductItem | null;
    location?: { name?: string } | null;
  }>;
}

export interface EmailTemplateRow {
  key: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  isOverride?: boolean;
  id?: string | null;
}

export interface BundleGroupItem {
  id: string;
  role: string;
  inventoryItemId: string;
  quantity?: number | null;
  refillAtRisk?: boolean;
  refillThreshold?: number;
  openIncidents?: number;
  incidentSummary?: IncidentSummary;
  inventoryItem?: {
    id?: string;
    productTitle?: string | null;
    variantTitle?: string | null;
    sku?: string | null;
    incidentSummary?: IncidentSummary;
  };
}

export interface BundleGroup {
  id: string;
  name: string;
  description?: string | null;
  active?: boolean;
  relationshipSource?: string;
  items?: BundleGroupItem[];
  openComponentCount?: number;
  hasOpenIncidents?: boolean;
  hasRefillRisk?: boolean;
}

export interface BundlesListResponse {
  items?: BundleGroup[];
  refillThreshold?: number;
}

export interface SettingsThresholds {
  absoluteChangeThreshold?: number;
  percentageChangeThreshold?: number;
  minBaselineForPercentage?: number;
  repeatedChangeWindowMinutes?: number;
  duplicateSuppressionMinutes?: number;
  reconciliationIntervalHours?: number;
}

export interface DetectionRuleRow {
  id?: string;
  ruleType: string;
  enabled: boolean;
  configuration?: unknown;
}

export interface NotificationPrefRow {
  id?: string;
  channel: "IN_APP" | "EMAIL" | "SLACK";
  enabled: boolean;
  minSeverity: string;
  digestEnabled?: boolean;
  destinationRef?: string | null;
}

export interface SettingsResponse {
  shop?: {
    planSlug?: string;
    reconciliationIntervalHours?: number;
    onboardingCompleted?: boolean;
  };
  settings?: {
    thresholds?: SettingsThresholds | null;
    monitoring?: unknown;
    ai?: unknown;
    retention?: unknown;
  } | null;
  detectionRules?: DetectionRuleRow[];
  notificationPreferences?: NotificationPrefRow[];
  emailTemplates?: EmailTemplateRow[];
}

export interface MerchantPlan {
  slug: string;
  displayName: string;
  description?: string | null;
  priceUsdMonthly: number;
  trialDays?: number;
  maxMonitoredItems: number;
  historyDays: number;
  maxOpenIncidents: number;
  aiReportsPerMonth: number;
  advancedRules: boolean;
  exportsEnabled: boolean;
  teamWorkflows: boolean;
  supplierAutomation?: boolean;
  maxBundleGroups?: number;
  maxSuppliers?: number;
  isFree?: boolean;
  active?: boolean;
}

export interface BillingStatusResponse {
  planSlug?: string;
  billingStatus?: string;
  requiresPlanSelection?: boolean;
  entitlements?: {
    displayName?: string;
    priceUsdMonthly?: number;
    exportsEnabled?: boolean;
    aiReportsPerMonth?: number;
  };
  usage?: {
    monitoredItems?: number;
    maxMonitoredItems?: number;
    openIncidents?: number;
    maxOpenIncidents?: number;
    aiReportsUsed?: number;
    aiReportsLimit?: number;
  };
}

export interface NotificationDelivery {
  id: string;
  channel?: string;
  status?: string;
  destination?: string | null;
  sentAt?: string | null;
  createdAt?: string;
  errorCode?: string | null;
  incident?: {
    id?: string;
    type?: string;
    severity?: string;
    status?: string;
    inventoryItem?: {
      productTitle?: string | null;
      variantTitle?: string | null;
      sku?: string | null;
    } | null;
  } | null;
}

export interface NotificationsListResponse {
  items?: NotificationDelivery[];
}

export interface ExportJob {
  id: string;
  exportType: string;
  status: string;
  resultUrl?: string | null;
  errorCode?: string | null;
  createdAt?: string;
  completedAt?: string | null;
}

export interface ExportsListResponse {
  items?: ExportJob[];
}

export interface OnboardingChecklistItem {
  id: string;
  label: string;
  done: boolean;
  optional?: boolean;
}

export interface OnboardingResponse {
  completed?: boolean;
  checklist?: OnboardingChecklistItem[];
  progress?: { done: number; total: number };
}
