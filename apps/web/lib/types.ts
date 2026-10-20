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
  components: { name: string; atRisk?: boolean }[];
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
  } | null;
}
