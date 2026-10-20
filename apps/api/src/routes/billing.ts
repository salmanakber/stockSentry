import { Router, type NextFunction, type Request, type Response } from "express";
import { planSlugSchema } from "@stocksentry/shared";
import { requireMerchant } from "../middleware/auth.js";
import { aiReportUsageSummary } from "../services/ai-report.js";
import {
  EntitlementError,
  confirmSubscriptionStub,
  createPlanSubscription,
  getBillingStatus,
  reconcileSubscriptionStatus,
} from "../services/billing.js";

export const billingRouter = Router();

async function billingStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const shopId = req.shopId!;
    const status = await getBillingStatus(shopId);
    const aiReports = await aiReportUsageSummary(shopId);

    res.json({
      ...status,
      usage: {
        ...status.usage,
        aiReportsUsed: aiReports.used,
        aiReportsLimit: aiReports.limit,
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Plan usage + entitlements (legacy path). */
billingRouter.get("/billing", requireMerchant, billingStatusHandler);

/** Preferred status path. */
billingRouter.get("/billing/status", requireMerchant, billingStatusHandler);

billingRouter.post(
  "/billing/subscribe",
  requireMerchant,
  async (req, res, next) => {
    try {
      const shopId = req.shopId!;
      const shopDomain = req.shop!;
      const planSlug =
        typeof req.body?.planSlug === "string" ? req.body.planSlug : "";

      const parsed = planSlugSchema.safeParse(planSlug);
      if (!parsed.success) {
        res.status(400).json({
          error: "invalid_plan",
          code: "ENTITLEMENT_INVALID_PLAN",
          message: "planSlug must be one of: free, starter, pro",
        });
        return;
      }

      const result = await createPlanSubscription({
        shopId,
        shopDomain,
        sessionToken: req.sessionToken,
        planSlug: parsed.data,
      });

      res.status(result.confirmationUrl ? 202 : 200).json({
        ok: true,
        planSlug: result.planSlug,
        billingStatus: result.billingStatus,
        confirmationUrl: result.confirmationUrl,
        subscriptionId: result.subscriptionId,
        message: result.confirmationUrl
          ? "Approve the subscription charge in Shopify Admin to activate this plan."
          : "Free plan activated.",
      });
    } catch (err) {
      if (err instanceof EntitlementError) {
        res.status(400).json({
          error: err.code.toLowerCase(),
          code: err.code,
          message: err.message,
        });
        return;
      }
      next(err);
    }
  },
);

/**
 * Stub confirmation after return from Shopify billing approval.
 * Reconciles active subscriptions from Admin GraphQL.
 */
billingRouter.post(
  "/billing/confirm",
  requireMerchant,
  async (req, res, next) => {
    try {
      const result = await confirmSubscriptionStub({
        shopId: req.shopId!,
        shopDomain: req.shop!,
        sessionToken: req.sessionToken,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);

billingRouter.post(
  "/billing/reconcile",
  requireMerchant,
  async (req, res, next) => {
    try {
      const result = await reconcileSubscriptionStatus({
        shopId: req.shopId!,
        shopDomain: req.shop!,
        sessionToken: req.sessionToken,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  },
);
