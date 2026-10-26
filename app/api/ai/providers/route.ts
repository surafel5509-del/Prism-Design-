import { z } from 'zod';
import { ensureUserId, jsonError } from '@/lib/server/session';
import { getUser, saveUser, audit, DEFAULT_SETTINGS, type StoredProvider } from '@/lib/server/store';
import { encryptSecret, maskKey, fingerprint } from '@/lib/server/crypto';
import { getProvider, PROVIDERS, toModelInfo } from '@/lib/ai/providers';
import type { ModelInfo } from '@/lib/engine/types';
import { fetchModels, invalidateModelCache } from '@/lib/ai/runtime';
import { resolveTarget, settingsOf } from '@/lib/server/ai-config';
import { rateLimit } from '@/lib/server/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ConnectSchema = z.object({
  provider: z.string().min(1).max(40),
  apiKey: z.string().max(400).optional(),
  baseUrl: z.string().max(400).optional(),
  model: z.string().max(200).optional(),
  setDefault: z.boolean().optional(),
  skipValidation: z.boolean().optional(),
});

function publicProvider(p: StoredProvider) {
  const def = getProvider(p.provider);
  return {
    provider: p.provider,
    name: def?.name ?? p.provider,
    accent: def?.accent,
    connected: p.connected,
    status: p.status,
    message: p.message,
    masked: p.key ? `••••••••••••${fingerprint(JSON.stringify(p.key)).slice(-4)}` : def?.requiresKey === false ? 'No key required' : '',
    keyPreview: p.key ? `••••••••••••${fingerprint(JSON.stringify(p.key)).slice(-4)}` : '',
    baseUrl: p.baseUrl ?? def?.baseUrl ?? '',
    defaultModel: p.defaultModel ?? def?.defaultModel,
    lastChecked: p.lastChecked,
    models: (p.models ?? []).map((m) => m.id),
    requiresKey: def?.requiresKey !== false,
  };
}

export async function GET() {
  const userId = ensureUserId();
  const user = await getUser(userId);
  const settings = settingsOf(user);
  const connected = Object.entries(user.providers ?? {}).filter(([, p]) => p.connected);
  return Response.json({
    providers: Object.values(user.providers ?? {}).map((p) => publicProvider(p)),
    catalog: PROVIDERS.map((p) => ({
      id: p.id, name: p.name, blurb: p.blurb, docs: p.docs, baseUrl: p.baseUrl,
      accent: p.accent, requiresKey: p.requiresKey !== false, defaultModel: p.defaultModel,
      keyPrefix: p.keyPrefix, customBaseUrl: p.customBaseUrl, curated: p.curated,
    })),
    settings,
    connectedCount: connected.length,
    active: resolveTarget(user) ? { provider: resolveTarget(user)!.provider, model: resolveTarget(user)!.model } : null,
    usage: {
      requests: (user.usage ?? []).length,
      tokensIn: (user.usage ?? []).reduce((a, u) => a + (u.tokensIn ?? 0), 0),
      tokensOut: (user.usage ?? []).reduce((a, u) => a + (u.tokensOut ?? 0), 0),
      cost: (user.usage ?? []).reduce((a, u) => a + (u.cost ?? 0), 0),
    },
  });
}

