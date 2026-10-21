import { z } from "zod";
import { DETECTION_DEFAULTS } from "./defaults.js";

export const RULE_TYPES = [
  "LARGE_ABSOLUTE_CHANGE",
  "LARGE_PERCENTAGE_CHANGE",
  "REPEATED_CHANGES",
  "RECONCILIATION_DISCREPANCY",
  "STALE_MONITORING",
  "BUNDLE_COMPONENT_RISK",
  "REFILL_RISK",
  "CUSTOM_THRESHOLD",
] as const;

export type RuleType = (typeof RULE_TYPES)[number];

export const ruleTypeSchema = z.enum(RULE_TYPES);

/** Merchant-facing labels for detection rule types (keep backend IDs unchanged). */
export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  LARGE_ABSOLUTE_CHANGE: "Large quantity drop",
  LARGE_PERCENTAGE_CHANGE: "Large percent change",
  REPEATED_CHANGES: "Repeated changes",
  RECONCILIATION_DISCREPANCY: "Inventory verification mismatch",
  STALE_MONITORING: "Stale monitoring",
  BUNDLE_COMPONENT_RISK: "Bundle component risk",
  REFILL_RISK: "Refill suggestion",
  CUSTOM_THRESHOLD: "Custom threshold",
};

export function ruleTypeLabel(ruleType: string | null | undefined): string {
  if (!ruleType) return "Rule";
  if (ruleType in RULE_TYPE_LABELS) {
    return RULE_TYPE_LABELS[ruleType as RuleType];
  }
  return ruleType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) =>
    c.toUpperCase(),
  );
}

export const absoluteChangeConfigSchema = z.object({
  threshold: z.number().int().positive().default(DETECTION_DEFAULTS.absoluteChangeThreshold),
});

export const percentageChangeConfigSchema = z.object({
  percentThreshold: z
    .number()
    .positive()
    .default(DETECTION_DEFAULTS.percentageChangeThreshold),
  minBaseline: z
    .number()
    .int()
    .nonnegative()
    .default(DETECTION_DEFAULTS.minBaselineForPercentage),
});

export const repeatedChangesConfigSchema = z.object({
  windowMinutes: z
    .number()
    .int()
    .positive()
    .default(DETECTION_DEFAULTS.repeatedChangeWindowMinutes),
  minChanges: z.number().int().positive().default(3),
});

export const suppressionConfigSchema = z.object({
  windowMinutes: z
    .number()
    .int()
    .positive()
    .default(DETECTION_DEFAULTS.duplicateSuppressionMinutes),
});

export const detectionRuleConfigSchema = z.object({
  absolute: absoluteChangeConfigSchema.optional(),
  percentage: percentageChangeConfigSchema.optional(),
  repeated: repeatedChangesConfigSchema.optional(),
  suppression: suppressionConfigSchema.optional(),
});

export type DetectionRuleConfig = z.infer<typeof detectionRuleConfigSchema>;

export function defaultRuleConfigurations(): Record<
  RuleType,
  { enabled: boolean; configuration: DetectionRuleConfig; version: number }
> {
  return {
    LARGE_ABSOLUTE_CHANGE: {
      enabled: true,
      version: 1,
      configuration: {
        absolute: { threshold: DETECTION_DEFAULTS.absoluteChangeThreshold },
        suppression: {
          windowMinutes: DETECTION_DEFAULTS.duplicateSuppressionMinutes,
        },
      },
    },
    LARGE_PERCENTAGE_CHANGE: {
      enabled: true,
      version: 1,
      configuration: {
        percentage: {
          percentThreshold: DETECTION_DEFAULTS.percentageChangeThreshold,
          minBaseline: DETECTION_DEFAULTS.minBaselineForPercentage,
        },
        suppression: {
          windowMinutes: DETECTION_DEFAULTS.duplicateSuppressionMinutes,
        },
      },
    },
    REPEATED_CHANGES: {
      enabled: true,
      version: 1,
      configuration: {
        repeated: {
          windowMinutes: DETECTION_DEFAULTS.repeatedChangeWindowMinutes,
          minChanges: 3,
        },
        suppression: {
          windowMinutes: DETECTION_DEFAULTS.duplicateSuppressionMinutes,
        },
      },
    },
    RECONCILIATION_DISCREPANCY: {
      enabled: true,
      version: 1,
      configuration: {
        suppression: {
          windowMinutes: DETECTION_DEFAULTS.duplicateSuppressionMinutes,
        },
      },
    },
    STALE_MONITORING: {
      enabled: true,
      version: 1,
      configuration: {
        suppression: {
          windowMinutes: DETECTION_DEFAULTS.duplicateSuppressionMinutes,
        },
      },
    },
    BUNDLE_COMPONENT_RISK: {
      enabled: true,
      version: 1,
      configuration: {
        suppression: {
          windowMinutes: DETECTION_DEFAULTS.duplicateSuppressionMinutes,
        },
      },
    },
    REFILL_RISK: {
      enabled: true,
      version: 1,
      configuration: {
        absolute: { threshold: DETECTION_DEFAULTS.refillThreshold },
        suppression: {
          windowMinutes: DETECTION_DEFAULTS.duplicateSuppressionMinutes,
        },
      },
    },
    CUSTOM_THRESHOLD: {
      enabled: false,
      version: 1,
      configuration: {
        absolute: { threshold: DETECTION_DEFAULTS.absoluteChangeThreshold },
        percentage: {
          percentThreshold: DETECTION_DEFAULTS.percentageChangeThreshold,
          minBaseline: DETECTION_DEFAULTS.minBaselineForPercentage,
        },
        suppression: {
          windowMinutes: DETECTION_DEFAULTS.duplicateSuppressionMinutes,
        },
      },
    },
  };
}
