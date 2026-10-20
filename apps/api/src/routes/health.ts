import { Router } from "express";
import {
  DETECTION_DEFAULTS,
  deriveMonitoringHealth,
  getPlanEntitlements,
} from "@stocksentry/shared";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    defaults: DETECTION_DEFAULTS,
    samplePlan: getPlanEntitlements("starter"),
    sampleHealth: deriveMonitoringHealth({
      installationStatus: "INSTALLED",
      lastWebhookAt: new Date(),
      lastReconciledAt: new Date(),
      reconciliationIntervalHours: DETECTION_DEFAULTS.reconciliationIntervalHours,
    }),
  });
});

// Placeholders for upcoming routes
healthRouter.get("/auth/status", (_req, res) => {
  res.status(501).json({
    error: "not_implemented",
    message: "Shopify OAuth / session auth will be mounted here.",
  });
});

healthRouter.post("/webhooks", (_req, res) => {
  res.status(501).json({
    error: "not_implemented",
    message: "Webhook HMAC verification and enqueue will be mounted here.",
  });
});
