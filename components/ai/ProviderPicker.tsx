'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Cpu, Eye, Gauge, Loader2, RefreshCw, Search, Sparkles, Wrench, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useModels, useProviders } from '@/lib/hooks/use-ai';
import type { ModelInfo } from '@/lib/engine/types';

export interface AITargetValue { provider: string; model: string }

const CAP_LABEL: Record<string, string> = { tools: 'Tools', vision: 'Vision', reasoning: 'Reasoning', image: 'Image', audio: 'Audio' };
const CAP_ICON: Record<string, React.ReactNode> = {
  tools: <Wrench className="h-3 w-3" />,
  vision: <Eye className="h-3 w-3" />,
  reasoning: <Sparkles className="h-3 w-3" />,
  image: <Cpu className="h-3 w-3" />,
  audio: <Zap className="h-3 w-3" />,
};

export function ProviderPicker({ open, onOpenChange, value, onChange }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: AITargetValue | null;
  onChange: (v: AITargetValue) => void;
}) {
  const { data, loading, refresh } = useProviders();
  const [selected, setSelected] = useState(value?.provider ?? 'openai');
  const [query, setQuery] = useState('');
  const [cap, setCap] = useState<string | null>('tools');
  const [refreshKey, setRefreshKey] = useState(0);
  const { models, source, loading: modelsLoading, note } = useModels(open ? selected : null, refreshKey);

  useEffect(() => {
    if (open && value?.provider) setSelected(value.provider);
  }, [open, value?.provider]);

  const connected = useMemo(() => new Set((data?.providers ?? []).filter((p) => p.connected).map((p) => p.provider)), [data]);
  const catalog = data?.catalog ?? [];
  const ordered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...catalog]
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.blurb.toLowerCase().includes(q))
      .sort((a, b) => Number(connected.has(b.id)) - Number(connected.has(a.id)));
  }, [catalog, connected, query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models
      .filter((m) => !cap || m.capabilities.includes(cap as ModelInfo['capabilities'][number]))
      .filter((m) => !q || m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
      .slice(0, 80);
  }, [models, cap, query]);

  const providerMeta = catalog.find((p) => p.id === selected);
  const isConnected = connected.has(selected);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden p-0">
        <DialogTitle className="sr-only">Choose AI provider and model</DialogTitle>
        <div className="grid max-h-[min(72vh,680px)] grid-cols-[212px_1fr]">
          <div className="flex flex-col border-r border-border/70 bg-black/20">
            <div className="flex items-center gap-2 px-3 pb-2 pt-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find provider" className="h-7 pl-7 text-[11px]" />
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => void refresh()} aria-label="Refresh providers">
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-1.5 pb-2">
              {ordered.map((p) => {
                const live = connected.has(p.id);
                const active = p.id === selected;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelected(p.id); setQuery(''); }}
                    className={cn(
                      'group mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                      active ? 'bg-violet-500/12 text-foreground ring-1 ring-inset ring-violet-400/25' : 'text-foreground/70 hover:bg-white/[0.045]',
                    )}
                  >
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-bold text-black/80"
                      style={{ background: `linear-gradient(140deg, ${p.accent ?? '#8b5cf6'}, ${p.accent ?? '#8b5cf6'}99)` }}
                    >
                      {p.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-medium">{p.name}</span>
                      <span className="block truncate text-[9.5px] text-muted-foreground">{live ? 'Connected' : 'Not connected'}</span>
                    </span>
                    {live && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.9)]" />}
                  </button>
                );
              })}
            </div>
            <a href="/settings/ai" target="_blank" rel="noreferrer" className="flex items-center justify-between gap-1 border-t border-border/70 px-3 py-2 text-[10.5px] text-muted-foreground transition-colors hover:text-foreground">
              Manage keys <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold tracking-tight">{providerMeta?.name ?? selected}</h2>
                  {isConnected ? <Badge variant="success" className="h-4">Connected</Badge> : <Badge variant="outline" className="h-4">Key needed</Badge>}
                  {source === 'live' && <Badge variant="secondary" className="h-4">Live models</Badge>}
                </div>
                <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{providerMeta?.blurb}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="icon-sm" onClick={() => setRefreshKey((k) => k + 1)} aria-label="Refresh models">
                  <RefreshCw className={cn('h-3.5 w-3.5', modelsLoading && 'animate-spin')} />
                </Button>
              </div>
            </div>

            {!isConnected ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-cyan-500/10 ring-1 ring-violet-400/25">
                  <Sparkles className="h-5 w-5 text-violet-300" />
                </div>
                <div>
                  <p className="text-[13px] font-medium">Connect {providerMeta?.name}</p>
                  <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                    Paste an API key in Settings → AI. Keys are encrypted with AES-256-GCM on the server and never returned to this browser.
                  </p>
                </div>
                <Button asChild variant="prism" size="sm">
                  <a href="/settings/ai" target="_blank" rel="noreferrer">Open AI settings <ArrowUpRight className="h-3.5 w-3.5" /></a>
                </Button>
                <p className="text-[10px] text-muted-foreground">{providerMeta?.docs}</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1 border-b border-border/70 px-3 py-2">
                  <CapChip active={cap === null} onClick={() => setCap(null)} label="All" icon={<Gauge className="h-3 w-3" />} />
                  {(['tools', 'vision', 'reasoning'] as const).map((c) => (
                    <CapChip key={c} active={cap === c} onClick={() => setCap(c)} label={CAP_LABEL[c]} icon={CAP_ICON[c]} />
                  ))}
                  <div className="relative ml-auto w-44">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search models" className="h-7 pl-7 text-[11px]" />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                  {note && <p className="px-2 py-1.5 text-[10.5px] text-amber-300/80">{note}</p>}
                  {modelsLoading && models.length === 0 && (
                    <div className="flex items-center gap-2 px-3 py-6 text-[11px] text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading models…</div>
                  )}
                  {!modelsLoading && filtered.length === 0 && (
                    <p className="px-3 py-6 text-[11px] text-muted-foreground">No models match those filters.</p>
                  )}
                  {filtered.map((m) => {
                    const isActive = value?.provider === selected && value?.model === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { onChange({ provider: selected, model: m.id }); onOpenChange(false); }}
                        className={cn(
                          'group mb-0.5 flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                          isActive ? 'bg-violet-500/10 ring-1 ring-inset ring-violet-400/25' : 'hover:bg-white/[0.045]',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[12px] font-medium">{m.name}</span>
                            {isActive && <Check className="h-3 w-3 shrink-0 text-violet-300" />}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[9.5px] text-muted-foreground">{m.id.slice(0, 46)}</span>
                            <span className="text-[9.5px] text-muted-foreground/70">· {(m.contextWindow / 1000).toFixed(0)}k ctx</span>
                            <span className="text-[9.5px] text-muted-foreground/70">· ${m.inputCost.toFixed(2)}/${m.outputCost.toFixed(2)} per M</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {m.capabilities.filter((c) => ['tools', 'vision', 'reasoning'].includes(c)).map((c) => (
                            <span key={c} className="grid h-5 w-5 place-items-center rounded-md bg-white/[0.06] text-foreground/60" title={CAP_LABEL[c]}>
                              {CAP_ICON[c]}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CapChip({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[10px] transition-colors',
        active ? 'border-violet-400/30 bg-violet-500/12 text-violet-200' : 'border-transparent text-muted-foreground hover:bg-white/[0.05] hover:text-foreground',
      )}
    >
      {icon}{label}
    </button>
  );
}
