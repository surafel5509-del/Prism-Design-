import { decryptSecret } from './crypto';
import { getUser, saveUser, DEFAULT_SETTINGS, type AISettings, type UsageEntry, type RunRecord, type UserRecord } from './store';
import { estimateCost, findModel, getProvider, supportsVision } from '@/lib/ai/providers';

export type Task = 'chat' | 'imageGen' | 'vision' | 'speech' | 'music' | 'copy';

export interface Target { provider: string; model: string; apiKey: string; baseUrl?: string }

export function settingsOf(user: UserRecord): AISettings {
  return { ...DEFAULT_SETTINGS, ...(user.settings ?? {}), taskProviders: { ...DEFAULT_SETTINGS.taskProviders, ...(user.settings?.taskProviders ?? {}) } };
}

/** Keys the server itself owns, so managed providers work before the user adds anything. */
export function serverKey(providerId: string): string | null {
  const def = getProvider(providerId);
  if (!def?.managed) return null;
  for (const name of def.managedEnv ?? []) {
    const value = process.env[name];
    if (value && value.trim().length > 8) return value.trim();
  }
  return null;
}

export function managedBaseUrl(providerId: string): string | undefined {
  const def = getProvider(providerId);
  if (providerId === 'opencode') return process.env.PRISM_AI_BASE_URL || def?.baseUrl;
  if (providerId === 'openrouter') return process.env.OPENROUTER_BASE_URL || def?.baseUrl;
  return def?.baseUrl;
}

export function managedModel(providerId: string): string | undefined {
  if (providerId === 'opencode') return process.env.PRISM_AI_MODEL || undefined;
  if (providerId === 'openrouter') return process.env.OPENROUTER_MODEL || undefined;
  return undefined;
}

/** Every provider the server can serve without user input, in priority order. */
export function managedProviders(): string[] {
  return ['opencode', 'openrouter'].filter((id) => Boolean(serverKey(id)));
}

export function unlockedKey(user: UserRecord, providerId: string): string | null {
  const p = user.providers?.[providerId];
  if (p?.connected) {
    if (!p.key) {
      if (p.managed) return serverKey(providerId);
      return getProvider(providerId)?.requiresKey === false ? '' : null;
    }
    try { return decryptSecret(p.key); } catch { /* fall through to managed key */ }
  }
  return serverKey(providerId);
}

export function isConnected(user: UserRecord, providerId: string): boolean {
  const p = user.providers?.[providerId];
  if (p?.connected) {
    if (!p.key) return Boolean(p.managed ? serverKey(providerId) : getProvider(providerId)?.requiresKey === false);
    return true;
  }
  return Boolean(serverKey(providerId));
}

/** Pick the provider for a task: explicit override → per-task preference → account default. */
export function resolveTarget(user: UserRecord, task: Task = 'chat', override?: { provider?: string; model?: string }): Target | null {
  const settings = settingsOf(user);
  const candidates: { provider: string; model?: string }[] = [];
  if (override?.provider) candidates.push({ provider: override.provider, model: override.model });
  const taskPref = settings.taskProviders?.[task];
  if (taskPref?.provider) candidates.push({ provider: taskPref.provider, model: taskPref.model });
  if (settings.defaultProvider) candidates.push({ provider: settings.defaultProvider, model: settings.defaultModel });
  // Built-in providers keep the agent working out of the box, after any user choice fails.
  for (const id of managedProviders()) candidates.push({ provider: id, model: managedModel(id) });
  for (const c of candidates) {
    const key = unlockedKey(user, c.provider);
    if (key === null) continue;
    const def = getProvider(c.provider);
    const model = c.model || managedModel(c.provider) || def?.defaultModel || settings.defaultModel;
    const store = user.providers[c.provider];
    return { provider: c.provider, model, apiKey: key, baseUrl: store?.baseUrl || managedBaseUrl(c.provider) };
  }
  return null;
}

export function capabilities(user: UserRecord): { vision: boolean; imageGen: boolean; speech: boolean; tools: boolean; imageTarget: Target | null; visionTarget: Target | null; speechTarget: Target | null } {
  const settings = settingsOf(user);
  const imageTarget = [settings.taskProviders?.imageGen, { provider: settings.defaultProvider, model: settings.defaultModel }]
    .filter((x): x is { provider: string; model: string } => Boolean(x?.provider))
    .map((x) => resolveTarget(user, 'imageGen', x))
    .find((t): t is Target => Boolean(t) && (t!.provider === 'openai' || t!.provider === 'google')) ?? null;

  const visionResolved = resolveTarget(user, 'vision');
  const visionTarget = visionResolved && supportsVision(visionResolved.provider, visionResolved.model) ? visionResolved : null;

  const speechResolved = resolveTarget(user, 'speech');
  const speechTarget = speechResolved && (speechResolved.provider === 'openai' || speechResolved.provider === 'custom') ? speechResolved : null;

  const chat = resolveTarget(user, 'chat');
  return {
    vision: Boolean(visionTarget),
    imageGen: Boolean(imageTarget),
    speech: Boolean(speechTarget),
    tools: Boolean(chat),
    imageTarget, visionTarget, speechTarget,
  };
}

export async function recordUsage(userId: string, entry: Omit<UsageEntry, 'id' | 'at'> & { id?: string; at?: number }): Promise<void> {
  const user = await getUser(userId);
  const model = findModel(entry.provider, entry.model);
  const cost = entry.cost || estimateCost(model, entry.tokensIn, entry.tokensOut);
  const full: UsageEntry = { id: entry.id ?? `u_${Date.now().toString(36)}`, at: entry.at ?? Date.now(), ...entry, cost };
  user.usage = [...(user.usage ?? []), full].slice(-500);
  await saveUser(user);
}

export async function recordRun(userId: string, run: RunRecord): Promise<void> {
  const user = await getUser(userId);
  user.runs = [run, ...(user.runs ?? [])].slice(0, 60);
  await saveUser(user);
}

export function providerErrorMessage(err: unknown, provider: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const name = getProvider(provider)?.name ?? provider;
  if (/401|invalid.*key|unauthor/i.test(raw)) return `${name} rejected the API key. Check it in Settings → AI and run Test Connection.`;
  if (/429|rate limit|quota/i.test(raw)) return `${name} rate-limited this request. Wait a moment or switch to another provider.`;
  if (/404|model.*not found|does not exist/i.test(raw)) return `${name} could not find that model. Pick another model in the AI panel.`;
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(raw)) return `Could not reach ${name}. For local providers make sure the server is running and reachable from Prism.`;
  if (/context|too long|maximum/i.test(raw)) return `The conversation exceeded ${name}'s context window. Start a new run or switch to a larger-context model.`;
  return raw.slice(0, 500);
}
