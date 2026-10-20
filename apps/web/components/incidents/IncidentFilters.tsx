"use client";

export interface IncidentFilterState {
  severity: string;
  status: string;
  source: string;
  q: string;
}

interface IncidentFiltersProps {
  value: IncidentFilterState;
  onChange: (next: IncidentFilterState) => void;
}

export function IncidentFilters({ value, onChange }: IncidentFiltersProps) {
  return (
    <div className="filters">
      <input
        type="search"
        placeholder="Search item, SKU, location…"
        value={value.q}
        onChange={(e) => onChange({ ...value, q: e.target.value })}
        aria-label="Search incidents"
      />
      <select
        value={value.severity}
        onChange={(e) => onChange({ ...value, severity: e.target.value })}
        aria-label="Severity"
      >
        <option value="">All severities</option>
        <option value="high">High</option>
        <option value="med">Medium</option>
        <option value="low">Low</option>
      </select>
      <select
        value={value.status}
        onChange={(e) => onChange({ ...value, status: e.target.value })}
        aria-label="Status"
      >
        <option value="">All statuses</option>
        <option value="new">New</option>
        <option value="investigating">Investigating</option>
        <option value="resolved">Resolved</option>
        <option value="dismissed">Dismissed</option>
      </select>
      <select
        value={value.source}
        onChange={(e) => onChange({ ...value, source: e.target.value })}
        aria-label="Source"
      >
        <option value="">All sources</option>
        <option value="webhook">Webhook</option>
        <option value="reconciliation">Reconciliation</option>
        <option value="baseline">Baseline</option>
        <option value="api">API read</option>
      </select>
    </div>
  );
}

export function filterIncidents<
  T extends {
    title: string;
    subtitle: string;
    severity: string;
    status: string;
    source: string;
  },
>(items: T[], f: IncidentFilterState): T[] {
  const q = f.q.trim().toLowerCase();
  return items.filter((item) => {
    if (f.severity && item.severity !== f.severity) return false;
    if (f.status && String(item.status).toLowerCase() !== f.status)
      return false;
    if (f.source && item.source.toLowerCase() !== f.source) return false;
    if (
      q &&
      !`${item.title} ${item.subtitle}`.toLowerCase().includes(q)
    ) {
      return false;
    }
    return true;
  });
}
