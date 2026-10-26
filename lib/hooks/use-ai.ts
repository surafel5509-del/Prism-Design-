'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelInfo } from '@/lib/engine/types';
import type { AISettings } from '@/lib/server/store';

export interface CatalogProvider {
  id: string; name: string; blurb: string; docs: string; baseUrl?: string; accent?: string;
  requiresKey: boolean; defaultModel: string; keyPrefix?: string; customBaseUrl?: boolean; curated: ModelInfo[];
}
export interface ConnectedProvider {
  provider: string; name: string; accent?: string; connected: boolean;
  status: 'connected' | 'error' | 'unconfigured'; message?: string; masked: string; keyPreview: string;
  baseUrl: string; defaultModel?: string; lastChecked?: number; models: string[]; requiresKey: boolean;
}
export interface ProvidersResponse {
  providers: ConnectedProvider[];
  catalog: CatalogProvider[];
  settings: AISettings;
  connectedCount: number;
  active: { provider: string; model: string } | null;
  usage: { requests: number; tokensIn: number; tokensOut: number; cost: number };
}

export function useProviders() {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/providers', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Could not load providers (${res.status})`);
      setData((await res.json()) as ProvidersResponse);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}

export function useModels(providerId: string | null, refreshKey = 0) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [source, setSource] = useState<'live' | 'curated'>('curated');
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const cache = useRef(new Map<string, { models: ModelInfo[]; source: 'live' | 'curated'; note: string | null }>());

  useEffect(() => {
    if (!providerId) { setModels([]); return; }
    const key = `${providerId}:${refreshKey}`;
    const hit = cache.current.get(key);
    if (hit) { setModels(hit.models); setSource(hit.source); setNote(hit.note); return; }
    let live = true;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/ai/models?provider=${encodeURIComponent(providerId)}${refreshKey ? '&refresh=1' : ''}`, { cache: 'no-store' });
        const json = (await res.json()) as { models?: ModelInfo[]; source?: 'live' | 'curated'; error?: string };
        if (!live) return;
        const list = json.models ?? [];
        setModels(list);
        setSource(json.source ?? 'curated');
        setNote(json.error ?? null);
        cache.current.set(key, { models: list, source: json.source ?? 'curated', note: json.error ?? null });
      } catch {
        if (live) setNote('Could not load models.');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [providerId, refreshKey]);

  return { models, source, loading, note };
}

export async function saveSettings(patch: Record<string, unknown>) {
  const res = await fetch('/api/ai/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Could not save settings');
  return json.settings as AISettings;
}

export async function connectProvider(payload: { provider: string; apiKey?: string; baseUrl?: string; model?: string; setDefault?: boolean; skipValidation?: boolean }) {
  const res = await fetch('/api/ai/providers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Could not connect provider');
  return json as { provider: ConnectedProvider; settings: AISettings; models: ModelInfo[] };
}

export async function testProvider(payload: { provider: string; apiKey?: string; baseUrl?: string }) {
  const res = await fetch('/api/ai/providers/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  return (await res.json()) as { ok: boolean; message: string; latencyMs?: number; modelCount?: number; models?: { id: string; name: string }[] };
}

export async function removeProvider(provider: string) {
  const res = await fetch(`/api/ai/providers?provider=${encodeURIComponent(provider)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error ?? 'Could not remove provider');
}

export async function setDefaultProvider(provider: string, model?: string) {
  const res = await fetch('/api/ai/providers', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider, model, setDefault: true }) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Could not set default provider');
  return json.settings as AISettings;
}
