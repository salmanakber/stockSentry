import { Router } from "express";
import { healthRouter } from "./health.js";
import { overviewRouter } from "./overview.js";
import { incidentsRouter } from "./incidents.js";
import { historyRouter } from "./history.js";
import { productsRouter } from "./products.js";
import { bundlesRouter } from "./bundles.js";
import { settingsRouter } from "./settings.js";
import { notificationsRouter } from "./notifications.js";
import { exportsRouter } from "./exports.js";
import { onboardingRouter } from "./onboarding.js";
import { billingRouter } from "./billing.js";
import { suppliersRouter } from "./suppliers.js";

/**
 * Authenticated REST surface. OAuth lives at /auth on the main app;
 * webhooks at POST /webhooks/shopify.
 * Admin is mounted separately at /api/admin (before merchant auth).
 */
export const apiRouter = Router();

apiRouter.use("/v1", healthRouter);
apiRouter.use("/v1", overviewRouter);
apiRouter.use("/v1", incidentsRouter);
apiRouter.use("/v1", historyRouter);
apiRouter.use("/v1", productsRouter);
apiRouter.use("/v1", suppliersRouter);
apiRouter.use("/v1", bundlesRouter);
apiRouter.use("/v1", settingsRouter);
apiRouter.use("/v1", notificationsRouter);
apiRouter.use("/v1", exportsRouter);
apiRouter.use("/v1", onboardingRouter);
apiRouter.use("/v1", billingRouter);

apiRouter.get("/", (_req, res) => {
  res.json({
    name: "StockSentry API",
    version: "v1",
    endpoints: {
      health: "/api/v1/health",
      overview: "/api/v1/overview",
      incidents: "/api/v1/incidents",
      history: "/api/v1/history",
      products: "/api/v1/products",
      productDetail: "/api/v1/products/:id",
      productReport: "/api/v1/products/:id/report",
      sync: "/api/v1/sync",
      suppliers: "/api/v1/suppliers",
      bundles: "/api/v1/bundles",
      settings: "/api/v1/settings",
      emailTemplates: "/api/v1/settings/email-templates",
      notifications: "/api/v1/notifications",
      testEmail: "/api/v1/notifications/test-email",
      exports: "/api/v1/exports",
      onboarding: "/api/v1/onboarding",
      billing: "/api/v1/billing",
      billingStatus: "/api/v1/billing/status",
      billingSubscribe: "/api/v1/billing/subscribe",
      billingSelectFree: "/api/v1/billing/select-free",
      billingConfirm: "/api/v1/billing/confirm",
      plans: "/api/v1/plans",
      admin: "/api/admin",
      auth: "/auth",
      authCallback: "/auth/callback",
      authSession: "/auth/session",
      webhooks: "/webhooks/shopify",
    },
  });
});
