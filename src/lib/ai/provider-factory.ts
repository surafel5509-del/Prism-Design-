import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { ProviderId } from "../types";
import { decryptSecret, maskKey } from "../crypto";
import { getProviderMeta } from "../providers";
import { getStoredKey } from "../db";

/**
 * Server-only. Resolves the user's provider credentials (saved encrypted key
 * first, then environment fallback) and instantiates the correct Vercel AI
 * SDK provider. The plaintext key never leaves the server.
 */

export interface ResolvedProvider {
  provider: ProviderId;
  apiKey: string;
  baseURL: string | null;
  source: "saved" | "env";
}

export function resolveProvider(provider: ProviderId): ResolvedProvider | null {
  const meta = getProviderMeta(provider);
  const stored = getStoredKey(provider);
  if (stored) {
    try {
      return {
        provider,
        apiKey: decryptSecret(stored.ciphertext),
        baseURL: stored.baseURL ?? meta.defaultBaseURL,
        source: "saved",
      };
    } catch {
      // Corrupt ciphertext / rotated encryption key — fall through to env.
    }
  }
  const envKey = process.env[meta.envVar]?.trim();
  if (provider === "ollama") {
    // Only treat env as "connected" when the user explicitly configured it.
    if (process.env.OLLAMA_BASE_URL) return { provider, apiKey: envKey ?? "ollama", baseURL: process.env.OLLAMA_BASE_URL, source: "env" };
    return null;
  }
  if (provider === "custom") {
    const base = process.env.CUSTOM_AI_BASE_URL?.trim();
    if (base) return { provider, apiKey: envKey ?? "custom", baseURL: base, source: "env" };
    return null;
  }
  if (envKey) return { provider, apiKey: envKey, baseURL: meta.defaultBaseURL, source: "env" };
  return null;
}

export function maskedFor(provider: ProviderId): { masked: string | null; source: "saved" | "env" | null } {
  const resolved = resolveProvider(provider);
  if (!resolved) return { masked: null, source: null };
  if (!getProviderMeta(provider).needsKey) return { masked: "local endpoint", source: resolved.source };
  return { masked: maskKey(resolved.apiKey), source: resolved.source };
}

export function getLanguageModel(resolved: ResolvedProvider, modelId: string): LanguageModel {
  const { provider, apiKey, baseURL } = resolved;
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey, ...(baseURL ? { baseURL } : {}) })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey, ...(baseURL ? { baseURL } : {}) })(modelId);
    case "deepseek":
      return createDeepSeek({ apiKey, ...(baseURL ? { baseURL } : {}) })(modelId);
    case "openrouter":
      return createOpenRouter({ apiKey })(modelId);
    case "groq":
    case "together":
    case "fireworks":
    case "ollama":
    case "custom":
      return createOpenAICompatible({
        name: provider,
        apiKey,
        baseURL: baseURL ?? getProviderMeta(provider).defaultBaseURL ?? "http://localhost:11434/v1",
      })(modelId);
    default:
      return createOpenAI({ apiKey })(modelId);
  }
}

/** Models-list endpoint per provider (used by Test Connection + live model lists). */
export function modelsEndpoint(resolved: ResolvedProvider): { url: string; headers: Record<string, string> } | null {
  const { provider, apiKey, baseURL } = resolved;
  const bearer = { Authorization: `Bearer ${apiKey}` };
  switch (provider) {
    case "openai":
      return { url: `${(baseURL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/models`, headers: bearer };
    case "anthropic":
      return {
        url: `${(baseURL ?? "https://api.anthropic.com").replace(/\/$/, "")}/v1/models`,
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      };
    case "google":
      return { url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, headers: {} };
    case "openrouter":
      return { url: "https://openrouter.ai/api/v1/models", headers: bearer };
    case "deepseek":
      return { url: `${(baseURL ?? "https://api.deepseek.com/v1").replace(/\/$/, "")}/models`, headers: bearer };
    default: {
      const base = baseURL ?? getProviderMeta(provider).defaultBaseURL;
      if (!base) return null;
      return { url: `${base.replace(/\/$/, "")}/models`, headers: bearer };
    }
  }
}
