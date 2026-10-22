import { Router } from "express";
import {
  prisma,
  type EmailTemplateKey,
  type IncidentSeverity,
  type Prisma,
} from "@stocksentry/database";
import {
  ADVANCED_RULE_TYPES,
  detectionRuleConfigSchema,
} from "@stocksentry/shared";
import { requireMerchant } from "../middleware/auth.js";
import {
  EntitlementError,
  assertAdvancedRules,
} from "../services/billing.js";
import { resolveEmailTemplate } from "../services/email.js";

export const settingsRouter = Router();

const EMAIL_KEYS: EmailTemplateKey[] = [
  "INCIDENT_ALERT",
  "REFILL_ALERT",
  "DIGEST",
  "TEST",
  "SUPPLIER_REPLENISH",
];

settingsRouter.get("/settings", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const [settings, rules, notificationPrefs, shop, emailTemplates] =
      await Promise.all([
        prisma.shopSettings.findUnique({ where: { shopId } }),
        prisma.detectionRule.findMany({
          where: { shopId },
          orderBy: { ruleType: "asc" },
        }),
        prisma.notificationPreference.findMany({ where: { shopId } }),
        prisma.shop.findUniqueOrThrow({
          where: { id: shopId },
          select: {
            planSlug: true,
            reconciliationIntervalHours: true,
            onboardingCompleted: true,
          },
        }),
        Promise.all(
          EMAIL_KEYS.map(async (key) => {
            const resolved = await resolveEmailTemplate(shopId, key);
            const override = await prisma.emailTemplate.findFirst({
              where: { shopId, key },
            });
            return {
              key,
              subject: resolved.subject,
              htmlBody: resolved.htmlBody,
              textBody: resolved.textBody,
              isOverride: Boolean(override),
              id: override?.id ?? null,
            };
          }),
        ),
      ]);

    res.json({
      shop,
      settings,
      detectionRules: rules,
      notificationPreferences: notificationPrefs,
      emailTemplates,
    });
  } catch (err) {
    next(err);
  }
});

settingsRouter.get(
  "/settings/email-templates",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const items = await Promise.all(
        EMAIL_KEYS.map(async (key) => {
          const resolved = await resolveEmailTemplate(shopId, key);
          const override = await prisma.emailTemplate.findFirst({
            where: { shopId, key },
          });
          return {
            key,
            subject: resolved.subject,
            htmlBody: resolved.htmlBody,
            textBody: resolved.textBody,
            isOverride: Boolean(override),
            id: override?.id ?? null,
          };
        }),
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

settingsRouter.put(
  "/settings/email-templates/:key",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const key = req.params.key as EmailTemplateKey;
      if (!EMAIL_KEYS.includes(key)) {
        res.status(400).json({ error: "invalid_template_key" });
        return;
      }
      const body = req.body as {
        subject?: string;
        htmlBody?: string;
        textBody?: string;
      };
      if (!body.subject?.trim() || !body.htmlBody?.trim() || !body.textBody?.trim()) {
        res.status(400).json({ error: "subject_html_text_required" });
        return;
      }

      const existing = await prisma.emailTemplate.findFirst({
        where: { shopId, key },
      });
      const tpl = existing
        ? await prisma.emailTemplate.update({
            where: { id: existing.id },
            data: {
              subject: body.subject.trim(),
              htmlBody: body.htmlBody,
              textBody: body.textBody,
            },
          })
        : await prisma.emailTemplate.create({
            data: {
              shopId,
              key,
              subject: body.subject.trim(),
              htmlBody: body.htmlBody,
              textBody: body.textBody,
            },
          });

      res.json({ ...tpl, isOverride: true });
    } catch (err) {
      next(err);
    }
  },
);

