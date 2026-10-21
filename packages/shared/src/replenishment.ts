/** Default hours before the same rule/target may trigger again. */
export const REPLENISHMENT_SUPPRESSION_HOURS = 24;

export type ReplenishmentTarget =
  | { kind: "item"; inventoryItemId: string }
  | { kind: "group"; bundleGroupId: string };

/** Build a stable dedupe key: shop + target + supplier + UTC day (or condition). */
export function buildReplenishmentDedupeKey(input: {
  shopId: string;
  supplierId: string;
  inventoryItemId?: string | null;
  bundleGroupId?: string | null;
  at?: Date;
}): string {
  const day = (input.at ?? new Date()).toISOString().slice(0, 10);
  const target = input.inventoryItemId
    ? `item:${input.inventoryItemId}`
    : input.bundleGroupId
      ? `group:${input.bundleGroupId}`
      : "unknown";
  return `${input.shopId}|${target}|sup:${input.supplierId}|day:${day}`;
}

/** True when observed quantity is at or below the rule threshold. */
export function isBelowReplenishmentThreshold(
  quantity: number,
  lowStockThreshold: number,
): boolean {
  return quantity <= lowStockThreshold;
}

/** True when lastTriggeredAt is within the suppression window. */
export function isWithinSuppressionWindow(
  lastTriggeredAt: Date | string | null | undefined,
  now: Date = new Date(),
  windowHours: number = REPLENISHMENT_SUPPRESSION_HOURS,
): boolean {
  if (!lastTriggeredAt) return false;
  const last =
    lastTriggeredAt instanceof Date
      ? lastTriggeredAt
      : new Date(lastTriggeredAt);
  if (Number.isNaN(last.getTime())) return false;
  const ms = windowHours * 60 * 60 * 1000;
  return now.getTime() - last.getTime() < ms;
}

const OPEN_STATUSES = new Set([
  "DRAFT",
  "PENDING_APPROVAL",
  "QUEUED",
]);

export function isOpenReplenishmentStatus(status: string): boolean {
  return OPEN_STATUSES.has(status);
}

export function isValidSupplierEmail(email: string | null | undefined): boolean {
  const t = email?.trim() ?? "";
  return Boolean(t && t.includes("@") && t.includes("."));
}

/**
 * Decide whether evaluation should create/send a replenishment request.
 * Pure helper for unit tests and service orchestration.
 */
export function shouldTriggerReplenishment(input: {
  quantity: number;
  lowStockThreshold: number;
  ruleActive: boolean;
  lastTriggeredAt?: Date | string | null;
  openRequestExists: boolean;
  now?: Date;
  suppressionHours?: number;
}): { trigger: boolean; reason?: string } {
  if (!input.ruleActive) {
    return { trigger: false, reason: "rule_inactive" };
  }
  if (!isBelowReplenishmentThreshold(input.quantity, input.lowStockThreshold)) {
    return { trigger: false, reason: "above_threshold" };
  }
  if (
    isWithinSuppressionWindow(
      input.lastTriggeredAt,
      input.now,
      input.suppressionHours,
    )
  ) {
    return { trigger: false, reason: "suppression_window" };
  }
  if (input.openRequestExists) {
    return { trigger: false, reason: "open_request_exists" };
  }
  return { trigger: true };
}

/**
 * Auto-send only when merchant opted in, approval not required,
 * supplier verified, and email looks valid. Never from demo mode.
 */
export function canAutoSendReplenishmentEmail(input: {
  autoEmailEnabled: boolean;
  requireApproval: boolean;
  supplierVerified: boolean;
  supplierEmail: string | null | undefined;
  demoMode?: boolean;
}): boolean {
  if (input.demoMode) return false;
  if (!input.autoEmailEnabled) return false;
  if (input.requireApproval) return false;
  if (!input.supplierVerified) return false;
  return isValidSupplierEmail(input.supplierEmail);
}
