import {
  AI_PROVIDER_TIMEOUT_MS,
  AI_SYSTEM_PROMPT,
  aiReportOutputSchema,
  type AiGenerationResult,
  type AiProviderId,
  type AiProvidersConfig,
  type AiReportOutput,
} from "@stocksentry/shared";
import { resolveAiDefaultsConfig, resolveAiProvidersConfig } from "./app-config.js";

export type ProviderCallResult = {
  output: AiReportOutput;
  inputTokens?: number;
  outputTokens?: number;
  provider: AiProviderId;
  model: string;
};

class ProviderError extends Error {
  constructor(
    readonly provider: AiProviderId,
    message: string,
  ) {
    super(`${provider}: ${message}`);
    this.name = "ProviderError";
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function userPrompt(evidencePackage: unknown): string {
  return `Explain this inventory incident using only the evidence JSON.\n\n${JSON.stringify(evidencePackage)}`;
}

function parseJsonContent(content: string): AiReportOutput {
  const raw = JSON.parse(content) as unknown;
  const parsed = aiReportOutputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("invalid JSON schema");
  }
  return parsed.data;
}

async function callGroq(
  evidencePackage: unknown,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<Omit<ProviderCallResult, "provider">> {
  const res = await fetchWithTimeout(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: userPrompt(evidencePackage) },
        ],
      }),
    },
    timeoutMs,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty content");
  return {
    output: parseJsonContent(content),
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    model,
  };
}

async function callGemini(
  evidencePackage: unknown,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<Omit<ProviderCallResult, "provider">> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${AI_SYSTEM_PROMPT}\n\nRespond with a single JSON object only.\n\n${userPrompt(evidencePackage)}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
    timeoutMs,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };
  const content = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("");
  if (!content) throw new Error("empty content");
  return {
    output: parseJsonContent(content),
    inputTokens: data.usageMetadata?.promptTokenCount,
    outputTokens: data.usageMetadata?.candidatesTokenCount,
    model,
  };
}

async function callOpenAi(
  evidencePackage: unknown,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<Omit<ProviderCallResult, "provider">> {
  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: userPrompt(evidencePackage) },
        ],
      }),
    },
    timeoutMs,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("empty content");
  return {
    output: parseJsonContent(content),
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
    model,
  };
}

async function callClaude(
  evidencePackage: unknown,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<Omit<ProviderCallResult, "provider">> {
  const res = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0.2,
        system: AI_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `${userPrompt(evidencePackage)}\n\nRespond with a single JSON object only.`,
          },
        ],
      }),
    },
    timeoutMs,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const textBlock = data.content?.find((c) => c.type === "text");
  const content = textBlock?.text;
  if (!content) throw new Error("empty content");
  // Claude may wrap JSON in markdown fences
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : trimmed;
  return {
    output: parseJsonContent(jsonStr),
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
    model,
  };
}

async function callProvider(
  provider: AiProviderId,
  evidencePackage: unknown,
  config: AiProvidersConfig,
  timeoutMs: number,
): Promise<ProviderCallResult> {
  const entry = config[provider];
  if (!entry?.apiKey || entry.enabled === false) {
    throw new ProviderError(provider, "not configured or disabled");
  }

  const defaults: Record<AiProviderId, string> = {
    groq: "llama-3.3-70b-versatile",
    gemini: "gemini-2.0-flash",
    openai: "gpt-4o-mini",
    claude: "claude-3-5-haiku-latest",
  };
  const model = entry.model || defaults[provider];

  try {
    let result: Omit<ProviderCallResult, "provider">;
    switch (provider) {
      case "groq":
        result = await callGroq(evidencePackage, entry.apiKey, model, timeoutMs);
        break;
      case "gemini":
        result = await callGemini(
          evidencePackage,
          entry.apiKey,
          model,
          timeoutMs,
        );
        break;
      case "openai":
        result = await callOpenAi(
          evidencePackage,
          entry.apiKey,
          model,
          timeoutMs,
        );
        break;
      case "claude":
        result = await callClaude(
          evidencePackage,
          entry.apiKey,
          model,
          timeoutMs,
        );
        break;
      default:
        throw new ProviderError(provider, "unknown provider");
    }
    return { ...result, provider };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ProviderError(provider, msg);
  }
}

/**
 * Try providers in order (default groq → gemini → openai → claude).
 * Advances on failure / timeout / invalid JSON.
 */
export async function generateWithFallback(
  evidencePackage: unknown,
): Promise<ProviderCallResult> {
  const config = await resolveAiProvidersConfig();
  const defaults = await resolveAiDefaultsConfig();
  const timeoutMs = defaults.timeoutMs ?? AI_PROVIDER_TIMEOUT_MS;
  const order = config.order?.length
    ? config.order
    : (["groq", "gemini", "openai", "claude"] as AiProviderId[]);

  const errors: string[] = [];

  for (const provider of order) {
    try {
      const result = await callProvider(
        provider,
        evidencePackage,
        config,
        timeoutMs,
      );
      console.info(
        `[ai] provider succeeded: ${result.provider} model=${result.model}`,
      );
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      console.warn(`[ai] provider failed, trying next: ${msg}`);
    }
  }

  throw new Error(
    `ALL_AI_PROVIDERS_FAILED: ${errors.join(" | ").slice(0, 400)}`,
  );
}

export type { AiGenerationResult };
