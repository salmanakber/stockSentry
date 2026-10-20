import cors from "cors";
import express from "express";
import { apiRouter } from "./routes/index.js";
import { authRouter, beginAuth } from "./routes/auth.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { attachMerchantAuth } from "./middleware/auth.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.EMBEDDED_APP_URL ?? true,
      credentials: true,
    }),
  );

  // Shopify webhooks need raw body for HMAC — before json parser
  app.use(
    "/webhooks",
    express.text({ type: "*/*" }),
    webhooksRouter,
  );

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "stocksentry-api",
      brand: "Bundle Safety",
      ts: new Date().toISOString(),
    });
  });

  // OAuth on main app (not only under /api)
  app.use("/auth", authRouter);
  app.get("/api/auth", beginAuth);

  app.use("/api", attachMerchantAuth, apiRouter);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("[api] unhandled error", err);
      res.status(500).json({ error: "internal_error" });
    },
  );

  return app;
}
