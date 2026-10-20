/**
 * Pure detection helpers — never invent a previous quantity.
 * null previous means unknown baseline (skip absolute/percentage rules).
 */

export function absoluteDelta(
  previous: number | null,
  current: number,
): number | null {
  if (previous === null) return null;
  return Math.abs(current - previous);
}

export function signedDelta(
  previous: number | null,
  current: number,
): number | null {
  if (previous === null) return null;
  return current - previous;
}

/**
 * Percentage change relative to previous. Returns null when previous is
 * null or zero (zero baseline — do not invent a percentage).
 */
export function percentageChange(
  previous: number | null,
  current: number,
): number | null {
  if (previous === null || previous === 0) return null;
  return (Math.abs(current - previous) / Math.abs(previous)) * 100;
}

export function exceedsAbsoluteThreshold(
  previous: number | null,
  current: number,
  threshold: number,
): boolean {
  const delta = absoluteDelta(previous, current);
  return delta !== null && delta >= threshold;
}

export function exceedsPercentageThreshold(
  previous: number | null,
  current: number,
  percentThreshold: number,
  minBaseline: number,
): boolean {
  if (previous === null || previous < minBaseline) return false;
  const pct = percentageChange(previous, current);
  return pct !== null && pct >= percentThreshold;
}

export function buildIncidentKey(parts: {
  ruleType: string;
  inventoryItemId: string;
  locationId: string;
  windowBucket?: string;
}): string {
  const bucket = parts.windowBucket ?? "open";
  return `${parts.ruleType}:${parts.inventoryItemId}:${parts.locationId}:${bucket}`;
}
