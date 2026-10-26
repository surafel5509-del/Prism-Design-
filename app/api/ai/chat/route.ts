import { z } from 'zod';
import { streamText, generateText, type CoreMessage } from 'ai';
import type { Layer, Project } from '@/lib/engine/types';
import { createProject } from '@/lib/engine/factory';
import { normalizeLayer } from '@/lib/engine/ops';
import { createToolbelt } from '@/lib/ai/tools';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import { languageModel, fetchModels, generateImage, generateSpeechOpenAI } from '@/lib/ai/runtime';
import { getProvider, findModel, estimateCost, supportsTools as providerSupportsTools } from '@/lib/ai/providers';
import { ensureUserId, jsonError } from '@/lib/server/session';
import { getUser, audit } from '@/lib/server/store';
import { resolveTarget, capabilities, settingsOf, isConnected, recordUsage, recordRun, providerErrorMessage, type Target } from '@/lib/server/ai-config';
import { rateLimit } from '@/lib/server/ratelimit';
import { uid } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(80_000),
    images: z.array(z.string()).max(10).optional(),
    model: z.string().optional(),
    provider: z.string().optional(),
  })).min(1).max(40),
  provider: z.string().max(40).optional(),
  model: z.string().max(200).optional(),
  mode: z.enum(['agent', 'thinking', 'fast']).optional(),
  outputKind: z.enum(['design', 'motion', 'image', 'edit']).optional(),
  project: z.unknown().optional(),
  runId: z.string().max(80).optional(),
});

function asProject(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Project>;
  if (!Array.isArray(p.layers)) return null;
  const base = createProject({ id: typeof p.id === 'string' ? p.id : undefined, name: p.name });
  const layers = (p.layers as Partial<Layer>[])
    .filter((l) => l && typeof l === 'object' && typeof l.type === 'string')
    .map((l) => normalizeLayer(l));
  return {
    ...base,
    ...p,
    width: Math.max(64, Math.min(7680, Number(p.width) || base.width)),
    height: Math.max(64, Math.min(7680, Number(p.height) || base.height)),
    duration: Math.max(0.5, Math.min(600, Number(p.duration) || base.duration)),
    fps: Math.max(6, Math.min(60, Number(p.fps) || base.fps)),
    background: typeof p.background === 'string' ? p.background : base.background,
    backgroundGradient: p.backgroundGradient ?? null,
    layers,
    tags: Array.isArray(p.tags) ? p.tags.slice(0, 12) : [],
    createdAt: Number(p.createdAt) || Date.now(),
    updatedAt: Date.now(),
  };
}

