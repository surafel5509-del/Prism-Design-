import { z } from 'zod';
import { ensureUserId, jsonError } from '@/lib/server/session';
import { getUser } from '@/lib/server/store';
import { decryptSecret } from '@/lib/server/crypto';
import { getProvider, toModelInfo } from '@/lib/ai/providers';
import { fetchModels } from '@/lib/ai/runtime';
import { rateLimit } from '@/lib/server/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Schema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().max(400).optional(),
  baseUrl: z.string().max(400).optional(),
});

export async function POST(req: Request) {
  const userId = ensureUserId();
  if (!rateLimit(`test:${userId}`, 24, 60_000).ok) return jsonError('Too many connection tests. Wait a minute.', 429, { code: 'rate_limited' });

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError('provider is required', 400, { code: 'bad_request' });
  const def = getProvider(parsed.data.provider);
  if (!def) return jsonError('Unknown provider', 400, { code: 'unknown_provider' });

  const user = await getUser(userId);
  const stored = user.providers?.[def.id];
  const key = parsed.data.apiKey?.trim() || (stored?.key ? decryptSecret(stored.key) ?? '' : '');
  if (def.requiresKey !== false && !key) return jsonError(`This provider needs an API key.`, 400, { code: 'key_required' });

  const started = Date.now();
  const baseUrl = parsed.data.baseUrl || stored?.baseUrl || def.baseUrl;
  try {
    const raw = await fetchModels(def.id, key, baseUrl);
    const models = raw.map((m) => toModelInfo(def.id, m.id));
    return Response.json({
      ok: true, provider: def.id, latencyMs: Date.now() - started, modelCount: models.length,
      models: models.slice(0, 200).map((m) => ({ id: m.id, name: m.name, contextWindow: m.contextWindow, capabilities: m.capabilities })),
      message: `Connected to ${def.name} · ${models.length} models available`,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : 'Connection failed';
    const local = /^(ollama|lmstudio|custom)$/.test(def.id) || /localhost|127\.0\.0\.1/.test(baseUrl ?? '');
    const message = /fetch failed|ECONNREFUSED|ENOTFOUND|timeout|aborted/i.test(raw)
      ? local
        ? `Could not reach ${baseUrl ?? def.baseUrl ?? 'the endpoint'}. Is the local server running and reachable from this machine?`
        : `Could not reach ${def.name}'s API. Check the base URL, your network, and that the key is valid. (${raw})`
      : raw;
    return Response.json({ ok: false, provider: def.id, latencyMs: Date.now() - started, message, error: message }, { status: 200 });
  }
}
