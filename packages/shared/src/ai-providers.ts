import { z } from "zod";

export const AI_PROVIDER_IDS = [
  "groq",
  "gemini",
  "openai",
  "claude",
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const DEFAULT_AI_PROVIDER_ORDER: AiProviderId[] = [
  "groq",
  "gemini",
  "openai",
  "claude",
];

export const AI_PROVIDER_TIMEOUT_MS = 25_000;

export type AiProviderConfigEntry = {
  apiKey?: string;
  model?: string;
  enabled?: boolean;
};

export type AiProvidersConfig = {
  order: AiProviderId[];
  groq?: AiProviderConfigEntry;
  gemini?: AiProviderConfigEntry;
  openai?: AiProviderConfigEntry;
  claude?: AiProviderConfigEntry;
};

export type AiDefaultsConfig = {
  monthlyReportLimit?: number;
  promptVersion?: string;
  timeoutMs?: number;
};

export const aiProviderIdSchema = z.enum(AI_PROVIDER_IDS);

export const aiProviderConfigEntrySchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const aiProvidersConfigSchema = z.object({
  order: z.array(aiProviderIdSchema).min(1).default(DEFAULT_AI_PROVIDER_ORDER),
  groq: aiProviderConfigEntrySchema.optional(),
  gemini: aiProviderConfigEntrySchema.optional(),
  openai: aiProviderConfigEntrySchema.optional(),
  claude: aiProviderConfigEntrySchema.optional(),
});

export const aiDefaultsConfigSchema = z.object({
  monthlyReportLimit: z.number().int().positive().optional(),
  promptVersion: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export const APP_CONFIG_KEYS = {
  AI_PROVIDERS: "ai.providers",
  AI_DEFAULTS: "ai.defaults",
} as const;

export type AiGenerationResult = {
  provider: AiProviderId;
  model: string;
  output: unknown;
  inputTokens?: number;
  outputTokens?: number;
};

export function parseProviderOrder(raw: string | undefined): AiProviderId[] {
  if (!raw?.trim()) return [...DEFAULT_AI_PROVIDER_ORDER];
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid = parts.filter((p): p is AiProviderId =>
    (AI_PROVIDER_IDS as readonly string[]).includes(p),
  );
  return valid.length ? valid : [...DEFAULT_AI_PROVIDER_ORDER];
}

export function maskApiKey(key: string | undefined | null): string | null {
  if (!key) return null;
  if (key.length <= 4) return "****";
  return `****${key.slice(-4)}`;
}
