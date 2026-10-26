import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModelV1 } from 'ai';
import { getProvider, PROVIDERS } from './providers';

export interface RuntimeConfig { provider: string; model: string; apiKey: string; baseUrl?: string }

const OPENROUTER_HEADERS = { 'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://prism.studio', 'X-Title': 'Prism Studio' };

export function languageModel(cfg: RuntimeConfig): LanguageModelV1 {
  const provider = getProvider(cfg.provider);
  const baseURL = cfg.baseUrl || provider?.baseUrl;
  const apiKey = cfg.apiKey || (provider?.requiresKey === false ? 'not-needed' : '');
  switch (cfg.provider) {
    case 'openai':
      return createOpenAI({ apiKey, baseURL, compatibility: 'strict' })(cfg.model);
    case 'anthropic':
      return createAnthropic({ apiKey, baseURL })(cfg.model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey, baseURL })(cfg.model);
    case 'deepseek':
      return createDeepSeek({ apiKey, baseURL })(cfg.model);
    case 'openrouter':
      return createOpenAI({ apiKey, baseURL: baseURL ?? 'https://openrouter.ai/api/v1', headers: OPENROUTER_HEADERS })(cfg.model);
    case 'opencode':
      return createOpenAICompatible({ name: 'opencode', apiKey, baseURL: baseURL ?? 'https://opencode.ai/inference/openai/v1', headers: { 'X-Title': 'Prism Studio' } })(cfg.model);
    case 'groq':
      return createOpenAICompatible({ name: 'groq', apiKey, baseURL: baseURL ?? 'https://api.groq.com/openai/v1' })(cfg.model);
    case 'together':
      return createOpenAICompatible({ name: 'together', apiKey, baseURL: baseURL ?? 'https://api.together.xyz/v1' })(cfg.model);
    case 'fireworks':
      return createOpenAICompatible({ name: 'fireworks', apiKey, baseURL: baseURL ?? 'https://api.fireworks.ai/inference/v1' })(cfg.model);
    case 'ollama':
      return createOpenAICompatible({ name: 'ollama', apiKey, baseURL: baseURL ?? 'http://127.0.0.1:11434/v1' })(cfg.model);
    case 'lmstudio':
      return createOpenAICompatible({ name: 'lmstudio', apiKey, baseURL: baseURL ?? 'http://127.0.0.1:1234/v1' })(cfg.model);
    default:
      return createOpenAICompatible({ name: cfg.provider || 'custom', apiKey, baseURL: baseURL ?? '' })(cfg.model);
  }
}

// ── Model discovery ───────────────────────────────────────────────────────
const cache = new Map<string, { at: number; models: { id: string; name: string }[] }>();
const TTL = 5 * 60 * 1000;

