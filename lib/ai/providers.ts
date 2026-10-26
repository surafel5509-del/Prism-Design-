import type { ModelInfo } from '@/lib/engine/types';

export interface ProviderDef {
  id: string;
  name: string;
  blurb: string;
  docs: string;
  keyPrefix?: string;
  baseUrl?: string;
  modelsEndpoint?: string;
  defaultModel: string;
  curated: ModelInfo[];
  customBaseUrl?: boolean;
  accent: string;
  requiresKey?: boolean;
  /** Servers may supply a shared key from env, so the provider works out of the box. */
  managed?: boolean;
  managedEnv?: string[];
}

const caps = (...c: ModelInfo['capabilities']) => c;

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai', name: 'OpenAI', blurb: 'GPT-4.1, GPT-4o, o3 & o4-mini', docs: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-', baseUrl: 'https://api.openai.com/v1', modelsEndpoint: 'https://api.openai.com/v1/models', defaultModel: 'gpt-4.1', accent: '#10a37f',
    curated: [
      { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', contextWindow: 1047576, capabilities: caps('tools', 'vision'), inputCost: 2, outputCost: 8, curated: true },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini', provider: 'openai', contextWindow: 1047576, capabilities: caps('tools', 'vision'), inputCost: 0.4, outputCost: 1.6, curated: true },
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, capabilities: caps('tools', 'vision'), inputCost: 2.5, outputCost: 10, curated: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai', contextWindow: 128000, capabilities: caps('tools', 'vision'), inputCost: 0.15, outputCost: 0.6, curated: true },
      { id: 'o3', name: 'o3 (reasoning)', provider: 'openai', contextWindow: 200000, capabilities: caps('tools', 'vision', 'reasoning'), inputCost: 2, outputCost: 8, curated: true },
      { id: 'o4-mini', name: 'o4-mini (reasoning)', provider: 'openai', contextWindow: 200000, capabilities: caps('tools', 'vision', 'reasoning'), inputCost: 1.1, outputCost: 4.4, curated: true },
      { id: 'o1', name: 'o1 (reasoning)', provider: 'openai', contextWindow: 200000, capabilities: caps('reasoning', 'vision'), inputCost: 15, outputCost: 60, curated: true },
      { id: 'gpt-image-1', name: 'GPT Image 1', provider: 'openai', contextWindow: 0, capabilities: caps('image'), inputCost: 0, outputCost: 0, curated: true },
      { id: 'tts-1', name: 'TTS-1 (speech)', provider: 'openai', contextWindow: 0, capabilities: caps('audio'), inputCost: 0, outputCost: 0, curated: true },
    ],
  },
  {
    id: 'opencode', name: 'Prism AI Cloud', blurb: 'Hosted gateway — Kimi K2.6, Claude, GPT & Gemini', docs: 'https://opencode.ai', 
    keyPrefix: 'oc_sk_', baseUrl: 'https://opencode.ai/inference/openai/v1', modelsEndpoint: 'https://opencode.ai/inference/openai/v1/models',
    defaultModel: 'kimi-k2.6', accent: '#7c5cff', managed: true, managedEnv: ['PRISM_AI_API_KEY', 'OPENCODE_API_KEY'], customBaseUrl: true,
    curated: [
      { id: 'kimi-k2.6', name: 'Kimi K2.6 (agentic)', provider: 'opencode', contextWindow: 262144, capabilities: caps('tools', 'vision'), inputCost: 0.6, outputCost: 2.5, curated: true },
      { id: 'kimi-k2', name: 'Kimi K2', provider: 'opencode', contextWindow: 131072, capabilities: caps('tools'), inputCost: 0.6, outputCost: 2.5, curated: true },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5 (routed)', provider: 'opencode', contextWindow: 200000, capabilities: caps('tools', 'vision', 'reasoning'), inputCost: 3, outputCost: 15, curated: true },
      { id: 'gpt-5', name: 'GPT-5 (routed)', provider: 'opencode', contextWindow: 400000, capabilities: caps('tools', 'vision', 'reasoning'), inputCost: 1.25, outputCost: 10, curated: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (routed)', provider: 'opencode', contextWindow: 1048576, capabilities: caps('tools', 'vision', 'reasoning'), inputCost: 1.25, outputCost: 10, curated: true },
      { id: 'deepseek-v3.2', name: 'DeepSeek V3.2 (routed)', provider: 'opencode', contextWindow: 163840, capabilities: caps('tools', 'reasoning'), inputCost: 0.28, outputCost: 0.42, curated: true },
    ],
  },
  {
    id: 'anthropic', name: 'Anthropic', blurb: 'Claude Opus 4, Sonnet 4 & Haiku', docs: 'https://console.anthropic.com/settings/keys',
    keyPrefix: 'sk-ant-', baseUrl: 'https://api.anthropic.com/v1', modelsEndpoint: 'https://api.anthropic.com/v1/models', defaultModel: 'claude-sonnet-4-20250514', accent: '#d97757',
    curated: [
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', contextWindow: 200000, capabilities: caps('tools', 'vision', 'reasoning'), inputCost: 15, outputCost: 75, curated: true },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', contextWindow: 200000, capabilities: caps('tools', 'vision', 'reasoning'), inputCost: 3, outputCost: 15, curated: true },
      { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet', provider: 'anthropic', contextWindow: 200000, capabilities: caps('tools', 'vision', 'reasoning'), inputCost: 3, outputCost: 15, curated: true },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextWindow: 200000, capabilities: caps('tools', 'vision'), inputCost: 0.8, outputCost: 4, curated: true },
    ],
  },
  {
    id: 'google', name: 'Google Gemini', blurb: 'Gemini 2.5 Pro & Flash, Imagen', docs: 'https://aistudio.google.com/app/apikey',
    keyPrefix: 'AIza', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models', defaultModel: 'gemini-2.5-pro', accent: '#4285f4',
    curated: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', contextWindow: 1048576, capabilities: caps('tools', 'vision', 'reasoning'), inputCost: 1.25, outputCost: 10, curated: true },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', contextWindow: 1048576, capabilities: caps('tools', 'vision', 'reasoning'), inputCost: 0.3, outputCost: 2.5, curated: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', contextWindow: 1048576, capabilities: caps('tools', 'vision'), inputCost: 0.1, outputCost: 0.4, curated: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', contextWindow: 2097152, capabilities: caps('tools', 'vision'), inputCost: 1.25, outputCost: 5, curated: true },
      { id: 'gemini-2.5-flash-image-preview', name: 'Gemini 2.5 Flash Image', provider: 'google', contextWindow: 0, capabilities: caps('image', 'vision'), inputCost: 0, outputCost: 0, curated: true },
    ],
  },
  {
    id: 'openrouter', name: 'OpenRouter', blurb: 'One key, 300+ routed models', docs: 'https://openrouter.ai/keys',
    keyPrefix: 'sk-or-', baseUrl: 'https://openrouter.ai/api/v1', modelsEndpoint: 'https://openrouter.ai/api/v1/models', defaultModel: 'anthropic/claude-sonnet-4', accent: '#8b5cf6',
    managed: true, managedEnv: ['OPENROUTER_API_KEY'], customBaseUrl: true,
    curated: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (routed)', provider: 'openrouter', contextWindow: 200000, capabilities: caps('tools', 'vision'), inputCost: 3, outputCost: 15, curated: true },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1 (routed)', provider: 'openrouter', contextWindow: 1047576, capabilities: caps('tools', 'vision'), inputCost: 2, outputCost: 8, curated: true },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro (routed)', provider: 'openrouter', contextWindow: 1048576, capabilities: caps('tools', 'vision'), inputCost: 1.25, outputCost: 10, curated: true },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (routed)', provider: 'openrouter', contextWindow: 163840, capabilities: caps('tools', 'reasoning'), inputCost: 0.55, outputCost: 2.19, curated: true },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'openrouter', contextWindow: 131072, capabilities: caps('tools'), inputCost: 0.12, outputCost: 0.3, curated: true },
      { id: 'qwen/qwen-2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'openrouter', contextWindow: 32768, capabilities: caps('tools'), inputCost: 0.07, outputCost: 0.16, curated: true },
    ],
  },
  {
    id: 'deepseek', name: 'DeepSeek', blurb: 'deepseek-chat & deepseek-reasoner', docs: 'https://platform.deepseek.com/api_keys',
    keyPrefix: 'sk-', baseUrl: 'https://api.deepseek.com/v1', modelsEndpoint: 'https://api.deepseek.com/models', defaultModel: 'deepseek-chat', accent: '#4d6bfe',
    curated: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat V3', provider: 'deepseek', contextWindow: 65536, capabilities: caps('tools'), inputCost: 0.27, outputCost: 1.1, curated: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', provider: 'deepseek', contextWindow: 65536, capabilities: caps('reasoning'), inputCost: 0.55, outputCost: 2.19, curated: true },
    ],
  },
  {
    id: 'groq', name: 'Groq', blurb: 'Ultra-fast LPU inference', docs: 'https://console.groq.com/keys',
    baseUrl: 'https://api.groq.com/openai/v1', modelsEndpoint: 'https://api.groq.com/openai/v1/models', defaultModel: 'llama-3.3-70b-versatile', accent: '#f55036', customBaseUrl: true,
    curated: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', contextWindow: 131072, capabilities: caps('tools'), inputCost: 0.59, outputCost: 0.79, curated: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', contextWindow: 131072, capabilities: caps('tools'), inputCost: 0.05, outputCost: 0.08, curated: true },
      { id: 'qwen-2.5-32b', name: 'Qwen 2.5 32B', provider: 'groq', contextWindow: 131072, capabilities: caps('tools'), inputCost: 0.29, outputCost: 0.39, curated: true },
    ],
  },
  {
    id: 'together', name: 'Together AI', blurb: 'Open-weight model hosting', docs: 'https://api.together.xyz/settings/api-keys',
    baseUrl: 'https://api.together.xyz/v1', modelsEndpoint: 'https://api.together.xyz/v1/models', defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', accent: '#0f6fff', customBaseUrl: true,
    curated: [
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo', provider: 'together', contextWindow: 131072, capabilities: caps('tools'), inputCost: 0.88, outputCost: 0.88, curated: true },
      { id: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B', provider: 'together', contextWindow: 32768, capabilities: caps('tools'), inputCost: 1.2, outputCost: 1.2, curated: true },
    ],
  },
  {
    id: 'fireworks', name: 'Fireworks', blurb: 'Serverless open models', docs: 'https://fireworks.ai/account/api-keys',
    baseUrl: 'https://api.fireworks.ai/inference/v1', modelsEndpoint: 'https://api.fireworks.ai/inference/v1/models', defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct', accent: '#ff5c00', customBaseUrl: true,
    curated: [
      { id: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B', provider: 'fireworks', contextWindow: 131072, capabilities: caps('tools'), inputCost: 0.9, outputCost: 0.9, curated: true },
    ],
  },
  {
    id: 'ollama', name: 'Ollama', blurb: 'Local models on your machine', docs: 'https://ollama.com/download',
    baseUrl: 'http://127.0.0.1:11434/v1', modelsEndpoint: 'http://127.0.0.1:11434/v1/models', defaultModel: 'llama3.2', accent: '#ffffff', customBaseUrl: true, requiresKey: false,
    curated: [
      { id: 'llama3.2', name: 'Llama 3.2 (local)', provider: 'ollama', contextWindow: 128000, capabilities: caps('tools'), inputCost: 0, outputCost: 0, curated: true },
      { id: 'qwen2.5:14b', name: 'Qwen 2.5 14B (local)', provider: 'ollama', contextWindow: 32768, capabilities: caps('tools'), inputCost: 0, outputCost: 0, curated: true },
    ],
  },
  {
    id: 'lmstudio', name: 'LM Studio', blurb: 'Local OpenAI-compatible server', docs: 'https://lmstudio.ai',
    baseUrl: 'http://127.0.0.1:1234/v1', modelsEndpoint: 'http://127.0.0.1:1234/v1/models', defaultModel: 'local-model', accent: '#60a5fa', customBaseUrl: true, requiresKey: false,
    curated: [
      { id: 'local-model', name: 'Local model', provider: 'lmstudio', contextWindow: 32768, capabilities: caps('tools'), inputCost: 0, outputCost: 0, curated: true },
    ],
  },
  {
    id: 'custom', name: 'Custom', blurb: 'Any OpenAI-compatible endpoint', docs: '#',
    baseUrl: '', modelsEndpoint: '', defaultModel: 'gpt-4o-mini', accent: '#a1a1aa', customBaseUrl: true,
    curated: [
      { id: 'gpt-4o-mini', name: 'Custom model', provider: 'custom', contextWindow: 128000, capabilities: caps('tools'), inputCost: 0, outputCost: 0, curated: true },
    ],
  },
];

export function getProvider(id: string): ProviderDef | undefined { return PROVIDERS.find((p) => p.id === id); }

export const MODEL_FALLBACKS: ModelInfo[] = PROVIDERS.flatMap((p) => p.curated);

export function findModel(provider: string, modelId: string): ModelInfo | undefined {
  const p = getProvider(provider);
  return p?.curated.find((m) => m.id === modelId);
}

export function supportsTools(provider: string, modelId: string): boolean {
  const m = findModel(provider, modelId);
  if (m) return m.capabilities.includes('tools');
  // Unknown (live-fetched) models: assume tool support for major providers.
  return ['openai', 'anthropic', 'google', 'openrouter', 'opencode', 'deepseek', 'groq', 'together', 'fireworks', 'ollama', 'lmstudio', 'custom'].includes(provider);
}

export function supportsVision(provider: string, modelId: string): boolean {
  const m = findModel(provider, modelId);
  if (m) return m.capabilities.includes('vision');
  return /gpt-4|claude|gemini|vision|llama-3\.2|qwen2?\.?5?-?vl/i.test(modelId);
}

export function estimateCost(model: ModelInfo | undefined, tokensIn: number, tokensOut: number): number {
  if (!model) return 0;
  return (tokensIn / 1_000_000) * model.inputCost + (tokensOut / 1_000_000) * model.outputCost;
}

export function toModelInfo(provider: string, id: string): ModelInfo {
  const curated = findModel(provider, id);
  if (curated) return curated;
  return {
    id, name: id, provider,
    contextWindow: /128k|gpt-4o/.test(id) ? 128000 : /200k|claude/.test(id) ? 200000 : 128000,
    capabilities: supportsTools(provider, id) ? ['tools', ...(supportsVision(provider, id) ? ['vision' as const] : [])] : [],
    inputCost: 0, outputCost: 0, curated: false,
  };
}
