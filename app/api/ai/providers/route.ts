import { z } from 'zod';
import { ensureUserId, jsonError } from '@/lib/server/session';
import { getUser, saveUser, audit, DEFAULT_SETTINGS, type StoredProvider } from '@/lib/server/store';
import { encryptSecret, maskKey, fingerprint } from '@/lib/server/crypto';
import { getProvider, PROVIDERS, toModelInfo } from '@/lib/ai/providers';
import type { ModelInfo } from '@/lib/engine/types';
import { fetchModels, invalidateModelCache } from '@/lib/ai/runtime';
import { isConnected, managedBaseUrl, managedModel, managedProviders, resolveTarget, serverKey, settingsOf } from '@/lib/server/ai-config';
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
  managed: z.boolean().optional(),
});

function publicProvider(p: StoredProvider) {
  const def = getProvider(p.provider);
  const usesServerKey = Boolean(p.managed && !p.key && serverKey(p.provider));
  return {
    provider: p.provider,
    name: def?.name ?? p.provider,
    accent: def?.accent,
    connected: p.connected,
    status: p.status,
    message: p.message,
    masked: usesServerKey ? 'Server-managed key' : p.key ? `••••••••••••${fingerprint(JSON.stringify(p.key)).slice(-4)}` : def?.requiresKey === false ? 'No key required' : '',
    keyPreview: usesServerKey ? 'Built-in key' : p.key ? `••••••••••••${fingerprint(JSON.stringify(p.key)).slice(-4)}` : '',
    baseUrl: p.baseUrl ?? def?.baseUrl ?? '',
    defaultModel: p.defaultModel ?? def?.defaultModel,
    lastChecked: p.lastChecked,
    models: (p.models ?? []).map((m) => m.id),
    requiresKey: def?.requiresKey !== false,
    managed: Boolean(p.managed),
    managedAvailable: Boolean(serverKey(p.provider)),
  };
}

/** Materialise server-managed providers so the UI shows them as ready to use. */
function withManaged(user: { providers: Record<string, StoredProvider> }) {
  const providers: StoredProvider[] = Object.values(user.providers ?? {});
  for (const id of managedProviders()) {
    if (providers.some((p) => p.provider === id)) continue;
    const def = getProvider(id);
    if (!def) continue;
    providers.push({
      provider: id,
      connected: true,
      status: 'connected',
      managed: true,
      baseUrl: managedBaseUrl(id),
      defaultModel: managedModel(id) ?? def.defaultModel,
      message: 'Included with Prism — no key needed',
      lastChecked: Date.now(),
      models: def.curated.map((m) => ({ id: m.id, name: m.name })),
    });
  }
  return providers.sort((a, b) => Number(b.connected) - Number(a.connected));
}

async function ensureUsableDefault(user: Awaited<ReturnType<typeof getUser>>) {
  const settings = settingsOf(user);
  const usable = settings.defaultProvider && isConnected(user, settings.defaultProvider);
  if (usable) return false;
  const managed = managedProviders()[0];
  if (!managed) return false;
  const def = getProvider(managed);
  user.settings = { ...settings, defaultProvider: managed, defaultModel: managedModel(managed) ?? def?.defaultModel ?? settings.defaultModel };
  await saveUser(user);
  return true;
}

