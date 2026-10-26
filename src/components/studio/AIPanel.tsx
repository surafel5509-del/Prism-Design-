"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles, Brain, Bot, Zap, Send, Square, ImagePlus, X, ChevronDown, Wrench, CheckCircle2,
  Loader2, AlertTriangle, Play, Download, RefreshCw, KeyRound, Eye, Cpu, Mic, Hammer, Info,
} from "lucide-react";
import { useEditor } from "@/lib/store";
import { makeLayer } from "@/lib/layers";
import { buildOfflineScene } from "@/lib/offline-builder";
import { PROVIDERS, curatedModels, getProviderMeta } from "@/lib/providers";
import type { AgentMode, AgentOp, ModelInfo, ProviderId, ProviderStatus, TaskKind } from "@/lib/types";
import { cn, fileToDataUrl } from "@/lib/utils";
import { Badge, Button, Spinner } from "@/components/ui";

interface ToolLogEntry {
  id: string;
  name: string;
  args: unknown;
  status: "running" | "success" | "failed";
  narration?: string;
}

interface RunState {
  id: string;
  source: "agent" | "offline";
  status: "running" | "done" | "error" | "cancelled";
  text: string;
  reasoning: string;
  tools: ToolLogEntry[];
  steps: number;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
  startedAt: number;
  opsApplied: number;
}

const SUGGESTIONS = [
  "Create a neon product launch animation for wireless headphones called PULSE — 6 seconds, dark, cinematic",
  "Design an Instagram flash-sale post for a sneaker store, bold pink/violet, -40% this weekend",
  "Make a minimal logo reveal for a coffee brand called NOVA BREW",
  "Kinetic typography video: 'DREAM BIG. START NOW.' — vertical story format",
  "YouTube thumbnail: 'I Coded For 100 Days' with huge yellow text",
  "Elegant event poster for a jazz night — gold on deep navy",
];

const LS_KEY = "prism:ai-panel";

