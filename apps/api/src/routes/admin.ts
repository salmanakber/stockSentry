import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma, type Prisma } from "@stocksentry/database";
import {
  APP_CONFIG_KEYS,
  DEFAULT_AI_PROVIDER_ORDER,
  maskApiKey,
  clearPlanEntitlementsCache,
  aiProvidersConfigSchema,
  aiDefaultsConfigSchema,
  resendConfigSchema,
} from "@stocksentry/shared";
import { requireAdmin } from "../middleware/admin-auth.js";
import { signAdminToken } from "../services/admin-auth.js";
import {
  getAppConfigValue,
  setAppConfigValue,
  clearAppConfigCache,
  resolveResendConfig,
} from "../services/app-config.js";
import {
  assignShopPlan,
  listActivePlans,
  planRowToEntitlements,
} from "../services/plans.js";
import { sendTemplatedEmail } from "../services/email.js";

export const adminRouter = Router();

function publicAdminUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function maskProvidersConfig(raw: unknown) {
  const parsed = aiProvidersConfigSchema.safeParse(raw ?? {});
  const cfg = parsed.success
    ? parsed.data
    : { order: [...DEFAULT_AI_PROVIDER_ORDER] as typeof DEFAULT_AI_PROVIDER_ORDER };

  const maskEntry = (entry?: { apiKey?: string; model?: string; enabled?: boolean }) =>
    entry
      ? {
          apiKeyMasked: maskApiKey(entry.apiKey),
          hasKey: Boolean(entry.apiKey),
          model: entry.model ?? null,
          enabled: entry.enabled !== false,
        }
      : { apiKeyMasked: null, hasKey: false, model: null, enabled: true };

  return {
    order: cfg.order,
    groq: maskEntry(cfg.groq),
    gemini: maskEntry(cfg.gemini),
    openai: maskEntry(cfg.openai),
    claude: maskEntry(cfg.claude),
  };
}

