/** Initial detection defaults from product spec — configurable per shop. */
export const DETECTION_DEFAULTS = {
  absoluteChangeThreshold: 30,
  percentageChangeThreshold: 50,
  minBaselineForPercentage: 20,
  repeatedChangeWindowMinutes: 10,
  duplicateSuppressionMinutes: 30,
  reconciliationIntervalHours: 6,
  reconciliationIntervalMinutes: 360,
  /** Suggest refill when observed qty is at or below this (alerts only — never writes Shopify). */
  refillThreshold: 10,
} as const;

/** ShopSettings.thresholds JSON seeded on install. */
export const DEFAULT_THRESHOLDS = DETECTION_DEFAULTS;

/** ShopSettings.monitoring defaults. */
export const DEFAULT_MONITORING = {
  reconciliationIntervalHours: DETECTION_DEFAULTS.reconciliationIntervalHours,
  reconciliationIntervalMinutes:
    DETECTION_DEFAULTS.reconciliationIntervalMinutes,
  refillThreshold: DETECTION_DEFAULTS.refillThreshold,
} as const;

export const AI_DEFAULTS = {
  monthlyReportLimit: 50,
  promptVersion: "v1",
  provider: "openai",
} as const;

export type DetectionDefaults = typeof DETECTION_DEFAULTS;
