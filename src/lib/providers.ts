import type { ModelInfo, ProviderId } from "./types";

/** Client-safe provider metadata + curated model catalog (fallbacks when a live list can't be fetched). */

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  tagline: string;
  /** env var checked as a fallback key source (server only uses this name) */
  envVar: string;
  keyPlaceholder: string;
  docsUrl: string;
  defaultBaseURL: string | null;
  baseURLLabel: string;
  needsKey: boolean;
  gradient: string;
  curatedModels: Omit<ModelInfo, "source">[];
}

const T = ["tools"] as const;

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "openai",
    label: "OpenAI",
    tagline: "GPT-4o, GPT-4.1, o-series reasoning",
    envVar: "OPENAI_API_KEY",
    keyPlaceholder: "sk-…",
    docsUrl: "https://platform.openai.com/api-keys",
    defaultBaseURL: "https://api.openai.com/v1",
    baseURLLabel: "Base URL (optional)",
    needsKey: true,
    gradient: "from-emerald-400 to-teal-600",
    curatedModels: [
      { id: "gpt-4o", label: "GPT-4o", capabilities: ["tools", "vision"], contextWindow: "128K", costHint: "$$" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini", capabilities: ["tools", "vision"], contextWindow: "128K", costHint: "$" },
      { id: "gpt-4.1", label: "GPT-4.1", capabilities: ["tools", "vision"], contextWindow: "1M", costHint: "$$" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", capabilities: ["tools", "vision"], contextWindow: "1M", costHint: "$" },
      { id: "o4-mini", label: "o4-mini (reasoning)", capabilities: ["tools", "vision", "reasoning"], contextWindow: "200K", costHint: "$$" },
      { id: "o3", label: "o3 (reasoning)", capabilities: ["tools", "vision", "reasoning"], contextWindow: "200K", costHint: "$$$" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    tagline: "Claude Opus / Sonnet / Haiku",
    envVar: "ANTHROPIC_API_KEY",
    keyPlaceholder: "sk-ant-…",
    docsUrl: "https://console.anthropic.com/settings/keys",
    defaultBaseURL: "https://api.anthropic.com",
    baseURLLabel: "Base URL (optional)",
    needsKey: true,
    gradient: "from-orange-400 to-amber-600",
    curatedModels: [
      { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", capabilities: ["tools", "vision", "reasoning"], contextWindow: "200K", costHint: "$$" },
      { id: "claude-opus-4-20250514", label: "Claude Opus 4", capabilities: ["tools", "vision", "reasoning"], contextWindow: "200K", costHint: "$$$" },
      { id: "claude-3-7-sonnet-20250219", label: "Claude 3.7 Sonnet", capabilities: ["tools", "vision", "reasoning"], contextWindow: "200K", costHint: "$$" },
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", capabilities: ["tools", "vision"], contextWindow: "200K", costHint: "$" },
    ],
  },
  {
    id: "google",
    label: "Google Gemini",
    tagline: "Gemini 2.5 Pro / Flash, huge context",
    envVar: "GOOGLE_GENERATIVE_AI_API_KEY",
    keyPlaceholder: "AIza…",
    docsUrl: "https://aistudio.google.com/apikey",
    defaultBaseURL: null,
    baseURLLabel: "Base URL (optional)",
    needsKey: true,
    gradient: "from-sky-400 to-blue-600",
    curatedModels: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", capabilities: ["tools", "vision", "reasoning"], contextWindow: "1M", costHint: "$$" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", capabilities: ["tools", "vision", "reasoning"], contextWindow: "1M", costHint: "$" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", capabilities: ["tools", "vision"], contextWindow: "1M", costHint: "$" },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    tagline: "One key, hundreds of routed models",
    envVar: "OPENROUTER_API_KEY",
    keyPlaceholder: "sk-or-…",
    docsUrl: "https://openrouter.ai/keys",
    defaultBaseURL: "https://openrouter.ai/api/v1",
    baseURLLabel: "Base URL (optional)",
    needsKey: true,
    gradient: "from-violet-400 to-fuchsia-600",
    curatedModels: [
      { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (OR)", capabilities: ["tools", "vision"], contextWindow: "200K", costHint: "$$" },
      { id: "openai/gpt-4o", label: "GPT-4o (OR)", capabilities: ["tools", "vision"], contextWindow: "128K", costHint: "$$" },
      { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (OR)", capabilities: ["tools", "vision"], contextWindow: "1M", costHint: "$$" },
      { id: "deepseek/deepseek-r1", label: "DeepSeek R1 (OR)", capabilities: ["tools", "reasoning"], contextWindow: "128K", costHint: "$" },
      { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick (OR)", capabilities: ["tools", "vision"], contextWindow: "128K", costHint: "$" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    tagline: "deepseek-chat & deepseek-reasoner (R1)",
    envVar: "DEEPSEEK_API_KEY",
    keyPlaceholder: "sk-…",
    docsUrl: "https://platform.deepseek.com/api_keys",
    defaultBaseURL: "https://api.deepseek.com/v1",
    baseURLLabel: "Base URL (optional)",
    needsKey: true,
    gradient: "from-cyan-400 to-indigo-600",
    curatedModels: [
      { id: "deepseek-chat", label: "DeepSeek Chat (V3)", capabilities: [...T], contextWindow: "64K", costHint: "$" },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner (R1)", capabilities: ["reasoning"], contextWindow: "64K", costHint: "$" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    tagline: "Ultra-fast Llama / Qwen inference",
    envVar: "GROQ_API_KEY",
    keyPlaceholder: "gsk_…",
    docsUrl: "https://console.groq.com/keys",
    defaultBaseURL: "https://api.groq.com/openai/v1",
    baseURLLabel: "Base URL",
    needsKey: true,
    gradient: "from-rose-400 to-red-600",
    curatedModels: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", capabilities: [...T], contextWindow: "128K", costHint: "$" },
      { id: "llama-4-maverick-17b-128e-instruct", label: "Llama 4 Maverick", capabilities: ["tools", "vision"], contextWindow: "128K", costHint: "$" },
      { id: "qwen-qwq-32b", label: "Qwen QwQ 32B", capabilities: ["tools", "reasoning"], contextWindow: "128K", costHint: "$" },
    ],
  },
  {
    id: "together",
    label: "Together AI",
    tagline: "Open models, serverless endpoints",
    envVar: "TOGETHER_API_KEY",
    keyPlaceholder: "…",
    docsUrl: "https://api.together.xyz/settings/api-keys",
    defaultBaseURL: "https://api.together.xyz/v1",
    baseURLLabel: "Base URL",
    needsKey: true,
    gradient: "from-indigo-400 to-violet-600",
    curatedModels: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo", capabilities: [...T], contextWindow: "128K", costHint: "$" },
      { id: "Qwen/Qwen2.5-Coder-32B-Instruct", label: "Qwen 2.5 Coder 32B", capabilities: [...T], contextWindow: "32K", costHint: "$" },
      { id: "deepseek-ai/DeepSeek-R1", label: "DeepSeek R1", capabilities: ["reasoning"], contextWindow: "128K", costHint: "$" },
    ],
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    tagline: "Fast open-model serving",
    envVar: "FIREWORKS_API_KEY",
    keyPlaceholder: "fw_…",
    docsUrl: "https://fireworks.ai/account/api-keys",
    defaultBaseURL: "https://api.fireworks.ai/inference/v1",
    baseURLLabel: "Base URL",
    needsKey: true,
    gradient: "from-amber-400 to-orange-600",
    curatedModels: [
      { id: "accounts/fireworks/models/llama4-maverick-instruct-basic", label: "Llama 4 Maverick", capabilities: [...T], contextWindow: "128K", costHint: "$" },
      { id: "accounts/fireworks/models/deepseek-r1", label: "DeepSeek R1", capabilities: ["reasoning"], contextWindow: "128K", costHint: "$" },
    ],
  },
  {
    id: "ollama",
    label: "Ollama (Local)",
    tagline: "Run models on your own machine",
    envVar: "OLLAMA_BASE_URL",
    keyPlaceholder: "no key needed",
    docsUrl: "https://ollama.com",
    defaultBaseURL: "http://localhost:11434/v1",
    baseURLLabel: "Ollama base URL",
    needsKey: false,
    gradient: "from-zinc-400 to-zinc-600",
    curatedModels: [
      { id: "llama3.1:8b", label: "Llama 3.1 8B (local)", capabilities: [...T], contextWindow: "128K", costHint: "free" },
      { id: "qwen2.5:14b", label: "Qwen 2.5 14B (local)", capabilities: [...T], contextWindow: "128K", costHint: "free" },
      { id: "llava:13b", label: "LLaVA 13B (local vision)", capabilities: ["vision"], contextWindow: "32K", costHint: "free" },
    ],
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    tagline: "Any /v1 endpoint — LM Studio, vLLM, proxies",
    envVar: "CUSTOM_AI_API_KEY",
    keyPlaceholder: "sk-…",
    docsUrl: "",
    defaultBaseURL: "http://localhost:1234/v1",
    baseURLLabel: "Base URL (required)",
    needsKey: false,
    gradient: "from-slate-400 to-slate-600",
    curatedModels: [
      { id: "local-model", label: "local-model", capabilities: [...T], contextWindow: "—", costHint: "free" },
    ],
  },
];

export function getProviderMeta(id: ProviderId): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export function curatedModels(id: ProviderId): ModelInfo[] {
  return getProviderMeta(id).curatedModels.map((m) => ({ ...m, source: "curated" as const }));
}

/** Heuristic capability inference for live-listed models we don't curate. */
export function inferCapabilities(modelId: string): ModelInfo["capabilities"] {
  const id = modelId.toLowerCase();
  const caps = new Set<ModelInfo["capabilities"][number]>();
  if (/(gpt-4|gpt-5|claude|gemini|llama-3|llama-4|qwen|mistral|command|sonnet|opus|haiku)/.test(id)) caps.add("tools");
  if (/(gpt-4o|gpt-4\.1|claude|gemini|vision|llava|maverick|scout|pixtral|o4|o3)/.test(id)) caps.add("vision");
  if (/(^o1|^o3|^o4|reasoner|r1|qwq|thinking|deepseek-r)/.test(id)) caps.add("reasoning");
  if (/(dall-e|imagen|flux|sdxl|image)/.test(id)) caps.add("image-gen");
  return [...caps];
}