/** POST /api/admin/bootstrap — create first admin if none exist */
adminRouter.post("/bootstrap", async (req, res, next) => {
  try {
    const secret = process.env.ADMIN_BOOTSTRAP_SECRET;
    const header =
      req.headers["admin-bootstrap-secret"] ??
      req.headers["x-admin-bootstrap-secret"] ??
      req.headers["x-stocksentry-bootstrap-secret"];
    if (!secret || typeof header !== "string" || header !== secret) {
      res.status(403).json({ error: "forbidden", message: "Invalid bootstrap secret." });
      return;
    }

    const existing = await prisma.adminUser.count();
    if (existing > 0) {
      res.status(409).json({
        error: "already_bootstrapped",
        message: "Admin users already exist.",
      });
      return;
    }

    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "Owner";

    if (!email || password.length < 8) {
      res.status(400).json({
        error: "invalid_input",
        message: "email and password (min 8 chars) required.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        name,
        role: "OWNER",
      },
    });

    const token = signAdminToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    res.status(201).json({ token, user: publicAdminUser(user) });
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/login */
adminRouter.post("/login", async (req, res, next) => {
  try {
    const email =
      typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      res.status(400).json({ error: "invalid_input", message: "email and password required." });
      return;
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password." });
      return;
    }

    const token = signAdminToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    res.json({ token, user: publicAdminUser(user) });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/me */
adminRouter.get("/me", requireAdmin, async (req, res, next) => {
  try {
    const user = await prisma.adminUser.findUnique({
      where: { id: req.adminUserId! },
    });
    if (!user) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    res.json({ user: publicAdminUser(user) });
  } catch (err) {
    next(err);
  }
});

function maskResendConfig(raw: unknown) {
  const parsed = resendConfigSchema.safeParse(raw ?? {});
  const cfg = parsed.success ? parsed.data : {};
  return {
    apiKeyMasked: maskApiKey(cfg.apiKey),
    hasKey: Boolean(cfg.apiKey),
    last4: cfg.apiKey && cfg.apiKey.length > 4 ? cfg.apiKey.slice(-4) : null,
    fromEmail: cfg.fromEmail ?? null,
    enabled: cfg.enabled !== false,
  };
}

/** GET /api/admin/config/email */
adminRouter.get("/config/email", requireAdmin, async (_req, res, next) => {
  try {
    const stored = await getAppConfigValue(APP_CONFIG_KEYS.EMAIL_RESEND);
    const resolved = await resolveResendConfig();
    res.json({
      ...maskResendConfig(stored),
      resolvedHasKey: Boolean(resolved.apiKey),
      resolvedFromEmail: resolved.fromEmail ?? null,
      resolvedEnabled: resolved.enabled !== false,
      envFallback: {
        hasResendKey: Boolean(process.env.RESEND_API_KEY),
        emailFrom: process.env.EMAIL_FROM ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/admin/config/email */
adminRouter.patch("/config/email", requireAdmin, async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const existing =
      (await getAppConfigValue<{
        apiKey?: string;
        fromEmail?: string;
        enabled?: boolean;
      }>(APP_CONFIG_KEYS.EMAIL_RESEND)) ?? {};

    const nextCfg = {
      apiKey:
        typeof body.apiKey === "string" && body.apiKey.length > 0
          ? body.apiKey
          : body.clearKey
            ? undefined
            : existing.apiKey,
      fromEmail:
        typeof body.fromEmail === "string"
          ? body.fromEmail.trim()
          : existing.fromEmail,
      enabled:
        typeof body.enabled === "boolean" ? body.enabled : existing.enabled !== false,
    };

    const parsed = resendConfigSchema.safeParse(nextCfg);
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_email_config",
        details: parsed.error.flatten(),
      });
      return;
    }

    await setAppConfigValue(
      APP_CONFIG_KEYS.EMAIL_RESEND,
      parsed.data as unknown as Prisma.InputJsonValue,
    );
    clearAppConfigCache(APP_CONFIG_KEYS.EMAIL_RESEND);

    const stored = await getAppConfigValue(APP_CONFIG_KEYS.EMAIL_RESEND);
    res.json(maskResendConfig(stored));
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/config/email/test */
adminRouter.post("/config/email/test", requireAdmin, async (req, res, next) => {
  try {
    const to =
      typeof req.body?.to === "string" ? req.body.to.trim() : "";
    if (!to || !to.includes("@")) {
      res.status(400).json({ ok: false, error: "invalid_to", message: "Valid to address required" });
      return;
    }

    const cfg = await resolveResendConfig();
    if (cfg.enabled === false) {
      res.status(400).json({
        ok: false,
        error: "disabled",
        message: "Resend is disabled in AppConfig",
      });
      return;
    }
    if (!cfg.apiKey) {
      res.status(400).json({
        ok: false,
        error: "NO_EMAIL_PROVIDER",
        message: "No Resend API key configured (AppConfig or RESEND_API_KEY)",
      });
      return;
    }

    const result = await sendTemplatedEmail({
      shopId: "",
      to,
      key: "TEST",
      vars: {
        shopName: "StockSentry admin",
        summary: "Admin Resend configuration test",
        incidentTitle: "Test",
        severity: "INFO",
        productTitle: "—",
        locationName: "—",
        previousQuantity: "—",
        currentQuantity: "—",
        quantityDelta: "—",
        quantityBeforeAfter: "—",
        whyFlagged: "Admin panel test send.",
        confirmedNote: "No inventory facts were evaluated.",
        disclaimer:
          "StockSentry is read-only and does not change Shopify inventory.",
        incidentUrl: process.env.APP_URL ?? "https://stocksentry.tidyflowapp.com",
        productUrl: process.env.APP_URL ?? "https://stocksentry.tidyflowapp.com",
      },
    });

    if (!result.ok) {
      res.status(502).json({
        ok: false,
        error: result.errorCode ?? "EMAIL_SEND_FAILED",
        message: `Send failed (${result.errorCode ?? "unknown"})`,
        provider: result.provider,
      });
      return;
    }

    res.json({
      ok: true,
      message: `Test email sent to ${to}`,
      provider: result.provider,
      messageId: result.messageId,
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/config/ai */
adminRouter.get("/config/ai", requireAdmin, async (_req, res, next) => {
  try {
    const providers = await getAppConfigValue(APP_CONFIG_KEYS.AI_PROVIDERS);
    const defaults = await getAppConfigValue(APP_CONFIG_KEYS.AI_DEFAULTS);
    const defaultsParsed = aiDefaultsConfigSchema.safeParse(defaults ?? {});
    res.json({
      providers: maskProvidersConfig(providers),
      defaults: defaultsParsed.success ? defaultsParsed.data : {},
      envFallback: {
        order: process.env.AI_PROVIDER_ORDER ?? DEFAULT_AI_PROVIDER_ORDER.join(","),
        hasGroq: Boolean(process.env.GROQ_API_KEY),
        hasGemini: Boolean(process.env.GEMINI_API_KEY),
        hasOpenai: Boolean(process.env.OPENAI_API_KEY),
        hasClaude: Boolean(
          process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
        ),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/admin/config/ai */
adminRouter.patch("/config/ai", requireAdmin, async (req, res, next) => {
  try {
    const body = req.body ?? {};

    if (body.providers != null) {
      const existing =
        (await getAppConfigValue<Record<string, unknown>>(
          APP_CONFIG_KEYS.AI_PROVIDERS,
        )) ?? {};
      const incoming = body.providers as Record<string, unknown>;

      const mergeProvider = (
        _key: string,
        incomingEntry: unknown,
        existingEntry: unknown,
      ) => {
        const prev = (existingEntry ?? {}) as { apiKey?: string; model?: string; enabled?: boolean };
        const next = (incomingEntry ?? {}) as {
          apiKey?: string;
          model?: string;
          enabled?: boolean;
          clearKey?: boolean;
        };
        return {
          apiKey: next.clearKey
            ? undefined
            : typeof next.apiKey === "string" && next.apiKey.length > 0
              ? next.apiKey
              : prev.apiKey,
          model: next.model !== undefined ? next.model : prev.model,
          enabled: next.enabled !== undefined ? next.enabled : prev.enabled,
        };
      };

      const merged = {
        order: Array.isArray(incoming.order)
          ? incoming.order
          : (existing as { order?: string[] }).order ?? [
              ...DEFAULT_AI_PROVIDER_ORDER,
            ],
        groq: mergeProvider("groq", incoming.groq, (existing as { groq?: unknown }).groq),
        gemini: mergeProvider(
          "gemini",
          incoming.gemini,
          (existing as { gemini?: unknown }).gemini,
        ),
        openai: mergeProvider(
          "openai",
          incoming.openai,
          (existing as { openai?: unknown }).openai,
        ),
        claude: mergeProvider(
          "claude",
          incoming.claude,
          (existing as { claude?: unknown }).claude,
        ),
      };

      const parsed = aiProvidersConfigSchema.safeParse(merged);
      if (!parsed.success) {
        res.status(400).json({
          error: "invalid_providers",
          details: parsed.error.flatten(),
        });
        return;
      }
      await setAppConfigValue(
        APP_CONFIG_KEYS.AI_PROVIDERS,
        parsed.data as unknown as Prisma.InputJsonValue,
      );
    }

    if (body.defaults != null) {
      const parsed = aiDefaultsConfigSchema.safeParse(body.defaults);
      if (!parsed.success) {
        res.status(400).json({
          error: "invalid_defaults",
          details: parsed.error.flatten(),
        });
        return;
      }
      await setAppConfigValue(
        APP_CONFIG_KEYS.AI_DEFAULTS,
        parsed.data as unknown as Prisma.InputJsonValue,
      );
    }

    clearAppConfigCache();
    const providers = await getAppConfigValue(APP_CONFIG_KEYS.AI_PROVIDERS);
    const defaults = await getAppConfigValue(APP_CONFIG_KEYS.AI_DEFAULTS);
    res.json({
      providers: maskProvidersConfig(providers),
      defaults: defaults ?? {},
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/plans */
adminRouter.get("/plans", requireAdmin, async (_req, res, next) => {
  try {
    const rows = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    res.json({
      items: rows.length
        ? rows.map(planRowToEntitlements)
        : await listActivePlans(),
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/plans */
adminRouter.post("/plans", requireAdmin, async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const slug =
      typeof b.slug === "string" ? b.slug.trim().toLowerCase() : "";
    if (!slug) {
      res.status(400).json({ error: "invalid_input", message: "slug required" });
      return;
    }

    const row = await prisma.plan.create({
      data: {
        slug,
        displayName:
          typeof b.displayName === "string" ? b.displayName : slug,
        description:
          typeof b.description === "string" ? b.description : null,
        priceUsdMonthly: Number(b.priceUsdMonthly ?? 0),
        trialDays: Number(b.trialDays ?? 0),
        maxMonitoredItems: Number(b.maxMonitoredItems ?? 100),
        historyDays: Number(b.historyDays ?? 14),
        maxOpenIncidents: Number(b.maxOpenIncidents ?? 25),
        aiReportsPerMonth: Number(b.aiReportsPerMonth ?? 5),
        advancedRules: Boolean(b.advancedRules),
        exportsEnabled: Boolean(b.exportsEnabled),
        teamWorkflows: Boolean(b.teamWorkflows),
        isFree: Boolean(b.isFree ?? Number(b.priceUsdMonthly ?? 0) <= 0),
        active: b.active !== false,
        sortOrder: Number(b.sortOrder ?? 0),
      },
    });
    clearPlanEntitlementsCache();
    res.status(201).json(planRowToEntitlements(row));
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/admin/plans/:idOrSlug */
adminRouter.patch("/plans/:idOrSlug", requireAdmin, async (req, res, next) => {
  try {
    const idOrSlug = req.params.idOrSlug;
    const existing = await prisma.plan.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });
    if (!existing) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const b = req.body ?? {};
    const data: Prisma.PlanUpdateInput = {};
    if (typeof b.displayName === "string") data.displayName = b.displayName;
    if (typeof b.description === "string" || b.description === null)
      data.description = b.description;
    if (b.priceUsdMonthly != null)
      data.priceUsdMonthly = Number(b.priceUsdMonthly);
    if (b.trialDays != null) data.trialDays = Number(b.trialDays);
    if (b.maxMonitoredItems != null)
      data.maxMonitoredItems = Number(b.maxMonitoredItems);
    if (b.historyDays != null) data.historyDays = Number(b.historyDays);
    if (b.maxOpenIncidents != null)
      data.maxOpenIncidents = Number(b.maxOpenIncidents);
    if (b.aiReportsPerMonth != null)
      data.aiReportsPerMonth = Number(b.aiReportsPerMonth);
    if (b.advancedRules != null) data.advancedRules = Boolean(b.advancedRules);
    if (b.exportsEnabled != null)
      data.exportsEnabled = Boolean(b.exportsEnabled);
    if (b.teamWorkflows != null) data.teamWorkflows = Boolean(b.teamWorkflows);
    if (b.isFree != null) data.isFree = Boolean(b.isFree);
    if (b.active != null) data.active = Boolean(b.active);
    if (b.sortOrder != null) data.sortOrder = Number(b.sortOrder);

    const row = await prisma.plan.update({
      where: { id: existing.id },
      data,
    });
    clearPlanEntitlementsCache();
    res.json(planRowToEntitlements(row));
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/shops?q= */
adminRouter.get("/shops", requireAdmin, async (req, res, next) => {
  try {
    const q =
      typeof req.query.q === "string" ? req.query.q.trim() : "";
    const shops = await prisma.shop.findMany({
      where: q
        ? { shopDomain: { contains: q, mode: "insensitive" } }
        : undefined,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        plan: true,
        _count: {
          select: {
            incidents: true,
            inventoryItems: true,
            aiReports: true,
          },
        },
      },
    });

    res.json({
      items: shops.map((s) => ({
        id: s.id,
        shopDomain: s.shopDomain,
        installationStatus: s.installationStatus,
        planSlug: s.planSlug,
        planId: s.planId,
        planAssignedByAdmin: s.planAssignedByAdmin,
        billingStatus: s.billingStatus,
        shopifySubscriptionGid: s.shopifySubscriptionGid,
        aiReportsUsedMonth: s.aiReportsUsedMonth,
        installedAt: s.installedAt,
        uninstalledAt: s.uninstalledAt,
        plan: s.plan ? planRowToEntitlements(s.plan) : null,
        usage: {
          incidents: s._count.incidents,
          inventoryItems: s._count.inventoryItems,
          aiReports: s._count.aiReports,
        },
      })),
    });
  } catch (err) {
    next(err);
  }
});

/** PATCH /api/admin/shops/:id — assign complimentary plan */
adminRouter.patch("/shops/:id", requireAdmin, async (req, res, next) => {
  try {
    const shop = await prisma.shop.findUnique({ where: { id: req.params.id } });
    if (!shop) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const planSlug =
      typeof req.body?.planSlug === "string"
        ? req.body.planSlug.trim().toLowerCase()
        : shop.planSlug;

    const skipShopifyBilling = req.body?.skipShopifyBilling !== false;

    const updated = await assignShopPlan({
      shopId: shop.id,
      planSlug,
      planAssignedByAdmin: true,
      billingStatus: skipShopifyBilling ? "ACTIVE" : shop.billingStatus,
      clearShopifySubscription: skipShopifyBilling,
    });

    res.json({
      id: updated.id,
      shopDomain: updated.shopDomain,
      planSlug: updated.planSlug,
      planId: updated.planId,
      planAssignedByAdmin: updated.planAssignedByAdmin,
      billingStatus: updated.billingStatus,
      shopifySubscriptionGid: updated.shopifySubscriptionGid,
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/shops/:id/clear-plan — force free */
adminRouter.post(
  "/shops/:id/clear-plan",
  requireAdmin,
  async (req, res, next) => {
    try {
      const shop = await prisma.shop.findUnique({
        where: { id: req.params.id },
      });
      if (!shop) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      const updated = await assignShopPlan({
        shopId: shop.id,
        planSlug: "free",
        planAssignedByAdmin: false,
        billingStatus: "NONE",
        clearShopifySubscription: true,
      });

      res.json({
        id: updated.id,
        shopDomain: updated.shopDomain,
        planSlug: updated.planSlug,
        planId: updated.planId,
        planAssignedByAdmin: updated.planAssignedByAdmin,
        billingStatus: updated.billingStatus,
        shopifySubscriptionGid: updated.shopifySubscriptionGid,
      });
    } catch (err) {
      next(err);
    }
  },
);

/** POST /api/admin/config/ai/test */
adminRouter.post("/config/ai/test", requireAdmin, async (req, res, next) => {
  try {
    const providerId =
      typeof req.body?.providerId === "string"
        ? req.body.providerId.trim().toLowerCase()
        : "";
    const overrideKey =
      typeof req.body?.apiKey === "string" ? req.body.apiKey : "";

    const stored =
      (await getAppConfigValue<Record<string, unknown>>(
        APP_CONFIG_KEYS.AI_PROVIDERS,
      )) ?? {};
    const entry = (stored[providerId] ?? {}) as { apiKey?: string };
    const apiKey = overrideKey || entry.apiKey || "";

    if (!providerId) {
      res.status(400).json({ ok: false, message: "providerId required" });
      return;
    }
    if (!apiKey) {
      res.status(400).json({
        ok: false,
        message: "No API key configured for this provider",
      });
      return;
    }

    if (providerId === "openai" || providerId === "groq") {
      const base =
        providerId === "groq"
          ? "https://api.groq.com/openai"
          : "https://api.openai.com";
      const r = await fetch(`${base}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      res.json({
        ok: r.ok,
        message: r.ok
          ? `${providerId} connection OK`
          : `${providerId} responded ${r.status}`,
      });
      return;
    }

    if (providerId === "claude") {
      const r = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });
      res.json({
        ok: r.ok,
        message: r.ok
          ? "Claude connection OK"
          : `Claude responded ${r.status}`,
      });
      return;
    }

    if (providerId === "gemini") {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      );
      res.json({
        ok: r.ok,
        message: r.ok
          ? "Gemini connection OK"
          : `Gemini responded ${r.status}`,
      });
      return;
    }

    res.json({ ok: true, message: "Provider key present (no live probe)" });
  } catch (err) {
    next(err);
  }
});

/** GET /api/admin/settings */
adminRouter.get("/settings", requireAdmin, (_req, res) => {
  res.json({
    bootstrapNote:
      "Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_JWT_SECRET in the monorepo root .env. On API boot, ensureAdminFromEnv upserts an OWNER AdminUser from those values. Sign in at /admin/login; the JWT is stored in the browser and sent as x-stocksentry-admin-token. Optional: POST /api/admin/bootstrap with x-stocksentry-bootstrap-secret if no AdminUser exists yet.",
    jwt: {
      headerName: "x-stocksentry-admin-token",
      algorithm: "HS256",
      ttlHours: Number(process.env.ADMIN_JWT_TTL_HOURS ?? 12),
      configured: Boolean(
        process.env.ADMIN_JWT_SECRET || process.env.SESSION_SECRET,
      ),
    },
    adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
    bootstrapSecretConfigured: Boolean(process.env.ADMIN_BOOTSTRAP_SECRET),
  });
});

/** GET /api/admin/stats */
adminRouter.get("/stats", requireAdmin, async (_req, res, next) => {
  try {
    const [
      shopsTotal,
      shopsInstalled,
      shopsUninstalled,
      incidentsOpen,
      incidentsTotal,
      aiGenerated,
      aiFailed,
      aiUsedMonth,
    ] = await Promise.all([
      prisma.shop.count(),
      prisma.shop.count({ where: { installationStatus: "INSTALLED" } }),
      prisma.shop.count({ where: { installationStatus: "UNINSTALLED" } }),
      prisma.incident.count({
        where: { status: { in: ["NEW", "INVESTIGATING"] } },
      }),
      prisma.incident.count(),
      prisma.aiReport.count({ where: { status: "GENERATED" } }),
      prisma.aiReport.count({ where: { status: "FAILED" } }),
      prisma.shop.aggregate({ _sum: { aiReportsUsedMonth: true } }),
    ]);

    const byPlan = await prisma.shop.groupBy({
      by: ["planSlug"],
      _count: { _all: true },
    });

    res.json({
      shops: {
        total: shopsTotal,
        installed: shopsInstalled,
        uninstalled: shopsUninstalled,
        byPlan: byPlan.map((r) => ({
          planSlug: r.planSlug,
          count: r._count._all,
        })),
      },
      incidents: { total: incidentsTotal, open: incidentsOpen },
      ai: {
        generated: aiGenerated,
        failed: aiFailed,
        usedThisMonthAcrossShops: aiUsedMonth._sum.aiReportsUsedMonth ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});
