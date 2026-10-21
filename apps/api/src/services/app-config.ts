import { prisma, type Prisma } from "@stocksentry/database";
import {
  APP_CONFIG_KEYS,
  DEFAULT_AI_PROVIDER_ORDER,
  aiDefaultsConfigSchema,
  aiProvidersConfigSchema,
  parseProviderOrder,
  resendConfigSchema,
  type AiDefaultsConfig,
  type AiProvidersConfig,
  type ResendConfig,
} from "@stocksentry/shared";

const configCache = new Map<string, { at: number; value: unknown }>();
const CONFIG_CACHE_TTL_MS = 30_000;

export function clearAppConfigCache(key?: string): void {
  if (key) configCache.delete(key);
  else configCache.clear();
}

export async function getAppConfigValue<T = unknown>(
  key: string,
): Promise<T | null> {
  const cached = configCache.get(key);
  if (cached && Date.now() - cached.at < CONFIG_CACHE_TTL_MS) {
    return cached.value as T;
  }
  const row = await prisma.appConfig.findUnique({ where: { key } });
  if (!row) return null;
  configCache.set(key, { at: Date.now(), value: row.value });
  return row.value as T;
}

export async function setAppConfigValue(
  key: string,
  value: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
  clearAppConfigCache(key);
}

function envAiProviders(): AiProvidersConfig {
  return {
    order: parseProviderOrder(process.env.AI_PROVIDER_ORDER),
    groq: {
      apiKey: process.env.GROQ_API_KEY || undefined,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || undefined,
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || undefined,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    },
    claude: {
      apiKey:
        process.env.ANTHROPIC_API_KEY ||
        process.env.CLAUDE_API_KEY ||
        undefined,
      model: process.env.CLAUDE_MODEL || "claude-3-5-haiku-latest",
    },
  };
}

/**
 * Merge AppConfig `ai.providers` with env fallbacks.
 * Env keys override empty AppConfig keys (admin-managed with env override).
 */
export async function resolveAiProvidersConfig(): Promise<AiProvidersConfig> {
  const fromDb = await getAppConfigValue<unknown>(APP_CONFIG_KEYS.AI_PROVIDERS);
  const env = envAiProviders();
  const parsed = aiProvidersConfigSchema.safeParse(fromDb ?? {});
  const db = parsed.success ? parsed.data : { order: DEFAULT_AI_PROVIDER_ORDER };

  const mergeEntry = (
    dbEntry: { apiKey?: string; model?: string; enabled?: boolean } | undefined,
    envEntry: { apiKey?: string; model?: string } | undefined,
  ) => ({
    apiKey: dbEntry?.apiKey || envEntry?.apiKey,
    model: dbEntry?.model || envEntry?.model,
    enabled: dbEntry?.enabled !== false,
  });

  return {
    order:
      db.order?.length > 0
        ? db.order
        : env.order.length > 0
          ? env.order
          : [...DEFAULT_AI_PROVIDER_ORDER],
    groq: mergeEntry(db.groq, env.groq),
    gemini: mergeEntry(db.gemini, env.gemini),
    openai: mergeEntry(db.openai, env.openai),
    claude: mergeEntry(db.claude, env.claude),
  };
}

export async function resolveAiDefaultsConfig(): Promise<AiDefaultsConfig> {
  const fromDb = await getAppConfigValue<unknown>(APP_CONFIG_KEYS.AI_DEFAULTS);
  const parsed = aiDefaultsConfigSchema.safeParse(fromDb ?? {});
  const monthlyFromEnv = process.env.AI_MONTHLY_REPORT_LIMIT
    ? Number(process.env.AI_MONTHLY_REPORT_LIMIT)
    : undefined;
  return {
    monthlyReportLimit:
      (parsed.success ? parsed.data.monthlyReportLimit : undefined) ??
      (Number.isFinite(monthlyFromEnv) ? monthlyFromEnv : undefined),
    promptVersion:
      (parsed.success ? parsed.data.promptVersion : undefined) ?? "v1",
    timeoutMs:
      (parsed.success ? parsed.data.timeoutMs : undefined) ?? 25_000,
  };
}

const DEFAULT_FROM_EMAIL =
  "StockSentry <noreply@stocksentry.tidyflowapp.com>";

/**
 * Merge AppConfig `email.resend` with env fallbacks.
 * AppConfig wins when a key is set; env fills gaps (`RESEND_API_KEY`, `EMAIL_FROM`).
 */
export async function resolveResendConfig(): Promise<ResendConfig> {
  const fromDb = await getAppConfigValue<unknown>(APP_CONFIG_KEYS.EMAIL_RESEND);
  const parsed = resendConfigSchema.safeParse(fromDb ?? {});
  const db = parsed.success ? parsed.data : {};

  return {
    apiKey: db.apiKey || process.env.RESEND_API_KEY || undefined,
    fromEmail:
      db.fromEmail ||
      process.env.EMAIL_FROM ||
      DEFAULT_FROM_EMAIL,
    enabled: db.enabled !== false,
  };
}
