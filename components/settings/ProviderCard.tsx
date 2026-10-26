'use client';
import { useState } from 'react';
import { AlertCircle, Check, ChevronRight, Eye, EyeOff, KeyRound, Loader2, Plug, RefreshCw, Settings2, Star, Trash2, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { connectProvider, removeProvider, setDefaultProvider, testProvider, type CatalogProvider, type ConnectedProvider } from '@/lib/hooks/use-ai';
import type { ModelInfo } from '@/lib/engine/types';

export function ProviderCard({ catalog, connected, isDefault, onChanged }: {
  catalog: CatalogProvider;
  connected?: ConnectedProvider;
  isDefault: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);

  const makeDefault = async () => {
    setBusy(true);
    try {
      await setDefaultProvider(catalog.id, connected?.defaultModel ?? catalog.defaultModel);
      toast.success(`${catalog.name} is now the default provider`);
      await onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not set default'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try { await removeProvider(catalog.id); toast.success(`${catalog.name} disconnected`); setConfirmRemove(false); await onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove provider'); }
    finally { setBusy(false); }
  };

  const live = Boolean(connected?.connected);

  return (
    <>
      <div className={cn('group relative overflow-hidden rounded-2xl border bg-white/[0.015] p-3 transition-all', live ? 'border-border/80 hover:border-violet-400/30' : 'border-border/60 hover:border-border')}>
        <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-[0.18] blur-2xl transition-opacity group-hover:opacity-30" style={{ background: catalog.accent ?? '#8b5cf6' }} />
        <div className="relative flex items-start gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[12px] font-bold text-black/80 shadow-inner" style={{ background: `linear-gradient(145deg, ${catalog.accent ?? '#8b5cf6'}, ${catalog.accent ?? '#8b5cf6'}aa)` }}>
            {catalog.name.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[12px] font-semibold tracking-tight">{catalog.name}</p>
              {isDefault && <Badge variant="prism" className="h-4 px-1 text-[8px]">Default</Badge>}
            </div>
            <p className="truncate text-[9.5px] text-muted-foreground">{catalog.blurb}</p>
          </div>
          <StatusDot connected={connected} />
        </div>

        <div className="relative mt-2 space-y-1 rounded-lg bg-black/20 px-2 py-1.5">
          {live ? (
            <>
              <div className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
                <KeyRound className="h-2.5 w-2.5" />
                <span className="font-mono tracking-tight">{connected?.keyPreview || 'No key required'}</span>
                {connected?.lastChecked && <span className="ml-auto text-[8.5px] text-muted-foreground/60">{new Date(connected.lastChecked).toLocaleDateString()}</span>}
              </div>
              <div className="flex items-center gap-1 text-[9.5px] text-foreground/70">
                <Zap className="h-2.5 w-2.5 text-violet-300" />
                <span className="truncate font-mono">{connected?.defaultModel}</span>
              </div>
              {connected?.message && <p className="truncate text-[8.5px] text-muted-foreground/60">{connected.message}</p>}
            </>
          ) : (
            <p className="text-[9.5px] leading-relaxed text-muted-foreground">
              {connected?.status === 'error' ? <span className="text-rose-300">{connected.message ?? 'Connection failed'}</span> : catalog.requiresKey ? 'Not connected — add an API key to enable.' : 'Local endpoint — no key required.'}
            </p>
          )}
        </div>

        <div className="relative mt-2 flex items-center gap-1">
          <Button size="xs" variant={live ? 'secondary' : 'soft'} className="h-6 flex-1" onClick={() => setOpen(true)}>
            {live ? <Settings2 className="h-2.5 w-2.5" /> : <Plug className="h-2.5 w-2.5" />} {live ? 'Manage' : 'Connect'}
          </Button>
          {live && !isDefault && (
            <Button size="xs" variant="ghost" className="h-6 px-1.5" onClick={makeDefault} disabled={busy} title="Set as default">
              {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Star className="h-2.5 w-2.5" />}
            </Button>
          )}
          {live && (
            <Button size="xs" variant="ghost" className="h-6 px-1.5 text-muted-foreground hover:text-rose-300" onClick={() => setConfirmRemove(true)} title="Remove provider">
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          )}
          <a href={catalog.docs} target="_blank" rel="noreferrer" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground" title="Get an API key">
            <ChevronRight className="h-2.5 w-2.5" />
          </a>
        </div>

        {confirmRemove && (
          <div className="relative mt-1.5 flex items-center gap-1 rounded-md border border-rose-400/25 bg-rose-500/[0.08] px-1.5 py-1">
            <span className="text-[9px] text-rose-200">Remove key?</span>
            <button onClick={remove} disabled={busy} className="ml-auto rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] text-rose-100 hover:bg-rose-500/30">Remove</button>
            <button onClick={() => setConfirmRemove(false)} className="rounded px-1.5 py-0.5 text-[9px] text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        )}
      </div>

      <ConnectDialog open={open} onOpenChange={setOpen} catalog={catalog} connected={connected} onChanged={onChanged} />
    </>
  );
}

function StatusDot({ connected }: { connected?: ConnectedProvider }) {
  if (!connected || connected.status === 'unconfigured') return <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />;
  if (connected.status === 'error') return <span className="mt-0.5 flex items-center gap-1 text-[8.5px] text-rose-300"><AlertCircle className="h-2.5 w-2.5" /> error</span>;
  return <span className="mt-0.5 flex items-center gap-1 text-[8.5px] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.9)]" /> live</span>;
}

function ConnectDialog({ open, onOpenChange, catalog, connected, onChanged }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  catalog: CatalogProvider;
  connected?: ConnectedProvider;
  onChanged: () => Promise<void> | void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(connected?.baseUrl ?? catalog.baseUrl ?? '');
  const [model, setModel] = useState(connected?.defaultModel ?? catalog.defaultModel);
  const [showKey, setShowKey] = useState(false);
  const [asDefault, setAsDefault] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string; latencyMs?: number; modelCount?: number; models?: { id: string; name: string }[] } | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      const result = await testProvider({ provider: catalog.id, apiKey: apiKey || undefined, baseUrl: baseUrl || undefined });
      setTest(result);
      if (result.ok && result.models?.length) {
        if (!result.models.some((m) => m.id === model)) setModel(result.models[0].id);
      }
    } catch (e) {
      setTest({ ok: false, message: e instanceof Error ? e.message : 'Test failed' });
    } finally { setTesting(false); }
  };

  const save = async (skipValidation = false) => {
    if (catalog.requiresKey && !apiKey && !connected?.connected) { toast.error('Paste an API key first.'); return; }
    setSaving(true);
    try {
      await connectProvider({ provider: catalog.id, apiKey: apiKey || undefined, baseUrl: baseUrl || undefined, model, setDefault: asDefault, skipValidation });
      toast.success(`${catalog.name} connected`);
      setApiKey('');
      onOpenChange(false);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not connect');
    } finally { setSaving(false); }
  };

  const modelOptions: ModelInfo[] = catalog.curated ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Connect {catalog.name}</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-xl text-[12px] font-bold text-black/80" style={{ background: `linear-gradient(145deg, ${catalog.accent ?? '#8b5cf6'}, ${catalog.accent ?? '#8b5cf6'}aa)` }}>{catalog.name.slice(0, 1)}</span>
          <div>
            <p className="text-[13px] font-semibold tracking-tight">{catalog.name}</p>
            <p className="text-[9.5px] text-muted-foreground">{catalog.blurb}</p>
          </div>
          <a href={catalog.docs} target="_blank" rel="noreferrer" className="ml-auto text-[10px] text-violet-300 hover:text-violet-200">Get a key →</a>
        </div>

        <div className="space-y-3 p-4">
          {connected?.connected && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.06] px-2 py-1.5">
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-100">Connected as <span className="font-mono">{connected.keyPreview || 'local endpoint'}</span></span>
              <span className="ml-auto text-[9px] text-emerald-200/60">Leave the key blank to keep it</span>
            </div>
          )}

          <Field label="API key" hint={connected?.connected ? 'Replace the stored key (optional)' : `Starts with ${catalog.keyPrefix ?? 'your provider’s format'}`}>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={catalog.requiresKey ? 'sk-…' : 'not required'}
                autoComplete="off"
                spellCheck={false}
                className="h-8 pr-8 font-mono text-[11px]"
              />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground" aria-label={showKey ? 'Hide key' : 'Show key'}>
                {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
          </Field>

          <Field label="Base URL" hint={catalog.id === 'custom' || catalog.id === 'ollama' || catalog.id === 'lmstudio' ? 'Point this at your local or self-hosted OpenAI-compatible server' : 'Override only if you use a proxy or gateway'}>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className="h-8 font-mono text-[11px]" />
          </Field>

          <Field label="Default model" hint="You can switch models per run in the editor">
            <select value={model} onChange={(e) => setModel(e.target.value)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] outline-none focus:border-violet-400/50">
              {modelOptions.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.id}</option>)}
              {test?.models?.length ? test.models.filter((m) => !modelOptions.some((x) => x.id === m.id)).slice(0, 40).map((m) => <option key={m.id} value={m.id}>{m.name}</option>) : null}
              {!modelOptions.some((m) => m.id === model) && !test?.models?.some((m) => m.id === model) && <option value={model}>{model}</option>}
            </select>
          </Field>

          <label className="flex items-center gap-2 text-[10.5px] text-foreground/80">
            <Switch checked={asDefault} onCheckedChange={setAsDefault} /> Make this my default provider
          </label>

          {test && (
            <div className={cn('flex items-start gap-1.5 rounded-lg border px-2 py-1.5 text-[10px]', test.ok ? 'border-emerald-400/25 bg-emerald-500/[0.06] text-emerald-100' : 'border-rose-400/25 bg-rose-500/[0.07] text-rose-100')}>
              {test.ok ? <Check className="mt-0.5 h-3 w-3 shrink-0" /> : <X className="mt-0.5 h-3 w-3 shrink-0" />}
              <span>{test.message}{test.latencyMs ? ` · ${test.latencyMs}ms` : ''}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 border-t border-border/70 bg-panel/40 px-4 py-2.5">
          <Button variant="outline" size="sm" onClick={runTest} disabled={testing || saving}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Test connection
          </Button>
          <button onClick={() => void save(true)} disabled={saving} className="text-[9.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground">Save without testing</button>
          <Button variant="prism" size="sm" className="ml-auto" onClick={() => void save(false)} disabled={saving || testing}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />} Save &amp; connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-1.5">
        <p className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {hint && <p className="truncate text-[9px] text-muted-foreground/60">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