export async function GET() {
  const userId = ensureUserId();
  let user = await getUser(userId);
  if (await ensureUsableDefault(user)) user = await getUser(userId);
  const settings = settingsOf(user);
  const providers = withManaged(user);
  const connected = providers.filter((p) => p.connected);
  const active = resolveTarget(user);
  return Response.json({
    providers: providers.map(publicProvider),
    catalog: PROVIDERS.map((p) => ({
      id: p.id, name: p.name, blurb: p.blurb, docs: p.docs, baseUrl: p.baseUrl,
      accent: p.accent, requiresKey: p.requiresKey !== false, defaultModel: p.defaultModel,
      keyPrefix: p.keyPrefix, customBaseUrl: p.customBaseUrl, curated: p.curated,
      managed: Boolean(p.managed), managedAvailable: Boolean(serverKey(p.id)),
    })),
    settings,
    connectedCount: connected.length,
    managedCount: managedProviders().length,
    active: active ? { provider: active.provider, model: active.model } : null,
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
  const useManaged = (body.managed || (!apiKey && Boolean(serverKey(def.id)))) && Boolean(serverKey(def.id));
  const baseUrl = (body.baseUrl ?? '').trim() || (useManaged ? managedBaseUrl(def.id) : def.baseUrl) || '';

  if (def.requiresKey !== false && !apiKey && !existing?.key && !useManaged) {
    return jsonError(`Paste your ${def.name} API key to connect. Create one at ${def.docs}.`, 400, { code: 'key_required' });
  }

  let models: ModelInfo[] = [];
  if (!body.skipValidation) {
    try {
      const raw = await fetchModels(def.id, apiKey || (useManaged ? serverKey(def.id) ?? '' : ''), baseUrl);
      models = raw.map((m) => toModelInfo(def.id, m.id));
      if (!models.length) throw new Error('The models endpoint returned no models for this key.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Connection failed';
      if (!useManaged) {
        user.providers = {
          ...(user.providers ?? {}),
          [def.id]: { provider: def.id, key: existing?.key, baseUrl, connected: false, status: 'error', message, lastChecked: Date.now(), defaultModel: existing?.defaultModel },
        };
        await saveUser(user);
        return jsonError(`${def.name} connection failed: ${message}`, 400, { code: 'connection_failed', provider: def.id });
      }
      models = def.curated; // managed key still usable; live listing may be blocked
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
    managed: apiKey ? false : useManaged || existing?.managed,
    message: apiKey ? (body.skipValidation ? 'Saved without live validation' : `Validated ${models.length} models`) : 'Using Prism’s built-in key',
    lastChecked: Date.now(),
    defaultModel: body.model || existing?.defaultModel || managedModel(def.id) || def.defaultModel,
    models: models.slice(0, 400).map((m) => ({ id: m.id, name: m.name })),
  };
  user.providers = { ...(user.providers ?? {}), [def.id]: stored };
  const settings = settingsOf(user);
  if (body.setDefault || !settings.defaultProvider || !isConnected(user, settings.defaultProvider)) {
    settings.defaultProvider = def.id;
    settings.defaultModel = stored.defaultModel ?? def.defaultModel;
  }
  user.settings = settings;
  await saveUser(user);
  await audit(userId, 'provider.connect', `${def.id}${apiKey ? ` key ${maskKey(apiKey)}` : useManaged ? ' managed key' : ''}`);
  invalidateModelCache();
  return Response.json({ provider: publicProvider(stored), settings, models: models.slice(0, 120) });
}

export async function PATCH(req: Request) {
  const userId = ensureUserId();
  const user = await getUser(userId);
  const body = (await req.json().catch(() => ({}))) as { provider?: string; setDefault?: boolean; model?: string; baseUrl?: string };
  if (!body.provider) return jsonError('Provider required', 400, { code: 'bad_request' });
  const def = getProvider(body.provider);
  if (!user.providers?.[body.provider] && !serverKey(body.provider)) return jsonError('Provider not connected.', 404, { code: 'not_found' });

  if (!user.providers?.[body.provider] && serverKey(body.provider) && def) {
    user.providers = {
      ...(user.providers ?? {}),
      [body.provider]: {
        provider: body.provider, connected: true, status: 'connected', managed: true,
        baseUrl: managedBaseUrl(body.provider), defaultModel: managedModel(body.provider) ?? def.defaultModel,
        message: 'Included with Prism — no key needed', lastChecked: Date.now(),
        models: def.curated.map((m) => ({ id: m.id, name: m.name })),
      },
    };
  }
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
  const managed = provider === 'opencode' || provider === 'openrouter';
  if (user.providers?.[provider]) {
    if (managed && serverKey(provider) && user.providers[provider].managed) {
      // "Removing" a built-in provider just clears the user's own override.
      delete user.providers[provider];
    } else {
      delete user.providers[provider];
    }
    user.settings = settingsOf(user);
    if (user.settings.defaultProvider === provider) {
      const next = (Object.values(user.providers ?? {}).find((p) => p.connected && p.key)) ?? (managedProviders()[0] ? { provider: managedProviders()[0], defaultModel: managedModel(managedProviders()[0]) } : undefined);
      user.settings.defaultProvider = next?.provider ?? DEFAULT_SETTINGS.defaultProvider;
      user.settings.defaultModel = next?.defaultModel ?? getProvider(next?.provider ?? 'openai')?.defaultModel ?? DEFAULT_SETTINGS.defaultModel;
    }
    await saveUser(user);
    await audit(userId, 'provider.remove', provider);
  }
  invalidateModelCache();
  return Response.json({ ok: true });
}