function authHeaders(providerId: string, apiKey: string): Record<string, string> {
  if (providerId === 'anthropic') return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  if (providerId === 'google') return {};
  if (providerId === 'openrouter') return { Authorization: `Bearer ${apiKey}`, ...OPENROUTER_HEADERS };
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export async function fetchModels(providerId: string, apiKey: string, baseUrl?: string): Promise<{ id: string; name: string }[]> {
  const def = getProvider(providerId);
  if (!def) throw new Error(`Unknown provider ${providerId}`);
  const cacheKey = `${providerId}:${baseUrl ?? def.baseUrl}:${apiKey.slice(-6)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.models;

  let url = def.modelsEndpoint || '';
  if (!url && baseUrl) url = `${baseUrl.replace(/\/$/, '')}/models`;
  if (!url) throw new Error('No models endpoint configured');
  if (providerId === 'google') url = `${url}?key=${encodeURIComponent(apiKey)}&pageSize=200`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { headers: authHeaders(providerId, apiKey), signal: controller.signal, cache: 'no-store' });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 180)}` : ''}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    let models: { id: string; name: string }[] = [];
    if (providerId === 'google') {
      const arr = (json.models as { name: string; displayName?: string; supportedGenerationMethods?: string[] }[]) ?? [];
      models = arr
        .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
        .map((m) => ({ id: m.name.replace(/^models\//, ''), name: m.displayName ?? m.name.replace(/^models\//, '') }));
    } else if (providerId === 'anthropic') {
      const arr = (json.data as { id: string; display_name?: string }[]) ?? [];
      models = arr.map((m) => ({ id: m.id, name: m.display_name ?? m.id }));
    } else if (providerId === 'openrouter') {
      const arr = (json.data as { id: string; name?: string }[]) ?? [];
      models = arr.map((m) => ({ id: m.id, name: m.name ?? m.id })).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const arr = (json.data as { id: string }[]) ?? [];
      models = arr.map((m) => ({ id: m.id, name: m.id })).filter((m) => !/embed|whisper|tts|dall-e|moderation|audio/i.test(m.id));
    }
    if (!models.length) throw new Error('Provider returned an empty model list');
    models.sort((a, b) => a.name.localeCompare(b.name));
    cache.set(cacheKey, { at: Date.now(), models });
    return models;
  } finally {
    clearTimeout(timer);
  }
}

export function invalidateModelCache() { cache.clear(); }

export function providerLogoData(providerId: string) {
  return PROVIDERS.find((p) => p.id === providerId)?.accent ?? '#8b5cf6';
}

// ── Image generation ──────────────────────────────────────────────────────
export interface GeneratedImage { dataUrl: string; revisedPrompt?: string; model: string }

export async function generateImage(cfg: { provider: string; apiKey: string; baseUrl?: string; model?: string; prompt: string; size?: '1024x1024' | '1536x1024' | '1024x1536'; quality?: 'low' | 'medium' | 'high' }): Promise<GeneratedImage> {
  if (cfg.provider === 'openai') {
    const base = cfg.baseUrl || 'https://api.openai.com/v1';
    const model = cfg.model && cfg.model !== 'gpt-4.1' ? cfg.model : 'gpt-image-1';
    const res = await fetch(`${base}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt: cfg.prompt, size: cfg.size ?? '1024x1024', quality: cfg.quality ?? 'medium', n: 1 }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`OpenAI image generation failed (${res.status}): ${err.slice(0, 240)}`);
    }
    const json = (await res.json()) as { data?: { b64_json?: string; url?: string; revised_prompt?: string }[] };
    const item = json.data?.[0];
    if (!item) throw new Error('No image returned');
    if (item.b64_json) return { dataUrl: `data:image/png;base64,${item.b64_json}`, revisedPrompt: item.revised_prompt, model };
    if (item.url) {
      const img = await fetch(item.url);
      const buf = Buffer.from(await img.arrayBuffer());
      return { dataUrl: `data:image/png;base64,${buf.toString('base64')}`, revisedPrompt: item.revised_prompt, model };
    }
    throw new Error('Image response contained no data');
  }

  if (cfg.provider === 'google') {
    const base = cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const model = (cfg.model && cfg.model.includes('image')) ? cfg.model : 'imagen-3.0-generate-002';
    if (model.includes('gemini')) {
      const res = await fetch(`${base}/models/${model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: cfg.prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
      });
      if (!res.ok) throw new Error(`Gemini image generation failed (${res.status}): ${(await res.text()).slice(0, 240)}`);
      const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] } }[] };
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part?.inlineData) throw new Error('Gemini returned no image part');
      return { dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, model };
    }
    const res = await fetch(`${base}/models/${model}:predict?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ instances: [{ prompt: cfg.prompt }], parameters: { sampleCount: 1, aspectRatio: '1:1' } }),
    });
    if (!res.ok) throw new Error(`Imagen failed (${res.status}): ${(await res.text()).slice(0, 240)}`);
    const json = (await res.json()) as { predictions?: { bytesBase64Encoded: string; mimeType?: string }[] };
    const p = json.predictions?.[0];
    if (!p) throw new Error('Imagen returned no predictions');
    return { dataUrl: `data:${p.mimeType ?? 'image/png'};base64,${p.bytesBase64Encoded}`, model };
  }

  throw new Error(`Image generation is not available for ${cfg.provider}. Add an OpenAI or Google key, or use the procedural artwork tool.`);
}

// ── Speech synthesis ──────────────────────────────────────────────────────
export async function generateSpeechOpenAI(cfg: { apiKey: string; baseUrl?: string; text: string; voice?: string; model?: string }): Promise<string> {
  const base = cfg.baseUrl || 'https://api.openai.com/v1';
  const res = await fetch(`${base}/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: cfg.model || 'tts-1', voice: cfg.voice || 'alloy', input: cfg.text.slice(0, 4000), response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error(`Speech generation failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:audio/mpeg;base64,${buf.toString('base64')}`;
}
