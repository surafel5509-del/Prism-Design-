"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, PlugZap, ShieldCheck, Star, Trash2, XCircle, ClipboardPaste, ExternalLink, Gauge } from "lucide-react";
import { PROVIDERS, curatedModels, type ProviderMeta } from "@/lib/providers";
import type { ModelInfo, ProviderStatus } from "@/lib/types";
import { Badge, Button, Field, PrismLogo, SectionTitle, SliderField, Toggle, inputCls } from "@/components/ui";
import { cn } from "@/lib/utils";

interface CardState {
  apiKey: string;
  baseURL: string;
  showKey: boolean;
  testing: boolean;
  saving: boolean;
  testResult: { ok: boolean; message: string } | null;
  models: ModelInfo[];
  preferredModel: string;
}

const PREF_KEY = "prism:ai-panel";
const GEN_KEY = "prism:ai-general";

function ProviderCard({
  meta, status, usage, onChanged,
}: {
  meta: ProviderMeta;
  status?: ProviderStatus;
  usage?: { runs: number; totalTokens: number };
  onChanged: () => void;
}) {
  const [s, setS] = useState<CardState>({
    apiKey: "", baseURL: status?.baseURL ?? meta.defaultBaseURL ?? "", showKey: false,
    testing: false, saving: false, testResult: null, models: curatedModels(meta.id), preferredModel: "",
  });
  const set = (patch: Partial<CardState>) => setS((p) => ({ ...p, ...patch }));

  useEffect(() => { set({ baseURL: status?.baseURL ?? meta.defaultBaseURL ?? "" }); }, [status?.baseURL]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!status?.connected) return;
    fetch(`/api/ai/models?provider=${meta.id}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d.models) && set({ models: d.models }))
      .catch(() => { /* curated remains */ });
    try {
      const pref = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
      if (pref.provider === meta.id && pref.model) set({ preferredModel: pref.model });
    } catch { /* noop */ }
  }, [status?.connected, meta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const test = async () => {
    if (!s.apiKey.trim()) { set({ testResult: { ok: false, message: "Paste your API key first, then test." } }); return; }
    set({ testing: true, testResult: null });
    try {
      const res = await fetch("/api/ai/test-connection", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: meta.id, apiKey: s.apiKey, baseURL: s.baseURL || null }),
      });
      set({ testResult: await res.json() });
    } catch {
      set({ testResult: { ok: false, message: "Network error while testing." } });
    } finally {
      set({ testing: false });
    }
  };

  const save = async (isDefault?: boolean) => {
    set({ saving: true });
    try {
      const res = await fetch("/api/ai/providers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: meta.id, apiKey: s.apiKey || undefined, baseURL: s.baseURL || null, isDefault }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      set({ apiKey: "", testResult: { ok: true, message: "Saved — key encrypted at rest (AES-256-GCM)." } });
      onChanged();
    } catch (err) {
      set({ testResult: { ok: false, message: err instanceof Error ? err.message : "Save failed" } });
    } finally {
      set({ saving: false });
    }
  };

  const remove = async () => {
    set({ saving: true });
    await fetch(`/api/ai/providers?provider=${meta.id}`, { method: "DELETE" });
    set({ saving: false, testResult: null });
    onChanged();
  };

  const chooseModel = (modelId: string) => {
    set({ preferredModel: modelId });
    try {
      const pref = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
      localStorage.setItem(PREF_KEY, JSON.stringify({ ...pref, provider: meta.id, model: modelId }));
    } catch { /* noop */ }
  };

  return (
    <article className="rounded-2xl bg-ink-900 ring-1 ring-white/[.08] overflow-hidden">
      <header className="flex items-center gap-3 p-4 pb-3">
        <span className={cn("h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center font-display font-bold text-white text-sm shrink-0", meta.gradient)}>
          {meta.label.slice(0, 1)}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            {meta.label}
            {status?.isDefault && status.connected && <Badge tone="violet"><Star size={9} /> default</Badge>}
          </h3>
          <p className="text-[11px] text-zinc-500 truncate">{meta.tagline}</p>
        </div>
        {status?.connected ? <Badge tone="green"><CheckCircle2 size={11} /> Connected</Badge> : <Badge>Not connected</Badge>}
      </header>

      <div className="px-4 pb-4 space-y-3">
        {status?.connected && (
          <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 flex-wrap">
            <KeyRound size={12} className="text-emerald-400" />
            <span className="font-mono">{status.maskedKey}</span>
            <span className="text-zinc-600">via {status.source === "env" ? `env ${meta.envVar}` : "saved key"}</span>
            {usage && usage.runs > 0 && <span className="text-zinc-600">· {usage.runs} runs · {usage.totalTokens.toLocaleString()} tokens</span>}
          </p>
        )}

        {meta.needsKey && (
          <Field label={status?.connected ? "Replace API key" : "API key"}>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <input
                  type={s.showKey ? "text" : "password"} value={s.apiKey} autoComplete="off" spellCheck={false}
                  onChange={(e) => set({ apiKey: e.target.value })} placeholder={meta.keyPlaceholder}
                  className={cn(inputCls, "h-9 pr-16 font-mono text-[12px]")} aria-label={`${meta.label} API key`}
                />
                <span className="absolute right-1 top-1/2 -translate-y-1/2 flex">
                  <button className="p-1.5 text-zinc-500 hover:text-white" onClick={async () => { try { set({ apiKey: await navigator.clipboard.readText() }); } catch { /* clipboard denied */ } }} title="Paste from clipboard" aria-label="Paste API key"><ClipboardPaste size={13} /></button>
                  <button className="p-1.5 text-zinc-500 hover:text-white" onClick={() => set({ showKey: !s.showKey })} title={s.showKey ? "Hide key" : "Show key"} aria-label={s.showKey ? "Hide key" : "Show key"}>{s.showKey ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                </span>
              </div>
            </div>
            {meta.docsUrl && (
              <a href={meta.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-cyan-300 hover:text-cyan-200 mt-1">
                Get a key <ExternalLink size={9} />
              </a>
            )}
          </Field>
        )}

        <Field label={meta.baseURLLabel}>
          <input value={s.baseURL} onChange={(e) => set({ baseURL: e.target.value })} placeholder={meta.defaultBaseURL ?? "https://…"} className={cn(inputCls, "h-9 font-mono text-[12px]")} aria-label={`${meta.label} base URL`} />
        </Field>

        {s.testResult && (
          <p className={cn("flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11.5px] leading-relaxed", s.testResult.ok ? "bg-emerald-500/10 text-emerald-200 border border-emerald-500/25" : "bg-red-500/10 text-red-200 border border-red-500/25")} role="status">
            {s.testResult.ok ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <XCircle size={13} className="mt-0.5 shrink-0" />}
            {s.testResult.message}
          </p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {meta.needsKey && (
            <Button size="sm" variant="outline" onClick={test} disabled={s.testing}>
              {s.testing ? <Loader2 size={12} className="animate-spin" /> : <PlugZap size={12} />} Test connection
            </Button>
          )}
          <Button size="sm" onClick={() => save()} disabled={s.saving || (meta.needsKey && !s.apiKey && !status?.connected)}>
            {s.saving ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Save
          </Button>
          {status?.connected && status.source === "saved" && (
            <>
              {!status.isDefault && <Button size="sm" variant="ghost" onClick={() => save(true)} disabled={s.saving}><Star size={12} /> Set default</Button>}
              <Button size="sm" variant="danger" onClick={remove} disabled={s.saving}><Trash2 size={12} /> Remove key</Button>
            </>
          )}
        </div>

        {status?.connected && (
          <Field label="Preferred model (used by the Agent panel)">
            <select value={s.preferredModel} onChange={(e) => chooseModel(e.target.value)} className={cn(inputCls, "h-9 [&>option]:bg-ink-800")} aria-label={`Preferred ${meta.label} model`}>
              <option value="">Provider default ({s.models[0]?.label ?? "—"})</option>
              {s.models.slice(0, 60).map((m) => (
                <option key={m.id} value={m.id}>{m.label}{m.capabilities.length ? ` · ${m.capabilities.join("+")}` : ""}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </article>
  );
}

export default function SettingsPage() {
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [usage, setUsage] = useState<Record<string, { runs: number; totalTokens: number }>>({});
  const [temperature, setTemperature] = useState(0.7);
  const [streaming, setStreaming] = useState(true);
  const [toolCalling, setToolCalling] = useState(true);
  const [customPrompt, setCustomPrompt] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/ai/providers");
    const data = await res.json();
    setStatuses(data.providers ?? []);
    setUsage(data.usageByProvider ?? {});
  }, []);

  useEffect(() => {
    load();
    try {
      const g = JSON.parse(localStorage.getItem(GEN_KEY) ?? "{}");
      if (typeof g.temperature === "number") setTemperature(g.temperature);
      if (typeof g.streaming === "boolean") setStreaming(g.streaming);
      if (typeof g.toolCalling === "boolean") setToolCalling(g.toolCalling);
      if (typeof g.customPrompt === "string") setCustomPrompt(g.customPrompt);
    } catch { /* noop */ }
  }, [load]);

  useEffect(() => {
    try { localStorage.setItem(GEN_KEY, JSON.stringify({ temperature, streaming, toolCalling, customPrompt })); } catch { /* noop */ }
  }, [temperature, streaming, toolCalling, customPrompt]);

  const connectedCount = statuses.filter((s) => s.connected).length;

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="sticky top-0 z-30 glass">
        <div className="max-w-6xl mx-auto flex items-center gap-3 px-4 h-14">
          <Link href="/" className="flex items-center gap-2" aria-label="Back to dashboard"><PrismLogo size={24} /><span className="font-display font-bold tracking-[.18em] text-sm prism-text">PRISM</span></Link>
          <span className="text-zinc-600">/</span>
          <h1 className="font-semibold text-sm">Settings</h1>
          <div className="ml-auto flex items-center gap-2">
            <Badge tone={connectedCount ? "green" : "amber"}>{connectedCount} provider{connectedCount === 1 ? "" : "s"} connected</Badge>
            <Link href="/studio"><Button size="sm"><ArrowLeft size={13} /> Studio</Button></Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-bold">AI Providers <span className="prism-text">— bring your own AI</span></h2>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            Prism&apos;s agent runs on <strong className="text-zinc-200">your</strong> keys via the Vercel AI SDK. Keys are encrypted server-side with
            AES-256-GCM, used only to call the provider you picked, and never returned to the browser (you&apos;ll only ever see a masked preview).
            Environment variables (e.g. <span className="font-mono text-[12px]">OPENAI_API_KEY</span>) also work as a fallback.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {PROVIDERS.map((meta) => (
            <ProviderCard key={meta.id} meta={meta} status={statuses.find((s) => s.provider === meta.id)} usage={usage[meta.id]} onChanged={load} />
          ))}
        </div>

        <section className="rounded-2xl bg-ink-900 ring-1 ring-white/[.08] mt-6 p-5" aria-label="Global AI settings">
          <SectionTitle icon={<Gauge size={12} />}>Global agent settings</SectionTitle>
          <div className="grid md:grid-cols-3 gap-5 px-1">
            <SliderField label="Temperature" value={temperature} min={0} max={1.5} step={0.05} onChange={setTemperature} format={(v) => v.toFixed(2)} />
            <div className="space-y-2.5">
              <span className="flex items-center justify-between text-[12px]"><span>Streaming responses</span><Toggle checked={streaming} onChange={setStreaming} label="Streaming responses" /></span>
              <span className="flex items-center justify-between text-[12px]"><span>Tool calling (agent builds)</span><Toggle checked={toolCalling} onChange={setToolCalling} label="Tool calling" /></span>
              <p className="text-[10px] text-zinc-600 leading-relaxed">With tool calling off, supporting models fall back to structured-JSON plan mode executed by Prism&apos;s deterministic runner.</p>
            </div>
            <Field label="Custom system prompt (advanced)">
              <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} rows={4} placeholder="e.g. Always use Swiss editorial style, avoid purple…" className={cn(inputCls, "h-auto py-2 resize-y text-[12px]")} />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl bg-white/[.02] ring-1 ring-white/[.06] mt-4 p-5 text-[12px] text-zinc-500 leading-relaxed">
          <h3 className="flex items-center gap-1.5 text-zinc-300 font-semibold text-[13px] mb-2"><ShieldCheck size={14} className="text-emerald-400" /> Security model</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Keys are encrypted with AES-256-GCM using <span className="font-mono">PRISM_ENCRYPTION_KEY</span> (set it in your host&apos;s env; a gitignored dev secret is generated locally otherwise).</li>
            <li>All provider calls happen server-side in <span className="font-mono">/api/ai/chat</span> — the browser only receives streamed text, tool calls and results.</li>
            <li>“Test connection” uses the key for a single models-list request and never stores it.</li>
            <li>For multi-user production, point <span className="font-mono">src/lib/db.ts</span> at Postgres (schema in <span className="font-mono">prisma/</span> + <span className="font-mono">supabase/</span>) and scope keys per user.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
