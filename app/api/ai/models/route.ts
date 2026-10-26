import { ensureUserId, jsonError } from '@/lib/server/session';
import { getUser } from '@/lib/server/store';
import { getProvider, toModelInfo } from '@/lib/ai/providers';
import { fetchModels } from '@/lib/ai/runtime';
import { decryptSecret } from '@/lib/server/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const userId = ensureUserId();
  const url = new URL(req.url);
  const providerId = url.searchParams.get('provider') ?? '';
  const refresh = url.searchParams.get('refresh') === '1';
  const def = getProvider(providerId);
  if (!def) return jsonError('Unknown provider', 400, { code: 'unknown_provider' });

  const user = await getUser(userId);
  const stored = user.providers?.[def.id];
  if (!stored?.connected) {
    return Response.json({ provider: def.id, source: 'curated', models: def.curated, error: 'Connect this provider to list live models.' });
  }

  if (refresh) {
    const { invalidateModelCache } = await import('@/lib/ai/runtime');
    invalidateModelCache();
  }

  const key = stored.key ? decryptSecret(stored.key) ?? '' : '';
  try {
    const raw = await fetchModels(def.id, key, stored.baseUrl ?? def.baseUrl);
    const models = raw.map((m) => toModelInfo(def.id, m.id));
    return Response.json({ provider: def.id, source: 'live', models, curated: def.curated });
  } catch (e) {
    return Response.json({
      provider: def.id, source: 'curated', models: def.curated,
      error: e instanceof Error ? e.message : 'Could not reach provider — showing curated models.',
    });
  }
}
