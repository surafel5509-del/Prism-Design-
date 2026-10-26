import { z } from 'zod';
import { ensureUserId, jsonError } from '@/lib/server/session';
import { getUser, saveUser } from '@/lib/server/store';
import { isConnected, settingsOf } from '@/lib/server/ai-config';
import { PROVIDERS } from '@/lib/ai/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = ensureUserId();
  const user = await getUser(userId);
  return Response.json({
    settings: settingsOf(user),
    providers: Object.values(user.providers ?? {}).map((p) => ({
      provider: p.provider, connected: p.connected, status: p.status, defaultModel: p.defaultModel,
      message: p.message, lastChecked: p.lastChecked, baseUrl: p.baseUrl,
    })),
    catalog: PROVIDERS.map((p) => ({ id: p.id, name: p.name, accent: p.accent, requiresKey: p.requiresKey !== false, docs: p.docs })),
  });
}

const SettingsSchema = z.object({
  defaultProvider: z.string().max(40).optional(),
  defaultModel: z.string().max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0.01).max(1).optional(),
  maxTokens: z.number().int().min(128).max(32_768).optional(),
  reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
  defaultMode: z.enum(['agent', 'thinking', 'fast']).optional(),
  streaming: z.boolean().optional(),
  toolCalling: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  systemPromptExtra: z.string().max(4000).optional(),
  fallbackEnabled: z.boolean().optional(),
  fallbackProvider: z.string().max(40).optional(),
  fallbackModel: z.string().max(200).optional(),
  taskProviders: z.record(z.string(), z.object({ provider: z.string().max(40), model: z.string().max(200) })).optional(),
  clearUsage: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const userId = ensureUserId();
  const user = await getUser(userId);
  const parsed = SettingsSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? 'Invalid settings', 400, { code: 'bad_request' });
  const { clearUsage, ...patch } = parsed.data;

  const next = settingsOf(user);
  if (patch.defaultProvider) {
    if (!isConnected(user, patch.defaultProvider)) return jsonError('That provider is not connected yet.', 400, { code: 'not_connected' });
  }
  Object.assign(next, patch);
  next.temperature = Math.max(0, Math.min(2, next.temperature));
  next.topP = Math.max(0.05, Math.min(1, next.topP));
  next.maxTokens = Math.max(256, Math.min(16_384, next.maxTokens));
  user.settings = next;
  if (clearUsage) user.usage = [];
  await saveUser(user);
  return Response.json({ settings: next, usageCleared: Boolean(clearUsage) });
}