export async function POST(req: Request) {
  const userId = ensureUserId();
  if (!rateLimit(`providers:${userId}`, 20, 60_000).ok) return jsonError('Too many provider changes. Try again in a minute.', 429, { code: 'rate_limited' });
  let body: z.infer<typeof ConnectSchema>;
  try { body = ConnectSchema.parse(await req.json()); }
  catch (e) { return jsonError(e instanceof Error ? e.message : 'Invalid body', 400, { code: 'bad_request' }); }

  const def = getProvider(body.provider);
  if (!def) return jsonError(`Unknown provider “${body.provider}”.`, 400, { code: 'unknown_provider' });

  const user = await getUser(userId);
  const existing = user.providers?.[def.id];
  const apiKey = (body.apiKey ?? '').trim();
  const baseUrl = (body.baseUrl ?? '').trim() || def.baseUrl;

  if (def.requiresKey !== false && !apiKey && !existing?.key) {
    return jsonError(`Paste your ${def.name} API key to connect. Create one at ${def.docs}.`, 400, { code: 'key_required' });
  }

  // Real validation against the provider's models endpoint.
  let models: ModelInfo[] = [];
  if (!body.skipValidation) {
    try {
      const raw = await fetchModels(def.id, apiKey || '', baseUrl);
      models = raw.map((m) => toModelInfo(def.id, m.id));
      if (!models.length) throw new Error('The models endpoint returned no models for this key.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Connection failed';
      user.providers = {
        ...(user.providers ?? {}),
        [def.id]: { provider: def.id, key: existing?.key, baseUrl, connected: false, status: 'error', message, lastChecked: Date.now(), defaultModel: existing?.defaultModel },
      };
      await saveUser(user);
      return jsonError(`${def.name} connection failed: ${message}`, 400, { code: 'connection_failed', provider: def.id });
    }
  } else {
    models = def.curated;
  }

  const stored: StoredProvider = {
    provider: def.id,
    key: apiKey ? encryptSecret(apiKey) : existing?.key,
    baseUrl,
    connected: true,
    status: 'connected',
    message: body.skipValidation ? 'Saved without live validation' : `Validated ${models.length} models`,
    lastChecked: Date.now(),
    defaultModel: body.model || existing?.defaultModel || def.defaultModel,
    models: models.slice(0, 400).map((m) => ({ id: m.id, name: m.name })),
  };
  user.providers = { ...(user.providers ?? {}), [def.id]: stored };
  user.settings = settingsOf(user);
  if (body.setDefault || !user.settings.defaultProvider || !user.providers[user.settings.defaultProvider]?.connected) {
    user.settings.defaultProvider = def.id;
    user.settings.defaultModel = stored.defaultModel ?? def.defaultModel;
  }
  if (!user.settings.taskProviders?.imageGen && (def.id === 'openai' || def.id === 'google')) {
    user.settings.taskProviders = { ...user.settings.taskProviders };
  }
  await saveUser(user);
  await audit(userId, 'provider.connect', `${def.id}${apiKey ? ` key ${maskKey(apiKey)}` : ''}`);
  invalidateModelCache();
  return Response.json({ provider: publicProvider(stored), settings: user.settings, models: models.slice(0, 120) });
}

export async function PATCH(req: Request) {
  const userId = ensureUserId();
  const user = await getUser(userId);
  const body = (await req.json().catch(() => ({}))) as { provider?: string; setDefault?: boolean; model?: string; baseUrl?: string };
  if (!body.provider || !user.providers?.[body.provider]) return jsonError('Provider not connected.', 404, { code: 'not_found' });
  const p = user.providers[body.provider];
  if (body.baseUrl !== undefined) p.baseUrl = body.baseUrl.trim();
  if (body.model) p.defaultModel = body.model;
  if (body.setDefault) {
    user.settings = { ...settingsOf(user), defaultProvider: body.provider, defaultModel: body.model || p.defaultModel || getProvider(body.provider)?.defaultModel || user.settings.defaultModel };
  }
  await saveUser(user);
  await audit(userId, 'provider.update', body.provider);
  return Response.json({ ok: true, settings: settingsOf(user) });
}

export async function DELETE(req: Request) {
  const userId = ensureUserId();
  const user = await getUser(userId);
  const provider = new URL(req.url).searchParams.get('provider');
  if (!provider) return jsonError('Provider required', 400, { code: 'bad_request' });
  if (user.providers?.[provider]) {
    delete user.providers[provider];
    user.settings = settingsOf(user);
    if (user.settings.defaultProvider === provider) {
      const next = Object.values(user.providers ?? {}).find((p) => p.connected);
      user.settings.defaultProvider = next?.provider ?? DEFAULT_SETTINGS.defaultProvider;
      user.settings.defaultModel = next?.defaultModel ?? getProvider(next?.provider ?? 'openai')?.defaultModel ?? DEFAULT_SETTINGS.defaultModel;
    }
    await saveUser(user);
    await audit(userId, 'provider.remove', provider);
  }
  invalidateModelCache();
  return Response.json({ ok: true });
}