function toCoreMessages(messages: z.infer<typeof BodySchema>['messages']): CoreMessage[] {
  return messages.slice(-14).map<CoreMessage>((m) => {
    if (m.role === 'assistant') return { role: 'assistant', content: m.content || '…' };
    if (m.images?.length) {
      return {
        role: 'user',
        content: [
          { type: 'text', text: m.content || 'Reference images attached.' },
          ...m.images.map((image) => ({ type: 'image' as const, image })),
        ],
      };
    }
    return { role: 'user', content: m.content || '(empty)' };
  });
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const userId = ensureUserId();
  const limit = rateLimit(`chat:${userId}`, 30, 60_000);
  if (!limit.ok) return jsonError(`Slow down a moment — the agent allows 30 runs per minute. Retry in ${limit.retryAfter}s.`, 429, { code: 'rate_limited' });

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'Invalid request body', 400, { code: 'bad_request' });
  }

  const user = await getUser(userId);
  const settings = settingsOf(user);
  const runId = parsed.runId ?? uid('run');

  let target: Target | null = resolveTarget(user, 'chat', { provider: parsed.provider, model: parsed.model });
  if (!target) {
    return jsonError('No AI provider is connected yet. Open Settings → AI, paste an API key for OpenAI, Anthropic, Google or any OpenAI-compatible endpoint, then run Test Connection.', 400, { code: 'provider_missing' });
  }

  // Real preflight (no token spend) so an expired key falls back cleanly when the user opted in.
  let usedFallback = false;
  if (settings.fallbackEnabled && settings.fallbackProvider && settings.fallbackProvider !== target.provider && isConnected(user, settings.fallbackProvider)) {
    try {
      await fetchModels(target.provider, target.apiKey, target.baseUrl);
    } catch {
      const fb = resolveTarget(user, 'chat', { provider: settings.fallbackProvider, model: settings.fallbackModel });
      if (fb) { target = fb; usedFallback = true; }
    }
  }

  const knownModel = findModel(target.provider, target.model);
  const modelSupportsTools = knownModel ? knownModel.capabilities.includes('tools') : providerSupportsTools(target.provider, target.model);
  // Tool calling is how the agent edits the document. If the model can't do it we
  // still run, but as a plain streaming chat with an explicit note (never silently fake).
  const useTools = settings.toolCalling && modelSupportsTools;

  const project = asProject(parsed.project);
  const caps = capabilities(user);
  const mode = parsed.mode ?? settings.defaultMode;
  const outputKind = parsed.outputKind ?? 'motion';

  const toolbelt = createToolbelt({
    project: project ?? createProject({ name: 'Untitled' }),
    userId,
    generateImage: caps.imageTarget ? async (args) => {
      const img = await generateImage({
        provider: caps.imageTarget!.provider, apiKey: caps.imageTarget!.apiKey, baseUrl: caps.imageTarget!.baseUrl,
        model: caps.imageTarget!.model, prompt: args.prompt, size: args.size as '1024x1024' | '1536x1024' | '1024x1536', quality: args.quality as 'low' | 'medium' | 'high' | undefined,
      });
      void recordUsage(userId, { provider: caps.imageTarget!.provider, model: img.model, tokensIn: 0, tokensOut: 0, cost: 0.04, kind: 'image', runId });
      return { dataUrl: img.dataUrl, model: img.model, revisedPrompt: img.revisedPrompt };
    } : undefined,
    generateSpeech: caps.speechTarget ? async (args) => {
      const dataUrl = await generateSpeechOpenAI({ apiKey: caps.speechTarget!.apiKey, baseUrl: caps.speechTarget!.baseUrl, text: args.text, voice: args.voice });
      void recordUsage(userId, { provider: caps.speechTarget!.provider, model: 'tts-1', tokensIn: 0, tokensOut: 0, cost: 0.015, kind: 'speech', runId });
      return { dataUrl, model: 'tts-1' };
    } : undefined,
    vision: caps.visionTarget ? async (args) => {
      const { text } = await generateText({
        model: languageModel({ provider: caps.visionTarget!.provider, model: caps.visionTarget!.model, apiKey: caps.visionTarget!.apiKey, baseUrl: caps.visionTarget!.baseUrl }),
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: args.prompt },
            { type: 'image', image: args.image },
          ],
        }],
        maxTokens: 900,
        temperature: 0.2,
      });
      return text;
    } : undefined,
  });

  const systemBase = buildSystemPrompt({
    project, mode, outputKind, settings,
    hasVision: caps.vision, hasImageGen: caps.imageGen, hasSpeech: caps.speech,
    provider: getProvider(target.provider)?.name ?? target.provider,
    model: target.model,
  });
  const system = useTools
    ? systemBase
    : `${systemBase}

## Important: this model cannot call tools
The selected model (${target.model}) does not support tool calling, so you cannot mutate the document on this run. Reply as a senior art director would in chat: give a precise, buildable design/motion spec (layout, palette, type, timing), and tell the user to switch to a tool-capable model (e.g. Kimi K2.6, Claude Sonnet, GPT-4.1) in the model picker to have Prism build it. Never claim you edited anything.`;

  const maxSteps = useTools ? (mode === 'thinking' ? 32 : mode === 'fast' ? 10 : 24) : 1;
  const messages = toCoreMessages(parsed.messages);

  let tokensIn = 0;
  let tokensOut = 0;
  let steps = 0;
  let toolCalls = 0;

  try {
    const result = streamText({
      model: languageModel({ provider: target.provider, model: target.model, apiKey: target.apiKey, baseUrl: target.baseUrl }),
      system,
      messages,
      ...(useTools ? { tools: toolbelt.tools } : {}),
      maxSteps,
      temperature: Math.max(0, Math.min(2, settings.temperature)),
      topP: Math.max(0.05, Math.min(1, settings.topP)),
      maxTokens: Math.max(512, Math.min(settings.maxTokens, 16_384)),
      abortSignal: req.signal,
      onStepFinish: (step) => {
        steps += 1;
        toolCalls += step.toolCalls?.length ?? 0;
        tokensIn += step.usage?.promptTokens ?? 0;
        tokensOut += step.usage?.completionTokens ?? 0;
      },
      onFinish: async ({ finishReason }) => {
        const cost = estimateCost(findModel(target!.provider, target!.model), tokensIn, tokensOut);
        try {
          await recordUsage(userId, { provider: target!.provider, model: target!.model, tokensIn, tokensOut, cost, kind: 'chat', runId });
          await recordRun(userId, {
            id: runId, at: startedAt, prompt: parsed.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content.slice(0, 400) ?? '',
            provider: target!.provider, model: target!.model, status: finishReason === 'error' ? 'error' : 'done',
            toolCalls, steps, tokensIn, tokensOut, cost, durationMs: Date.now() - startedAt,
            ops: toolbelt.getOps(),
          });
          await audit(userId, 'ai.run', `${target!.provider}/${target!.model} · ${toolCalls} tools · ${finishReason}`);
        } catch (e) {
          console.warn('[prism] failed to persist run', e);
        }
      },
    });

    return result.toDataStreamResponse({
      sendReasoning: true,
      sendUsage: true,
      headers: {
        'x-prism-run': runId,
        'x-prism-provider': target.provider,
        'x-prism-model': target.model,
        'x-prism-fallback': usedFallback ? '1' : '0',
        'x-prism-tools': String(useTools ? toolbelt.toolNames.length : 0),
        'cache-control': 'no-store',
      },
      getErrorMessage: (error) => providerErrorMessage(error, target!.provider),
    });
  } catch (error) {
    return jsonError(providerErrorMessage(error, target.provider), 502, { code: 'provider_error', provider: target.provider });
  }
}
