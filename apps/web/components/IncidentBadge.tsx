"use client";

import { useRouter } from "next/navigation";
import {
  severityClass,
  severityLabel,
  statusColor,
  statusLabel,
} from "../lib/format";
import type {
  ApiIncidentSeverity,
  ApiIncidentStatus,
} from "../lib/types";

export interface IncidentBadgeProps {
  severity?: ApiIncidentSeverity | string | null;
  status?: ApiIncidentStatus | string | null;
  count?: number;
  incidentId?: string | null;
  /** When no single incident, filter incidents by product */
  productId?: string | null;
  href?: string;
  className?: string;
}

function toUiSeverity(sev?: string | null): string {
  const s = String(sev ?? "").toUpperCase();
  if (s === "CRITICAL" || s === "HIGH") return "high";
  if (s === "MEDIUM" || s === "MED") return "med";
  if (s === "LOW") return "low";
  return severityClass(String(sev ?? "").toLowerCase());
}

function toUiStatus(status?: string | null): string {
  return String(status ?? "").toLowerCase();
}

export function IncidentBadge({
  severity,
  status,
  count = 1,
  incidentId,
  productId,
  href,
  className,
}: IncidentBadgeProps) {
  const router = useRouter();
  if (!count || count <= 0) return null;
  if (!severity && !status && !incidentId) return null;

  const sev = toUiSeverity(severity);
  const st = toUiStatus(status);
  const label =
    count > 1
      ? `${count} open`
      : severityLabel(sev === "med" ? "med" : sev);

  const target =
    href ??
    (incidentId
      ? `/incidents/${encodeURIComponent(incidentId)}`
      : productId
        ? `/incidents?productId=${encodeURIComponent(productId)}`
        : "/incidents");

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(target);
  };

  return (
    <button
      type="button"
      className={`incident-badge${className ? ` ${className}` : ""}`}
      onClick={onClick}
      title={st ? statusLabel(st) : "Open incidents"}
    >
      <span className={`sev ${sev}`}>{label}</span>
      {st ? (
        <span className="st">
          <i style={{ background: statusColor(st) }} />
          {count > 1 ? "Open" : statusLabel(st)}
        </span>
      ) : null}
    </button>
  );
}

/** Convenience: render from API incidentSummary shape. */
export function IncidentSummaryBadge({
  summary,
  productId,
  className,
}: {
  summary?: {
    openCount?: number;
    highestSeverity?: string | null;
    latestStatus?: string | null;
    latestIncidentId?: string | null;
  } | null;
  productId?: string | null;
  className?: string;
}) {
  const count = summary?.openCount ?? 0;
  if (count <= 0) return null;
  return (
    <IncidentBadge
      severity={summary?.highestSeverity}
      status={summary?.latestStatus}
      count={count}
      incidentId={summary?.latestIncidentId}
      productId={productId}
      className={className}
    />
  );
}
