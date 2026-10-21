import { prisma, type IncidentSeverity, type IncidentStatus } from "@stocksentry/database";

export type IncidentSummary = {
  openCount: number;
  highestSeverity: IncidentSeverity | null;
  latestStatus: IncidentStatus | null;
  latestIncidentId: string | null;
};

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export const EMPTY_INCIDENT_SUMMARY: IncidentSummary = {
  openCount: 0,
  highestSeverity: null,
  latestStatus: null,
  latestIncidentId: null,
};

/** Shop-scoped open-incident summaries keyed by inventoryItemId. */
export async function incidentSummariesForItems(
  shopId: string,
  inventoryItemIds: string[],
): Promise<Map<string, IncidentSummary>> {
  const map = new Map<string, IncidentSummary>();
  if (!inventoryItemIds.length) return map;

  const open = await prisma.incident.findMany({
    where: {
      shopId,
      inventoryItemId: { in: inventoryItemIds },
      status: { in: ["NEW", "INVESTIGATING"] },
    },
    orderBy: { lastDetectedAt: "desc" },
    select: {
      id: true,
      inventoryItemId: true,
      severity: true,
      status: true,
    },
  });

  for (const row of open) {
    if (!row.inventoryItemId) continue;
    const prev = map.get(row.inventoryItemId);
    if (!prev) {
      map.set(row.inventoryItemId, {
        openCount: 1,
        highestSeverity: row.severity,
        latestStatus: row.status,
        latestIncidentId: row.id,
      });
      continue;
    }
    prev.openCount += 1;
    if (
      !prev.highestSeverity ||
      SEVERITY_RANK[row.severity] > SEVERITY_RANK[prev.highestSeverity]
    ) {
      prev.highestSeverity = row.severity;
    }
    // latest* already set from first (most recent) row due to orderBy
  }

  return map;
}

export function summarizeFromRows(
  rows: Array<{
    id: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
  }>,
): IncidentSummary {
  if (!rows.length) return { ...EMPTY_INCIDENT_SUMMARY };
  let highest: IncidentSeverity = rows[0]!.severity;
  for (const r of rows) {
    if (SEVERITY_RANK[r.severity] > SEVERITY_RANK[highest]) {
      highest = r.severity;
    }
  }
  return {
    openCount: rows.length,
    highestSeverity: highest,
    latestStatus: rows[0]!.status,
    latestIncidentId: rows[0]!.id,
  };
}
