/** Initial detection defaults from product spec — configurable per shop. */
export const DETECTION_DEFAULTS = {
  absoluteChangeThreshold: 30,
  percentageChangeThreshold: 50,
  minBaselineForPercentage: 20,
  repeatedChangeWindowMinutes: 10,
  duplicateSuppressionMinutes: 30,
  reconciliationIntervalHours: 6,
} as const;

/** ShopSettings.thresholds JSON seeded on install. */
export const DEFAULT_THRESHOLDS = DETECTION_DEFAULTS;

export const AI_DEFAULTS = {
  monthlyReportLimit: 50,
  promptVersion: "v1",
  provider: "openai",
} as const;

export type DetectionDefaults = typeof DETECTION_DEFAULTS;