settingsRouter.patch("/settings", requireMerchant, async (req, res, next) => {
  try {
    const shopId = req.shopId!;
    const body = req.body as {
      thresholds?: unknown;
      monitoring?: unknown;
      ai?: unknown;
      retention?: unknown;
      reconciliationIntervalHours?: number;
      detectionRules?: Array<{
        ruleType: string;
        enabled?: boolean;
        configuration?: unknown;
      }>;
      notificationPreferences?: Array<{
        channel: "IN_APP" | "EMAIL" | "SLACK";
        enabled?: boolean;
        minSeverity?: IncidentSeverity;
        digestEnabled?: boolean;
        destinationRef?: string | null;
      }>;
    };

    if (typeof body.reconciliationIntervalHours === "number") {
      await prisma.shop.update({
        where: { id: shopId },
        data: {
          reconciliationIntervalHours: Math.max(
            1,
            body.reconciliationIntervalHours,
          ),
        },
      });
    }

    const settings = await prisma.shopSettings.upsert({
      where: { shopId },
      create: {
        shopId,
        thresholds: (body.thresholds ?? {}) as Prisma.InputJsonValue,
        monitoring: (body.monitoring ?? null) as Prisma.InputJsonValue,
        ai: (body.ai ?? null) as Prisma.InputJsonValue,
        retention: (body.retention ?? null) as Prisma.InputJsonValue,
      },
      update: {
        ...(body.thresholds !== undefined
          ? { thresholds: body.thresholds as Prisma.InputJsonValue }
          : {}),
        ...(body.monitoring !== undefined
          ? { monitoring: body.monitoring as Prisma.InputJsonValue }
          : {}),
        ...(body.ai !== undefined
          ? { ai: body.ai as Prisma.InputJsonValue }
          : {}),
        ...(body.retention !== undefined
          ? { retention: body.retention as Prisma.InputJsonValue }
          : {}),
      },
    });

    if (body.detectionRules?.length) {
      const enablingAdvanced = body.detectionRules.some(
        (rule) =>
          rule.enabled === true &&
          (ADVANCED_RULE_TYPES as readonly string[]).includes(rule.ruleType),
      );
      if (enablingAdvanced) {
        await assertAdvancedRules(shopId);
      }

      for (const rule of body.detectionRules) {
        const configParsed = detectionRuleConfigSchema.safeParse(
          rule.configuration ?? {},
        );
        await prisma.detectionRule.updateMany({
          where: { shopId, ruleType: rule.ruleType },
          data: {
            ...(rule.enabled !== undefined ? { enabled: rule.enabled } : {}),
            ...(rule.configuration !== undefined && configParsed.success
              ? {
                  configuration:
                    configParsed.data as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
      }
    }

    if (body.notificationPreferences?.length) {
      for (const pref of body.notificationPreferences) {
        await prisma.notificationPreference.upsert({
          where: {
            shopId_channel: { shopId, channel: pref.channel },
          },
          create: {
            shopId,
            channel: pref.channel,
            enabled: pref.enabled ?? true,
            minSeverity: pref.minSeverity ?? "MEDIUM",
            digestEnabled: pref.digestEnabled ?? false,
            destinationRef: pref.destinationRef ?? null,
          },
          update: {
            ...(pref.enabled !== undefined ? { enabled: pref.enabled } : {}),
            ...(pref.minSeverity !== undefined
              ? { minSeverity: pref.minSeverity }
              : {}),
            ...(pref.digestEnabled !== undefined
              ? { digestEnabled: pref.digestEnabled }
              : {}),
            ...(pref.destinationRef !== undefined
              ? { destinationRef: pref.destinationRef }
              : {}),
          },
        });
      }
    }

    const [rules, notificationPrefs, shop] = await Promise.all([
      prisma.detectionRule.findMany({ where: { shopId } }),
      prisma.notificationPreference.findMany({ where: { shopId } }),
      prisma.shop.findUniqueOrThrow({
        where: { id: shopId },
        select: {
          planSlug: true,
          reconciliationIntervalHours: true,
          onboardingCompleted: true,
        },
      }),
    ]);

    res.json({
      shop,
      settings,
      detectionRules: rules,
      notificationPreferences: notificationPrefs,
    });
  } catch (err) {
    if (err instanceof EntitlementError) {
      res.status(403).json({
        error: err.code.toLowerCase(),
        code: err.code,
        message: err.message,
      });
      return;
    }
    next(err);
  }
});
