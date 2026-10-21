import type { AiReportOutput } from "@stocksentry/shared";
import type {
  IncidentDetailResponse,
  IncidentEvidence,
  IncidentRow,
  IncidentSeverity,
  IncidentStatus,
} from "./types";

/** Raw incident shape returned by GET /api/v1/incidents and /incidents/:id */
export interface ApiIncident {
  id: string;
  type?: string;
  severity?: string;
  status?: string;
  ruleType?: string;
  firstDetectedAt?: string;
  lastDetectedAt?: string;
  inventoryItem?: {
    id?: string;
    productTitle?: string | null;
    variantTitle?: string | null;
    sku?: string | null;
  } | null;
  inventoryItemId?: string | null;
  location?: { name?: string | null } | null;
  evidence?: Array<{
    evidenceType?: string;
    evidencePayload?: Record<string, unknown> | null;
  }>;
  notes?: Array<{
    content?: string;
    actorType?: string;
    createdAt?: string;
  }>;
  activities?: Array<{
    content?: string | null;
    activityType?: string;
    createdAt?: string;
  }>;
  aiReports?: Array<{
    id?: string;
    status?: string;
    outputJson?: Partial<AiReportOutput> | null;
    generatedAt?: string | null;
  }>;
}

function mapSeverity(raw?: string): IncidentSeverity {
  const s = String(raw ?? "").toUpperCase();
  if (s === "HIGH" || s === "CRITICAL") return "high";
  if (s === "MEDIUM" || s === "MED") return "med";
  return "low";
}

function mapStatus(raw?: string): IncidentStatus {
  const s = String(raw ?? "").toLowerCase();
  if (s === "investigating") return "investigating";
  if (s === "resolved") return "resolved";
  if (s === "dismissed") return "dismissed";
  return "new";
}

function formatWhen(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function productTitle(item?: ApiIncident["inventoryItem"]): string {
  if (!item) return "Unknown item";
  const base = item.productTitle?.trim() || "Untitled product";
  if (item.variantTitle && item.variantTitle !== "Default Title") {
    return `${base} · ${item.variantTitle}`;
  }
  return base;
}

function mapEvidence(
  evidence?: ApiIncident["evidence"],
): IncidentEvidence | undefined {
  if (!evidence?.length) return undefined;
  const confirmed: string[] = [];
  const unknown: string[] = [];
  const suggested: string[] = [];
  for (const e of evidence) {
    const payload = e.evidencePayload ?? {};
    const summary =
      typeof payload.summary === "string"
        ? payload.summary
        : typeof payload.message === "string"
          ? payload.message
          : e.evidenceType ?? "Evidence";
    const kind = String(e.evidenceType ?? "").toLowerCase();
    if (kind.includes("unknown")) unknown.push(summary);
    else if (kind.includes("suggest") || kind.includes("check"))
      suggested.push(summary);
    else confirmed.push(summary);
  }
  return {
    confirmed: confirmed.join(" · ") || undefined,
    unknown: unknown.join(" · ") || undefined,
    suggested: suggested.join(" · ") || undefined,
  };
}

/** Map API incident list row into the UI IncidentRow shape. */
export function mapApiIncidentRow(raw: ApiIncident): IncidentRow {
  const title = productTitle(raw.inventoryItem);
  const sku = raw.inventoryItem?.sku?.trim();
  const loc = raw.location?.name?.trim();
  const subtitle = [sku ? `SKU ${sku}` : null, loc].filter(Boolean).join(" · ");

  return {
    id: raw.id,
    severity: mapSeverity(raw.severity),
    title,
    subtitle: subtitle || raw.type || "—",
    quantity: "—",
    rule: raw.ruleType?.replace(/_/g, " ") ?? raw.type ?? "Rule",
    ruleDetail: raw.type,
    source: "—",
    status: mapStatus(raw.status),
    detectedAt: formatWhen(raw.lastDetectedAt ?? raw.firstDetectedAt),
    evidence: mapEvidence(raw.evidence),
    inventoryItemId: raw.inventoryItem?.id ?? raw.inventoryItemId ?? null,
  };
}

/** Map API incident detail into UI detail response. */
export function mapApiIncidentDetail(raw: ApiIncident): IncidentDetailResponse {
  const row = mapApiIncidentRow(raw);
  const latest = raw.aiReports?.[0];
  const output = latest?.outputJson ?? null;

  return {
    ...row,
    activity: (raw.activities ?? []).map((a) => ({
      at: formatWhen(a.createdAt),
      text: a.content?.trim() || a.activityType || "Activity",
    })),
    notes: (raw.notes ?? []).map((n) => ({
      at: formatWhen(n.createdAt),
      author: n.actorType === "SYSTEM" ? "System" : "Merchant",
      text: n.content ?? "",
    })),
    aiReport: latest
      ? {
          summary: output?.summary,
          status: latest.status,
          why_flagged: output?.why_flagged,
          confirmed_facts: output?.confirmed_facts,
          possible_explanations: output?.possible_explanations,
          recommended_checks: output?.recommended_checks,
          unknowns: output?.unknowns,
          confidence_note: output?.confidence_note,
          title: output?.title,
        }
      : null,
  };
}

/** API status values for PATCH /incidents/:id */
export function toApiStatus(
  ui: "investigating" | "resolved" | "dismissed" | "new",
): string {
  return ui.toUpperCase();
}