export default function AIPanel({ onExport }: { onExport: () => void }) {
  const { project, applyOp, setTime, setPlaying, addLayer, setShowAI } = useEditor();
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [placeUploads, setPlaceUploads] = useState(true);
  const [mode, setMode] = useState<AgentMode>("agent");
  const [task, setTask] = useState<TaskKind>("motion");
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<ModelInfo[]>(() => curatedModels("openai"));
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [run, setRun] = useState<RunState | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const [listening, setListening] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const offlineCancel = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // prompt handed over from the dashboard hero
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem("prism:pending-prompt");
      if (pending) { setPrompt(pending); sessionStorage.removeItem("prism:pending-prompt"); }
    } catch { /* noop */ }
  }, []);

  // restore selection
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.provider) setProvider(s.provider);
        if (s.model) setModel(s.model);
        if (s.mode) setMode(s.mode);
        if (s.task) setTask(s.task);
      }
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify({ provider, model, mode, task })); } catch { /* noop */ }
  }, [provider, model, mode, task]);

  const loadStatuses = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/providers");
      const data = await res.json();
      setStatuses(data.providers ?? []);
      const def = (data.providers as ProviderStatus[])?.find((p) => p.isDefault && p.connected) ?? (data.providers as ProviderStatus[])?.find((p) => p.connected);
      if (def) setProvider((cur) => ((data.providers as ProviderStatus[]).find((p) => p.provider === cur)?.connected ? cur : def.provider));
    } catch { /* offline */ }
  }, []);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  const loadModels = useCallback(async (p: ProviderId) => {
    setModels(curatedModels(p));
    try {
      const res = await fetch(`/api/ai/models?provider=${p}`);
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length) setModels(data.models);
    } catch { /* keep curated */ }
  }, []);

  useEffect(() => { loadModels(provider); }, [provider, loadModels]);

  const activeStatus = statuses.find((s) => s.provider === provider);
  const anyConnected = statuses.some((s) => s.connected);
  const selectedModel = useMemo(() => {
    if (model && models.some((m) => m.id === model)) return models.find((m) => m.id === model)!;
    return models[0];
  }, [model, models]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [run?.text, run?.tools.length, run?.status]);

  const addFiles = async (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 10 - attachments.length);
    const urls: string[] = [];
    for (const f of imgs) urls.push(await fileToDataUrl(f));
    setAttachments((a) => [...a, ...urls].slice(0, 10));
  };

  const placeAttachmentsOnCanvas = async () => {
    for (let i = 0; i < attachments.length; i++) {
      const img = new Image();
      img.src = attachments[i];
      await new Promise((r) => (img.onload = r));
      const w = Math.min(img.width || 800, project.width * 0.8);
      const h = (w * (img.height || 600)) / Math.max(1, img.width || 800);
      addLayer(makeLayer({ type: "image", name: `Upload ${i + 1}`, src: attachments[i], x: (project.width - w) / 2 + i * 24, y: (project.height - h) / 2 + i * 24, width: w, height: h, duration: project.duration, cornerRadius: 16 }), i === 0);
    }
  };

  const applyOps = useCallback((ops: AgentOp[]) => { for (const op of ops) applyOp(op); }, [applyOp]);

  const runOffline = async () => {
    offlineCancel.current = false;
    const steps = buildOfflineScene(prompt || "Create a bold motion graphic");
    const id = `offline-${Date.now()}`;
    setRun({ id, source: "offline", status: "running", text: "", reasoning: "", tools: [], steps: 0, startedAt: Date.now(), opsApplied: 0 });
    let ops = 0;
    for (let i = 0; i < steps.length; i++) {
      if (offlineCancel.current) {
        setRun((r) => (r ? { ...r, status: "cancelled" } : r));
        return;
      }
      const step = steps[i];
      const entry: ToolLogEntry = { id: `${id}-${i}`, name: step.toolName, args: { narration: step.narration }, status: "running", narration: step.narration };
      setRun((r) => (r ? { ...r, tools: [...r.tools, entry], steps: i + 1 } : r));
      await new Promise((res) => setTimeout(res, 550));
      applyOps(step.ops);
      ops += step.ops.length;
      setRun((r) => (r ? { ...r, tools: r.tools.map((t) => (t.id === entry.id ? { ...t, status: "success" } : t)), opsApplied: ops } : r));
      await new Promise((res) => setTimeout(res, 250));
    }
    setRun((r) => (r ? { ...r, status: "done", text: "Scene built by the offline template engine (no AI model was called). Connect a provider in Settings → AI Providers for the true Prism Agent." } : r));
    setTime(0);
    setPlaying(true);
  };

  const runAgent = async () => {
    if (!prompt.trim()) return;
    if (!activeStatus?.connected) {
      setRun({
        id: `err-${Date.now()}`, source: "agent", status: "error", text: "", reasoning: "", tools: [], steps: 0, startedAt: Date.now(), opsApplied: 0,
        error: `${getProviderMeta(provider).label} is not connected. Add your API key in Settings → AI Providers — the agent only ever makes real provider calls.`,
      });
      return;
    }
    if (placeUploads && attachments.length) await placeAttachmentsOnCanvas();

    const id = `run-${Date.now()}`;
    const controller = new AbortController();
    abortRef.current = controller;
    setRun({ id, source: "agent", status: "running", text: "", reasoning: "", tools: [], steps: 0, startedAt: Date.now(), opsApplied: 0 });
    setPlaying(false);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          provider,
          model: selectedModel?.id,
          mode,
          task,
          prompt,
          images: attachments,
          project: {
            name: project.name, width: project.width, height: project.height,
            duration: project.duration, background: project.background,
            layers: project.layers.map((l) => ({ id: l.id, type: l.type, name: l.name })),
            brandKit: project.brandKit,
          },
        }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let ops = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === "text-delta") setRun((r) => (r ? { ...r, text: r.text + String(ev.text ?? "") } : r));
          else if (ev.type === "reasoning-delta") setRun((r) => (r ? { ...r, reasoning: r.reasoning + String(ev.text ?? "") } : r));
          else if (ev.type === "tool-call")
            setRun((r) => (r ? { ...r, tools: [...r.tools, { id: String(ev.toolCallId), name: String(ev.toolName), args: ev.args, status: "running" }] } : r));
          else if (ev.type === "tool-result") {
            const result = ev.result as { op?: AgentOp; ops?: AgentOp[] } | undefined;
            const incoming: AgentOp[] = result?.op ? [result.op] : Array.isArray(result?.ops) ? result.ops : [];
            if (incoming.length) { applyOps(incoming); ops += incoming.length; }
            setRun((r) => (r ? { ...r, opsApplied: ops, tools: r.tools.map((t) => (t.id === String(ev.toolCallId) ? { ...t, status: "success" } : t)) } : r));
          } else if (ev.type === "step-finish") setRun((r) => (r ? { ...r, steps: (ev.step as number) ?? r.steps + 1 } : r));
          else if (ev.type === "usage") setRun((r) => (r ? { ...r, usage: ev.usage as RunState["usage"] } : r));
          else if (ev.type === "error") throw new Error(String(ev.error ?? "Agent error"));
        }
      }
      setRun((r) => (r ? { ...r, status: "done" } : r));
      setTime(0);
      setPlaying(true);
    } catch (err) {
      if ((err as Error).name === "AbortError") setRun((r) => (r ? { ...r, status: "cancelled" } : r));
      else setRun((r) => (r ? { ...r, status: "error", error: err instanceof Error ? err.message : "Agent run failed" } : r));
    } finally {
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    offlineCancel.current = true;
  };

  const startVoice = () => {
    const SR = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR() as { lang: string; onresult: ((e: { results: { [k: number]: { [a: number]: { transcript: string } } } }) => void) | null; onend: (() => void) | null; start: () => void };
    rec.lang = "en-US";
    rec.onresult = (e) => setPrompt((p) => `${p} ${e.results[0][0].transcript}`.trim());
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const running = run?.status === "running";
  const progress = run ? (run.status === "done" ? 100 : Math.min(92, 8 + run.tools.length * 7 + run.steps * 4)) : 0;
  const filteredModels = models.filter((m) => m.label.toLowerCase().includes(modelQuery.toLowerCase()) || m.id.toLowerCase().includes(modelQuery.toLowerCase()));

  return (
    <aside className="w-[340px] shrink-0 border-l border-white/[.07] bg-ink-900 flex flex-col min-h-0" aria-label="AI Agent panel">
      {/* header / model picker */}
      <div className="px-3 pt-3 pb-2 border-b border-white/[.06]">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-glow"><Sparkles size={14} className="text-white" /></span>
          <h2 className="font-display font-semibold text-[13px] flex-1">Prism Agent</h2>
          <button onClick={() => setShowAI(false)} className="text-zinc-500 hover:text-white" aria-label="Close AI panel"><X size={15} /></button>
        </div>

        <div className="relative mt-2.5">
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className="w-full flex items-center gap-2 rounded-xl bg-white/[.04] hover:bg-white/[.07] ring-1 ring-white/10 px-2.5 py-2 text-left transition"
            aria-haspopup="listbox" aria-expanded={pickerOpen}
          >
            <span className={cn("h-6 w-6 rounded-md bg-gradient-to-br flex items-center justify-center text-[10px] font-bold text-white shrink-0", getProviderMeta(provider).gradient)}>
              {getProviderMeta(provider).label.slice(0, 1)}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[12px] font-semibold truncate">{selectedModel?.label ?? "Select model"}</span>
              <span className="block text-[10px] text-zinc-500 truncate">{getProviderMeta(provider).label} · {selectedModel?.id}</span>
            </span>
            {activeStatus?.connected ? <Badge tone="green">live</Badge> : <Badge tone="amber">no key</Badge>}
            <ChevronDown size={14} className="text-zinc-500 shrink-0" />
          </button>

          {pickerOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 glass rounded-2xl shadow-pop p-2 max-h-[380px] flex flex-col animate-rise">
              <div className="flex gap-1 flex-wrap pb-2">
                {PROVIDERS.map((p) => {
                  const st = statuses.find((s) => s.provider === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setProvider(p.id); setModel(""); }}
                      className={cn("rounded-full px-2 py-1 text-[10px] font-semibold transition flex items-center gap-1", provider === p.id ? "bg-violet-600 text-white" : "bg-white/[.06] text-zinc-400 hover:text-white")}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", st?.connected ? "bg-emerald-400" : "bg-zinc-600")} />
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <input value={modelQuery} onChange={(e) => setModelQuery(e.target.value)} placeholder="Search models…" className="h-8 rounded-lg bg-white/[.05] border border-white/10 px-2 text-[12px] outline-none" aria-label="Search models" />
              <ul className="overflow-y-auto mt-1.5 space-y-0.5" role="listbox" aria-label="Models">
                {filteredModels.slice(0, 40).map((m) => (
                  <li key={m.id}>
                    <button
                      role="option" aria-selected={selectedModel?.id === m.id}
                      onClick={() => { setModel(m.id); setPickerOpen(false); }}
                      className={cn("w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition", selectedModel?.id === m.id ? "bg-violet-500/25" : "hover:bg-white/[.05]")}
                    >
                      <Cpu size={13} className="text-zinc-500 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[12px] font-medium truncate">{m.label}</span>
                        <span className="block text-[9px] font-mono text-zinc-600 truncate">{m.id}</span>
                      </span>
                      <span className="flex gap-0.5 shrink-0">
                        {m.capabilities.includes("tools") && <Badge tone="violet">tools</Badge>}
                        {m.capabilities.includes("vision") && <Badge tone="cyan">vision</Badge>}
                        {m.capabilities.includes("reasoning") && <Badge>think</Badge>}
                      </span>
                      <span className="text-[9px] text-zinc-600 w-9 text-right shrink-0">{m.contextWindow ?? ""}</span>
                    </button>
                  </li>
                ))}
                {filteredModels.length === 0 && <li className="text-[11px] text-zinc-600 px-2 py-3">No models match.</li>}
              </ul>
              {!activeStatus?.connected && (
                <Link href="/settings" className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2 py-1.5">
                  <KeyRound size={12} /> Connect {getProviderMeta(provider).label} in Settings →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* mode toggles */}
        <div className="grid grid-cols-3 gap-1 mt-2" role="group" aria-label="Agent mode">
          {([["agent", <Bot key="a" size={13} />, "Agent"], ["thinking", <Brain key="t" size={13} />, "Thinking"], ["fast", <Zap key="f" size={13} />, "Fast"]] as const).map(([m, icon, label]) => (
            <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={cn("flex items-center justify-center gap-1 h-7 rounded-lg text-[11px] font-semibold transition", mode === m ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-glow" : "bg-white/[.05] text-zinc-400 hover:text-white")}>
              {icon} {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1 mt-1" role="group" aria-label="Task kind">
          {(["design", "motion", "image", "edit"] as const).map((t) => (
            <button key={t} onClick={() => setTask(t)} aria-pressed={task === t} className={cn("h-6 rounded-md text-[10px] font-semibold capitalize transition", task === t ? "bg-cyan-500/25 text-cyan-200 ring-1 ring-cyan-400/40" : "bg-white/[.04] text-zinc-500 hover:text-zinc-200")}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* run stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-3 py-3">
        {!run && (
          <div>
            {!anyConnected && statuses.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[.08] p-3 mb-3">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-200"><KeyRound size={13} /> Bring your own AI</p>
                <p className="text-[11px] text-amber-200/80 mt-1 leading-relaxed">
                  Prism never fakes AI. Add an OpenAI, Anthropic, Gemini, OpenRouter, DeepSeek (or any OpenAI-compatible) key and the agent will plan, call real tools, and build on your canvas.
                </p>
                <Link href="/settings"><Button size="sm" className="mt-2">Connect a provider →</Button></Link>
              </div>
            )}
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-zinc-500 mb-2">Try asking</p>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setPrompt(s)} className="w-full text-left text-[11.5px] leading-snug rounded-xl bg-white/[.03] hover:bg-violet-500/[.12] ring-1 ring-white/[.07] hover:ring-violet-400/40 px-2.5 py-2 text-zinc-300 transition">
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-white/[.02] ring-1 ring-white/[.06] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300"><Info size={12} className="text-cyan-300" /> How the agent works</p>
              <ol className="text-[11px] text-zinc-500 mt-1.5 space-y-1 list-none">
                <li><span className="text-violet-300 font-mono">1</span> Creates the project &amp; art-directs a palette</li>
                <li><span className="text-violet-300 font-mono">2</span> Plans, then calls canvas tools step by step</li>
                <li><span className="text-violet-300 font-mono">3</span> You watch every tool call — cancel anytime</li>
                <li><span className="text-violet-300 font-mono">4</span> Auto-plays the preview when finished</li>
              </ol>
            </div>
          </div>
        )}

        {run && (
          <div className="animate-rise">
            <div className="flex items-center gap-2">
              {run.status === "running" ? <Spinner className="text-violet-300" /> : run.status === "done" ? <CheckCircle2 size={16} className="text-emerald-400" /> : <AlertTriangle size={16} className="text-amber-300" />}
              <span className="text-[12px] font-semibold">
                {run.status === "running" ? (run.source === "offline" ? "Offline builder working…" : "Agent is building…") : run.status === "done" ? "Build complete" : run.status === "cancelled" ? "Run cancelled" : "Run failed"}
              </span>
              <span className="ml-auto text-[10px] font-mono text-zinc-500">step {run.steps} · {run.opsApplied} ops</span>
              {running && <Button size="sm" variant="danger" onClick={cancel}><Square size={11} /> Stop</Button>}
            </div>
            <div className="h-1.5 rounded-full bg-white/[.07] overflow-hidden mt-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className={cn("h-full bg-gradient-to-r from-violet-500 via-cyan-400 to-fuchsia-500 transition-all duration-500", running && "animate-pulse")} style={{ width: `${progress}%` }} />
            </div>

            {run.reasoning && (
              <div className="mt-3 rounded-xl bg-violet-500/[.06] ring-1 ring-violet-400/20">
                <button onClick={() => setShowReasoning(!showReasoning)} className="w-full flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold text-violet-200" aria-expanded={showReasoning}>
                  <Brain size={12} /> Reasoning {showReasoning ? "▾" : "▸"}
                </button>
                {showReasoning && <p className="px-2.5 pb-2.5 text-[11px] text-violet-200/80 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{run.reasoning}</p>}
              </div>
            )}

            {run.text && <div className="mt-3 text-[12px] leading-relaxed text-zinc-200 whitespace-pre-wrap rounded-xl bg-white/[.03] ring-1 ring-white/[.06] p-2.5">{run.text}{running && <span className="inline-block w-1.5 h-3.5 bg-cyan-300 animate-pulseDot ml-0.5 align-middle" />}</div>}

            {run.tools.length > 0 && (
              <div className="mt-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-zinc-500"><Wrench size={11} /> Toolbelt · {run.tools.length} calls</p>
                <ul className="mt-1.5 space-y-1">
                  {run.tools.map((t) => (
                    <li key={t.id} className="rounded-lg bg-white/[.02] ring-1 ring-white/[.05] px-2 py-1.5">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        {t.status === "running" ? <Loader2 size={11} className="animate-spin text-cyan-300" /> : t.status === "success" ? <CheckCircle2 size={11} className="text-emerald-400" /> : <AlertTriangle size={11} className="text-red-300" />}
                        <span className="font-mono font-semibold text-zinc-200">{t.name}</span>
                        {t.narration && <span className="text-zinc-500 truncate">— {t.narration}</span>}
                      </span>
                      <span className="block font-mono text-[9px] text-zinc-600 truncate mt-0.5" title={JSON.stringify(t.args)}>{JSON.stringify(t.args)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {run.error && (
              <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/[.08] p-2.5 text-[11.5px] text-red-200 leading-relaxed">
                {run.error}
                <div className="mt-2 flex gap-1.5">
                  <Link href="/settings"><Button size="sm" variant="outline">Open AI Providers</Button></Link>
                  <Button size="sm" variant="ghost" onClick={() => setRun(null)}>Dismiss</Button>
                </div>
              </div>
            )}

            {run.status === "done" && (
              <div className="mt-3 rounded-xl bg-emerald-500/[.07] ring-1 ring-emerald-400/25 p-2.5">
                <p className="text-[11px] text-emerald-200">
                  {project.layers.length} layers · {project.layers.reduce((a, l) => a + l.keyframes.length, 0)} keyframes · {project.duration}s
                  {run.usage ? ` · ${run.usage.totalTokens.toLocaleString()} tokens` : ""} · {Math.max(1, Math.round((Date.now() - run.startedAt) / 1000))}s
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Button size="sm" onClick={() => { setTime(0); setPlaying(true); }}><Play size={12} /> Replay</Button>
                  <Button size="sm" variant="outline" onClick={onExport}><Download size={12} /> Export</Button>
                  <Button size="sm" variant="ghost" onClick={() => setRun(null)}><RefreshCw size={12} /> New prompt</Button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">Refine it: type a follow-up like “make the headline bigger and warmer” with task = edit.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-white/[.06] p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
      >
        {attachments.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {attachments.map((src, i) => (
              <span key={i} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Attachment ${i + 1}`} className="h-11 w-11 object-cover rounded-lg ring-1 ring-white/15" />
                <button onClick={() => setAttachments(attachments.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white hidden group-hover:flex items-center justify-center" aria-label={`Remove attachment ${i + 1}`}><X size={10} /></button>
              </span>
            ))}
            <label className="flex items-center gap-1 text-[10px] text-zinc-400 ml-1 cursor-pointer">
              <input type="checkbox" checked={placeUploads} onChange={(e) => setPlaceUploads(e.target.checked)} className="accent-violet-500" />
              Place on canvas
            </label>
            {selectedModel && !selectedModel.capabilities.includes("vision") && (
              <span className="flex items-center gap-1 text-[10px] text-amber-300"><Eye size={11} /> model has no vision tag</span>
            )}
          </div>
        )}

        <div className="rounded-2xl bg-white/[.04] ring-1 ring-white/10 focus-within:ring-violet-400/50 transition">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={(e) => { const f = e.clipboardData.files; if (f.length) addFiles(f); }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runAgent(); }}
            rows={3}
            placeholder={task === "edit" ? "Describe the change… e.g. 'Make it warmer, headline 20% bigger, slower entrance'" : "Describe what to build… e.g. 'Neon product launch for headphones, 6s, cinematic'"}
            className="w-full bg-transparent resize-none outline-none px-3 pt-2.5 text-[13px] placeholder:text-zinc-600 leading-relaxed"
            aria-label="Agent prompt"
          />
          <div className="flex items-center gap-1 px-2 pb-2">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addFiles(e.target.files)} aria-label="Attach images" />
            <button onClick={() => fileRef.current?.click()} className="h-7 w-7 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[.08] flex items-center justify-center" title="Attach images (vision) — or paste / drop" aria-label="Attach images"><ImagePlus size={15} /></button>
            <button onClick={startVoice} className={cn("h-7 w-7 rounded-lg flex items-center justify-center hover:bg-white/[.08]", listening ? "text-red-300 animate-pulse" : "text-zinc-400 hover:text-white")} title="Voice input" aria-label="Voice input"><Mic size={15} /></button>
            <span className="text-[9px] text-zinc-600 font-mono ml-1 hidden xl:block">{selectedModel?.id} · ⌘↵ run</span>
            <span className="ml-auto flex items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={runOffline} disabled={running} title="Deterministic template engine — no AI model is called">
                <Hammer size={12} /> Offline build
              </Button>
              <Button size="sm" onClick={runAgent} disabled={running || !prompt.trim()} className="h-8">
                {running ? <Spinner /> : <Send size={13} />} Run agent
              </Button>
            </span>
          </div>
        </div>
        <p className="text-[9.5px] text-zinc-600 mt-1.5 leading-relaxed">
          “Run agent” calls {getProviderMeta(provider).label} with your key via the Vercel AI SDK — real streaming + tool calls. “Offline build” is a local template engine (not AI).
        </p>
      </div>
    </aside>
  );
}
