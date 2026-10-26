'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Brain, Check, Coins, Cpu, Gauge, KeyRound, Loader2, RefreshCw, Route, Save, ShieldCheck, Sliders, Sparkles, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { ProviderCard } from '@/components/settings/ProviderCard';
import { useProviders, saveSettings as persistSettings, type ConnectedProvider } from '@/lib/hooks/use-ai';
import { Skeleton } from '@/components/ui/misc';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AISettings } from '@/lib/server/store';
import { cn } from '@/lib/utils';

const TASKS: { key: string; label: string; hint: string }[] = [
  { key: 'textToMotion', label: 'Motion generation', hint: 'Scenes, animation, transitions' },
  { key: 'textToDesign', label: 'Design generation', hint: 'Posters, social, decks' },
  { key: 'imageGen', label: 'Image generation', hint: 'Text-to-image models' },
  { key: 'vision', label: 'Vision analysis', hint: 'Reference images, color extraction' },
  { key: 'speech', label: 'Speech / voiceover', hint: 'TTS voices' },
  { key: 'music', label: 'Music suggestion', hint: 'Soundtrack picking' },
];

export function AISettingsPage() {
  const { data, loading, refresh, error } = useProviders();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<AISettings>>({});

  useEffect(() => { if (data?.settings) setSettings(data.settings); }, [data?.settings]);

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/usage', { cache: 'no-store' });
      if (res.ok) setUsage(await res.json() as UsageResponse);
    } catch { /* offline */ }
  }, []);

  useEffect(() => { void loadUsage(); }, [loadUsage]);

  const patch = useCallback((next: Partial<AISettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...next } : prev));
    pending.current = { ...pending.current, ...next };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const payload = pending.current;
      pending.current = {};
      if (!settingsRef.current || !Object.keys(payload).length) return;
      try {
        const saved = await persistSettings(payload as Record<string, unknown>);
        setSettings((prev) => ({ ...(prev as AISettings), ...saved }));
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1600);
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save settings'); }
    }, 650);
  }, []);

  const settingsRef = useRef<AISettings | null>(null);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const clearUsage = async () => {
    try { await persistSettings({ clearUsage: true }); await loadUsage(); toast.success('Usage cleared'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not clear usage'); }
  };

  const connectedProviders = (data?.providers ?? []).filter((p) => p.connected);
  const defaultProvider = data?.providers.find((p) => p.provider === settings?.defaultProvider);
  const defaultModels = modelOptionsFor(defaultProvider, data?.catalog.find((c) => c.id === defaultProvider?.provider)?.curated ?? []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-[linear-gradient(120deg,rgba(124,58,237,.12),rgba(6,182,212,.05))] px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500/20 ring-1 ring-violet-400/30"><KeyRound className="h-4 w-4 text-violet-200" /></span>
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold tracking-tight">Bring your own intelligence</p>
          <p className="text-[10px] text-muted-foreground">
            {connectedProviders.length} of {data?.catalog.length ?? 12} providers ready
            {data?.managedCount ? ` · ${data.managedCount} built-in included` : ''} · keys encrypted server-side · real streaming tool-calling
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {savedFlash && <span className="flex items-center gap-1 text-[10px] text-emerald-300"><Check className="h-3 w-3" /> Saved</span>}
          <Button variant="outline" size="sm" onClick={() => { void refresh(); void loadUsage(); }} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
          </Button>
          <a href="/dashboard" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[linear-gradient(110deg,#7c3aed,#0891b2_52%,#c026d3)] px-3 text-[11.5px] font-medium text-white shadow-[0_6px_24px_-8px_rgba(139,92,246,.9)]">
            <Sparkles className="h-3.5 w-3.5" /> Open studio
          </a>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-400/25 bg-rose-500/[0.07] px-3 py-2 text-[10.5px] text-rose-200">{error}</div>}

      <section>
        <SectionHead icon={<Zap className="h-3.5 w-3.5" />} title="Providers" hint="Prism AI Cloud is included and ready. Connect your own keys for image generation, speech and extra quota." />
        {loading && !data ? (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[148px] rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(data?.catalog ?? []).map((catalog) => (
              <ProviderCard
                key={catalog.id}
                catalog={catalog}
                connected={data?.providers.find((p) => p.provider === catalog.id)}
                isDefault={settings?.defaultProvider === catalog.id}
                onChanged={async () => { await refresh(); await loadUsage(); }}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-border/70 bg-white/[0.015] p-3.5">
          <SectionHead icon={<Sliders className="h-3.5 w-3.5" />} title="Generation defaults" hint="Applied to every new run — override per run in the editor." />

          <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
            <div>
              <FieldLabel>Default provider</FieldLabel>
              <select
                value={settings?.defaultProvider ?? ''}
                onChange={(e) => {
                  const provider = e.target.value;
                  const models = modelOptionsFor(data?.providers.find((p) => p.provider === provider), data?.catalog.find((c) => c.id === provider)?.curated ?? []);
                  patch({ defaultProvider: provider, defaultModel: models[0]?.id ?? '' });
                }}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] outline-none focus:border-violet-400/50"
              >
                <option value="">Not selected</option>
                {connectedProviders.map((p) => <option key={p.provider} value={p.provider}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Default model</FieldLabel>
              <select
                value={settings?.defaultModel ?? ''}
                onChange={(e) => patch({ defaultModel: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] outline-none focus:border-violet-400/50"
              >
                {defaultModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                {settings?.defaultModel && !defaultModels.some((m) => m.id === settings.defaultModel) && <option value={settings.defaultModel}>{settings.defaultModel}</option>}
              </select>
            </div>

            <Range label="Temperature" value={settings?.temperature ?? 0.7} min={0} max={2} step={0.05} onChange={(v) => patch({ temperature: v })} format={(v) => v.toFixed(2)} />
            <Range label="Top P" value={settings?.topP ?? 1} min={0.05} max={1} step={0.05} onChange={(v) => patch({ topP: v })} format={(v) => v.toFixed(2)} />
            <Range label="Max output tokens" value={settings?.maxTokens ?? 4096} min={512} max={16384} step={256} onChange={(v) => patch({ maxTokens: Math.round(v) })} format={(v) => String(Math.round(v))} />

            <div>
              <FieldLabel>Reasoning effort</FieldLabel>
              <div className="flex gap-1">
                {(['low', 'medium', 'high'] as const).map((r) => (
                  <button key={r} onClick={() => patch({ reasoningEffort: r })} className={cn('flex-1 rounded-md border px-1 py-1 text-[10px] capitalize transition-colors', settings?.reasoningEffort === r ? 'border-violet-400/35 bg-violet-500/10 text-violet-100' : 'border-border/70 text-muted-foreground hover:text-foreground')}>{r}</button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Default mode</FieldLabel>
              <div className="flex gap-1">
                {(['agent', 'thinking', 'fast'] as const).map((m) => (
                  <button key={m} onClick={() => patch({ defaultMode: m })} className={cn('flex-1 rounded-md border px-1 py-1 text-[10px] capitalize transition-colors', settings?.defaultMode === m ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100' : 'border-border/70 text-muted-foreground hover:text-foreground')}>{m}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <SwitchRow label="Stream responses" hint="Token-by-token output with live tool calls" checked={settings?.streaming ?? true} onChange={(v) => patch({ streaming: v })} />
            <SwitchRow label="Tool calling" hint="Let the model edit layers, keyframes and exports" checked={settings?.toolCalling ?? true} onChange={(v) => patch({ toolCalling: v })} />
            <SwitchRow label="Require plan approval" hint="The agent asks before mutating the document" checked={settings?.requireApproval ?? false} onChange={(v) => patch({ requireApproval: v })} />
            <SwitchRow label="Auto-fallback provider" hint="Retry on a backup provider if the primary key fails" checked={settings?.fallbackEnabled ?? false} onChange={(v) => patch({ fallbackEnabled: v })} />
          </div>

          {settings?.fallbackEnabled && (
            <div className="mt-2 grid gap-2 rounded-lg border border-border/70 bg-black/20 p-2 sm:grid-cols-2">
              <div>
                <FieldLabel>Fallback provider</FieldLabel>
                <select value={settings.fallbackProvider ?? ''} onChange={(e) => patch({ fallbackProvider: e.target.value })} className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-[10.5px]">
                  <option value="">None</option>
                  {connectedProviders.filter((p) => p.provider !== settings.defaultProvider).map((p) => <option key={p.provider} value={p.provider}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Fallback model</FieldLabel>
                <Input value={settings.fallbackModel ?? ''} onChange={(e) => patch({ fallbackModel: e.target.value })} className="h-7 font-mono text-[10.5px]" placeholder="claude-sonnet-4-20250514" />
              </div>
            </div>
          )}

          <div className="mt-3">
            <FieldLabel>System prompt extra</FieldLabel>
            <textarea
              value={settings?.systemPromptExtra ?? ''}
              onChange={(e) => patch({ systemPromptExtra: e.target.value })}
              placeholder="House style, brand voice, constraints…"
              rows={3}
              className="w-full resize-none rounded-lg border border-input bg-background px-2 py-1.5 text-[10.5px] leading-relaxed outline-none focus:border-violet-400/50"
            />
            <p className="mt-0.5 text-[9px] text-muted-foreground">Appended to every agent system prompt. Keep it short and specific.</p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="rounded-2xl border border-border/70 bg-white/[0.015] p-3.5">
            <SectionHead icon={<Route className="h-3.5 w-3.5" />} title="Per-task routing" hint="Send each kind of work to the model that does it best." />
            <div className="mt-2 space-y-1.5">
              {TASKS.map((task) => {
                const current = settings?.taskProviders?.[task.key];
                return (
                  <div key={task.key} className="rounded-lg border border-border/60 bg-black/15 px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10.5px] font-medium text-foreground/85">{task.label}</p>
                      <span className="ml-auto text-[8.5px] text-muted-foreground/60">{task.hint}</span>
                    </div>
                    <div className="mt-1 flex gap-1">
                      <select
                        value={current?.provider ?? ''}
                        onChange={(e) => {
                          const provider = e.target.value;
                          const def = data?.providers.find((p) => p.provider === provider);
                          patch({ taskProviders: { ...(settings?.taskProviders ?? {}), [task.key]: { provider, model: def?.defaultModel ?? '' } } });
                        }}
                        className="h-6 min-w-0 flex-1 rounded border border-input bg-background px-1 text-[9.5px]"
                      >
                        <option value="">Default</option>
                        {connectedProviders.map((p) => <option key={p.provider} value={p.provider}>{p.name}</option>)}
                      </select>
                      <input
                        value={current?.model ?? ''}
                        onChange={(e) => patch({ taskProviders: { ...(settings?.taskProviders ?? {}), [task.key]: { provider: current?.provider ?? settings?.defaultProvider ?? '', model: e.target.value } } })}
                        placeholder="model id"
                        className="h-6 min-w-0 flex-1 rounded border border-input bg-background px-1 font-mono text-[9.5px]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.045] p-3">
            <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /><p className="text-[11px] font-medium text-emerald-100">Security model</p></div>
            <ul className="mt-1.5 space-y-1 text-[9.5px] leading-relaxed text-muted-foreground">
              <li>• Keys encrypted with AES-256-GCM before storage.</li>
              <li>• Decryption happens only inside server API routes.</li>
              <li>• The browser receives a masked preview, never the secret.</li>
              <li>• Every model call is rate-limited and audit-logged.</li>
            </ul>
          </div>
        </section>
      </div>

      <section id="usage" className="rounded-2xl border border-border/70 bg-white/[0.015] p-3.5">
        <SectionHead icon={<Gauge className="h-3.5 w-3.5" />} title="Usage & cost" hint="Estimated from each provider’s published per-million-token pricing." action={<Button size="xs" variant="ghost" onClick={clearUsage}><Trash2 className="h-3 w-3" /> Clear</Button>} />
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric icon={<Zap className="h-3 w-3" />} label="Requests" value={String(usage?.totals.requests ?? 0)} />
          <Metric icon={<Cpu className="h-3 w-3" />} label="Tokens in" value={fmtNum(usage?.totals.tokensIn ?? 0)} />
          <Metric icon={<Brain className="h-3 w-3" />} label="Tokens out" value={fmtNum(usage?.totals.tokensOut ?? 0)} />
          <Metric icon={<Coins className="h-3 w-3" />} label="Est. cost" value={`$${(usage?.totals.cost ?? 0).toFixed(3)}`} />
        </div>

        {usage && usage.byProvider.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-white/[0.03] text-[9px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-2 py-1.5 font-medium">Provider</th><th className="px-2 py-1.5 font-medium">Requests</th><th className="px-2 py-1.5 font-medium">Tokens</th><th className="px-2 py-1.5 text-right font-medium">Cost</th></tr>
              </thead>
              <tbody>
                {usage.byProvider.map((p) => (
                  <tr key={p.provider} className="border-t border-border/40">
                    <td className="px-2 py-1.5 text-foreground/80">{p.name}</td>
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{p.requests}</td>
                    <td className="px-2 py-1.5 font-mono text-muted-foreground">{fmtNum(p.tokensIn + p.tokensOut)}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-foreground/80">${p.cost.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3">
          <p className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">Recent runs</p>
          {usage && usage.runs.length === 0 && <p className="rounded-lg border border-dashed border-border/70 px-2 py-4 text-center text-[10px] text-muted-foreground">No runs yet. Ask the agent to build something in the studio.</p>}
          <div className="space-y-1">
            {usage?.runs.slice(0, 8).map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-black/15 px-2 py-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', r.status === 'done' ? 'bg-emerald-400' : r.status === 'error' ? 'bg-rose-400' : 'bg-amber-400')} />
                <span className="truncate text-[10px] text-foreground/75">{r.prompt || '(no prompt)'}</span>
                <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">{r.toolCalls} tools · {fmtNum(r.tokensIn + r.tokensOut)} tok · ${(r.cost ?? 0).toFixed(3)}</span>
                <span className="shrink-0 text-[8.5px] text-muted-foreground/60">{new Date(r.at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

interface UsageResponse {
  totals: { requests: number; tokensIn: number; tokensOut: number; cost: number };
  byProvider: { provider: string; name: string; requests: number; tokensIn: number; tokensOut: number; cost: number }[];
  runs: { id: string; prompt: string; status: string; toolCalls: number; tokensIn: number; tokensOut: number; cost: number; at: number }[];
  recent: unknown[];
}

function modelOptionsFor(provider: ConnectedProvider | undefined, curated: { id: string; name: string }[]) {
  if (!provider) return curated;
  const ids = provider.models?.length ? provider.models : [];
  const merged = [...ids.map((id) => ({ id, name: curated.find((c) => c.id === id)?.name ?? id })), ...curated];
  const seen = new Set<string>();
  return merged.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

function SectionHead({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/[0.05] text-violet-300">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold tracking-tight">{title}</p>
        {hint && <p className="truncate text-[9px] text-muted-foreground">{hint}</p>}
      </div>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground/80">{children}</p>;
}

function Range({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="font-mono text-[9.5px] text-muted-foreground">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-violet-400 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-300" />
    </div>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-white/[0.02]">
      <div className="min-w-0">
        <p className="text-[10.5px] text-foreground/85">{label}</p>
        <p className="truncate text-[9px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="ml-auto" />
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-black/15 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground/70">{icon}{label}</div>
      <p className="mt-0.5 font-mono text-[12px] text-foreground/85">{value}</p>
    </div>
  );
}

const fmtNum = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
