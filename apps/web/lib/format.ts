import type { IncidentSeverity, IncidentStatus, MonitoringHealth } from "./types";

export function severityLabel(sev: IncidentSeverity | string): string {
  if (sev === "high") return "High";
  if (sev === "med" || sev === "medium") return "Medium";
  if (sev === "low") return "Low";
  return String(sev);
}

export function severityClass(sev: IncidentSeverity | string): string {
  if (sev === "high") return "high";
  if (sev === "med" || sev === "medium") return "med";
  return "low";
}

export function statusColor(status: IncidentStatus | string): string {
  const s = String(status).toLowerCase();
  if (s === "new") return "var(--hot)";
  if (s === "investigating") return "var(--warn)";
  if (s === "resolved") return "var(--acc)";
  if (s === "dismissed") return "#98a2b3";
  return "#98a2b3";
}

export function statusLabel(status: IncidentStatus | string): string {
  const s = String(status).toLowerCase();
  if (s === "new") return "New";
  if (s === "investigating") return "Investigating";
  if (s === "resolved") return "Resolved";
  if (s === "dismissed") return "Dismissed";
  return String(status);
}

const HEALTH_ORDER: MonitoringHealth[] = [
  "healthy",
  "delayed",
  "degraded",
  "disconnected",
];

export function healthIndex(status: MonitoringHealth | string): number {
  const i = HEALTH_ORDER.indexOf(status as MonitoringHealth);
  return i >= 0 ? i : 0;
}

export function healthLabel(status: MonitoringHealth | string): string {
  switch (status) {
    case "healthy":
      return "Monitoring is healthy";
    case "delayed":
      return "Monitoring is delayed";
    case "degraded":
      return "Monitoring is degraded";
    case "disconnected":
      return "Monitoring disconnected";
    default:
      return "Monitoring status unknown";
  }
}

export function isDeltaNegative(delta?: string): boolean {
  if (!delta) return false;
  return delta.startsWith("−") || delta.startsWith("-");
}
