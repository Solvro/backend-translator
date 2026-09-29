import OpenAI from "openai";

import env from "#start/env";

/**
 * Translation backend selection.
 *
 * `TRANSLATION_PROVIDER=openai` (default) uses OpenAI directly.
 * `TRANSLATION_PROVIDER=nvidia` uses the OpenAI-compatible NVIDIA NIM
 * endpoint, where `nvidia/nemotron-3-super-120b-a12b` is available free of
 * charge (preview tier). Model can be overridden with `TRANSLATION_MODEL`.
 */

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
export const DEFAULT_NVIDIA_MODEL = "nvidia/nemotron-3-super-120b-a12b";

export interface TranslationBackend {
  client: OpenAI;
  model: string;
  /** NVIDIA NIM rejects `store: true`, OpenAI accepts it. */
  store: boolean;
  /** Free preview tiers return 429/503 far more often than paid APIs. */
  maxAttempts: number;
  /** Parallel translations allowed before the provider starts throttling. */
  concurrency: number;
}

let cached: TranslationBackend | null = null;

export function getTranslationBackend(): TranslationBackend {
  if (cached !== null) {
    return cached;
  }

  const provider = env.get("TRANSLATION_PROVIDER") ?? "openai";
  if (provider !== "openai" && provider !== "nvidia") {
    throw new Error(
      `Invalid TRANSLATION_PROVIDER "${provider}", expected "openai" or "nvidia"`,
    );
  }

  if (provider === "nvidia") {
    const apiKey = env.get("NVIDIA_API_KEY");
    if (apiKey === undefined || apiKey === "") {
      throw new Error(
        "TRANSLATION_PROVIDER=nvidia requires NVIDIA_API_KEY to be set",
      );
    }
    cached = {
      client: new OpenAI({
        apiKey,
        baseURL: env.get("NVIDIA_BASE_URL") ?? NVIDIA_BASE_URL,
        timeout: 120_000,
        maxRetries: 0,
      }),
      model: env.get("TRANSLATION_MODEL") ?? DEFAULT_NVIDIA_MODEL,
      store: false,
      maxAttempts: 4,
      // The free preview tier throttles bursts, so keep batches narrow
      concurrency: parseConcurrency(env.get("TRANSLATION_CONCURRENCY"), 2),
    };
    return cached;
  }

  cached = {
    client: new OpenAI({ apiKey: env.get("OPENAI_API_KEY") }),
    model: env.get("TRANSLATION_MODEL") ?? DEFAULT_OPENAI_MODEL,
    store: true,
    maxAttempts: 3,
    concurrency: parseConcurrency(env.get("TRANSLATION_CONCURRENCY"), 8),
  };
  return cached;
}

function parseConcurrency(value: string | undefined, fallback: number) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : parsed;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number } | null)?.status;
  if (status === 429 || (status !== undefined && status >= 500)) {
    return true;
  }
  return /429|rate limit|overloaded|timeout/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

/**
 * Runs `worker` over every item keeping at most `limit` calls in flight.
 * Used by the batch endpoint so a burst of texts cannot trip provider
 * rate limits (the free NVIDIA tier starts returning 429 almost at once).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    },
  );

  await Promise.all(runners);
  return results;
}

/**
 * Single chat completion with retry. The NVIDIA preview tier throttles
 * aggressively, so failures there are usually transient.
 */
export async function completeChat(
  backend: TranslationBackend,
  systemPrompt: string,
  textChunk: string,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < backend.maxAttempts; attempt++) {
    try {
      const params: OpenAI.Chat.ChatCompletionCreateParams = {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: textChunk },
        ],
        model: backend.model,
        ...(backend.store ? { store: true } : {}),
      };
      const completion = await backend.client.chat.completions.create(params);
      return completion.choices[0]?.message?.content ?? "";
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === backend.maxAttempts - 1) {
        throw error;
      }
      // Rate limits need a real cool-off, server errors a short one
      const status = (error as { status?: number }).status;
      const base = status === 429 ? 5000 : 1000;
      await sleep(base * (attempt + 1));
    }
  }

  throw lastError;
}
