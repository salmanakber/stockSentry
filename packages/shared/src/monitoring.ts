export const MONITORING_HEALTH = [
  "healthy",
  "delayed",
  "degraded",
  "disconnected",
] as const;

export type MonitoringHealth = (typeof MONITORING_HEALTH)[number];

export type MonitoringHealthInput = {
  installationStatus: string;
  lastWebhookAt: Date | null;
  lastReconciledAt: Date | null;
  /** Interval in hours (fractional OK when derived from minutes). */
  reconciliationIntervalHours: number;
  /** Preferred when set — converted to hours for freshness checks. */
  reconciliationIntervalMinutes?: number | null;
  now?: Date;
};

/** Resolve verification cadence in minutes, preferring minutes field. */
export function resolveReconciliationIntervalMinutes(input: {
  reconciliationIntervalMinutes?: number | null;
  reconciliationIntervalHours?: number | null;
}): number {
  if (
    typeof input.reconciliationIntervalMinutes === "number" &&
    input.reconciliationIntervalMinutes > 0
  ) {
    return Math.max(1, Math.round(input.reconciliationIntervalMinutes));
  }
  const hours = input.reconciliationIntervalHours ?? 6;
  return Math.max(1, Math.round(hours * 60));
}

export function resolveReconciliationIntervalHours(input: {
  reconciliationIntervalMinutes?: number | null;
  reconciliationIntervalHours?: number | null;
}): number {
  return resolveReconciliationIntervalMinutes(input) / 60;
}

function hoursSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
}

/**
 * Derive merchant-facing monitoring health from freshness signals.
 * Thresholds are intentionally conservative for MVP scaffolding.
 */
export function deriveMonitoringHealth(
  input: MonitoringHealthInput,
): MonitoringHealth {
  const now = input.now ?? new Date();

  if (
    input.installationStatus === "UNINSTALLED" ||
    input.installationStatus === "PENDING"
  ) {
    return "disconnected";
  }

  const reconHours = hoursSince(input.lastReconciledAt, now);
  const webhookHours = hoursSince(input.lastWebhookAt, now);
  const interval = Math.max(
    1 / 60,
    resolveReconciliationIntervalHours({
      reconciliationIntervalMinutes: input.reconciliationIntervalMinutes,
      reconciliationIntervalHours: input.reconciliationIntervalHours,
    }),
  );

  if (reconHours === null) {
    return "degraded";
  }

  if (reconHours > interval * 3) {
    return "degraded";
  }

  if (reconHours > interval * 1.5) {
    return "delayed";
  }

  // Webhooks may be quiet on low-traffic stores; only flag when reconcile is ok
  // but webhook freshness is extremely stale relative to interval.
  if (webhookHours !== null && webhookHours > interval * 4) {
    return "delayed";
  }

  return "healthy";
}

/** Alias used by overview / monitoring services. */
export const computeMonitoringHealth = deriveMonitoringHealth;

export function isObservationStale(
  observedAt: Date,
  maxAgeHours: number,
  now: Date = new Date(),
): boolean {
  const ageHours = (now.getTime() - observedAt.getTime()) / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}
