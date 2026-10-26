'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown, CircleDot, Cpu, Eraser, Loader2, Pause, Play, Plus, Send, Settings2, Sparkles, TriangleAlert, Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAgent } from '@/lib/store/agent';
import { useEditor } from '@/lib/store/editor';
import { useAgentRun, loadTarget, saveTarget, type AITarget } from '@/lib/hooks/use-agent-run';
import { useProviders } from '@/lib/hooks/use-ai';
import { PrismLogo } from '@/components/brand/PrismLogo';
import { ProviderPicker } from '@/components/ai/ProviderPicker';
import { Composer } from '@/components/ai/Composer';
import { ErrorCard, PlanCard, ReasoningPanel, RunSummary, ToolLog } from '@/components/ai/RunPanels';
import { Markdown } from '@/components/ai/Markdown';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PrismMark } from '@/components/editor/AIPanelMark';

const STATUS_META: Record<string, { label: string; className: string; dot: string }> = {
  idle: { label: 'Ready', className: 'text-muted-foreground bg-white/[0.04]', dot: 'bg-muted-foreground/60' },
  preparing: { label: 'Preparing', className: 'text-cyan-200 bg-cyan-500/10', dot: 'bg-cyan-400' },
  thinking: { label: 'Thinking', className: 'text-violet-200 bg-violet-500/10', dot: 'bg-violet-400' },
  planning: { label: 'Planning', className: 'text-violet-200 bg-violet-500/10', dot: 'bg-violet-400' },
  building: { label: 'Building', className: 'text-cyan-200 bg-cyan-500/10', dot: 'bg-cyan-400' },
  paused: { label: 'Paused', className: 'text-amber-200 bg-amber-500/10', dot: 'bg-amber-400' },
  done: { label: 'Done', className: 'text-emerald-200 bg-emerald-500/10', dot: 'bg-emerald-400' },
  error: { label: 'Error', className: 'text-rose-200 bg-rose-500/10', dot: 'bg-rose-400' },
  cancelled: { label: 'Stopped', className: 'text-muted-foreground bg-white/[0.04]', dot: 'bg-muted-foreground' },
};

export function AIPanel() {
  const { data, refresh: refreshProviders } = useProviders();
  const [target, setTarget] = useState<AITarget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedMeta, setExpandedMeta] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const status = useAgent((s) => s.status);
  const progress = useAgent((s) => s.progress);
  const messages = useAgent((s) => s.messages);
  const narration = useAgent((s) => s.narration);
  const reasoning = useAgent((s) => s.reasoning);
  const plan = useAgent((s) => s.plan);
  const toolCalls = useAgent((s) => s.toolCalls);
  const summary = useAgent((s) => s.summary);
  const previewReady = useAgent((s) => s.previewReady);
  const tokensIn = useAgent((s) => s.tokensIn);
  const tokensOut = useAgent((s) => s.tokensOut);
  const cost = useAgent((s) => s.cost);
  const { send, stop, answer, running } = useAgentRun();

  useEffect(() => { useAgent.getState().hydrate(); }, []);

  useEffect(() => {
    const stored = loadTarget();
    if (stored) { setTarget(stored); return; }
    if (data?.active) {
      const t = { provider: data.active.provider, model: data.active.model };
      setTarget(t);
      saveTarget(t);
    }
  }, [data?.active]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 220;
    if (nearBottom) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, toolCalls.length, narration, plan.length, status]);

  useEffect(() => {
    const onFocus = () => document.getElementById('prism-ai-input')?.focus();
    window.addEventListener('prism:focus-ai', onFocus);
    return () => window.removeEventListener('prism:focus-ai', onFocus);
  }, []);

  const connected = useMemo(() => (data?.providers ?? []).filter((p) => p.connected), [data]);
  const meta = STATUS_META[status] ?? STATUS_META.idle;
  const showLive = status === 'preparing' || status === 'thinking' || status === 'planning' || status === 'building' || status === 'paused' || running;
  const activeName = data?.catalog.find((p) => p.id === target?.provider)?.name ?? target?.provider ?? 'No provider';

  const choose = (t: AITarget) => { setTarget(t); saveTarget(t); toast.success(`${t.provider} · ${t.model}`); };

  const handleSend = (prompt: string) => {
    if (!target) { setPickerOpen(true); toast.error('Choose a model first.'); return; }
    void send(prompt, target);
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border/70 bg-panel/70 backdrop-blur-xl">
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border/70 px-2.5">
        <div className="flex items-center gap-1.5">
          <PrismLogo className="h-4 w-4" />
          <span className="text-[11px] font-semibold tracking-tight">Agent</span>
        </div>
        <span className={cn('ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium', meta.className)}>
          <span className={cn('h-1 w-1 rounded-full', meta.dot, (status === 'thinking' || status === 'building' || status === 'planning') && 'animate-pulse')} />
          {meta.label}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setPickerOpen(true)}
            className="group flex h-6 max-w-[150px] items-center gap-1 rounded-md border border-transparent px-1.5 text-[10px] text-muted-foreground transition-colors hover:border-border hover:bg-white/[0.04] hover:text-foreground"
            title="Choose provider and model"
          >
            <CircleDot className="h-2.5 w-2.5 text-emerald-400/80" />
            <span className="truncate">{target?.model ?? 'Select model'}</span>
            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
          </button>
          <button onClick={() => { useAgent.getState().clearConversation(); toast.success('Conversation cleared'); }} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground" title="Clear conversation">
            <Eraser className="h-3 w-3" />
          </button>
          <a href="/settings/ai" target="_blank" rel="noreferrer" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground" title="AI settings">
            <Settings2 className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-2.5">
        {messages.length === 0 && !showLive && (
          <div className="mb-3">
            <div className="relative mb-3 overflow-hidden rounded-2xl border border-violet-400/20 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(124,58,237,.22),transparent_55%),radial-gradient(120%_120%_at_100%_100%,rgba(6,182,212,.14),transparent_60%)] p-3">
              <PrismMark className="absolute -right-6 -top-6 h-24 w-24 opacity-[0.07]" />
              <div className="relative">
                <p className="prism-text text-[13px] font-semibold tracking-tight">Build it with PRISM</p>
                <p className="mt-1 max-w-[250px] text-[10.5px] leading-relaxed text-muted-foreground">
                  A real agent with {40}+ tools. It plans, edits layers, sets keyframes and exports — live.
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {['Editable vectors', 'Real keyframes', 'Provider-native'].map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-foreground/70">{t}</span>
                  ))}
                </div>
                {!target && (
                  <Button onClick={() => setPickerOpen(true)} variant="prism" size="xs" className="mt-2 h-6">
                    <Plus className="h-3 w-3" /> Connect a model
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'relative max-w-[94%] rounded-xl px-2.5 py-2 text-[12px] shadow-sm',
                m.role === 'user'
                  ? 'rounded-br-sm border border-violet-400/20 bg-violet-500/[0.12] text-foreground'
                  : 'w-full rounded-bl-sm border border-border/60 bg-white/[0.025]',
              )}>
                {m.attachments?.length ? (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {m.attachments.slice(0, 4).map((a) => (
                      a.type.startsWith('image/') && (a.thumb || a.dataUrl)
                        ? <img key={a.id} src={a.thumb || a.dataUrl} alt={a.name} className="h-9 w-9 rounded-md border border-white/10 object-cover" />
                        : <span key={a.id} className="rounded-md border border-white/10 bg-black/30 px-1.5 py-0.5 text-[9px] text-muted-foreground">{a.name}</span>
                    ))}
                  </div>
                ) : null}
                {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>}
                {m.role === 'assistant' && (m.provider || m.model) && (
                  <p className="mt-1.5 font-mono text-[8.5px] uppercase tracking-wide text-muted-foreground/50">{m.provider} · {m.model}</p>
                )}
              </div>
            </div>
          ))}

          {showLive && (
            <div className="space-y-2">
              <PlanCard />
              {narration && status !== 'thinking' && (
                <div className="rounded-xl border border-border/60 bg-white/[0.025] px-2.5 py-2">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Wand2 className="h-3 w-3 text-violet-300" />
                    <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground">Live narration</span>
                    {running && <Loader2 className="ml-auto h-2.5 w-2.5 animate-spin text-violet-300" />}
                  </div>
                  <Markdown className="text-[11.5px] text-foreground/70">{narration.split('\n').slice(-8).join('\n')}</Markdown>
                </div>
              )}
              <ReasoningPanel />
              {toolCalls.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-black/15 p-1.5">
                  <div className="mb-1 flex items-center justify-between px-0.5">
                    <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground">Tool log · {toolCalls.filter((t) => t.status === 'success').length}/{toolCalls.length}</span>
                    {running && <span className="text-[9px] text-violet-300">{Math.round(progress)}%</span>}
                  </div>
                  <ToolLog compact />
                </div>
              )}
              {running && (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-black/20 px-2 py-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
                  </span>
                  <span className="text-[10px] text-muted-foreground">{status === 'thinking' ? 'Model is reasoning…' : status === 'planning' ? 'Planning the build…' : 'Applying changes to the canvas…'}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="ghost" size="xs" onClick={stop} className="h-5 px-1.5 text-[9.5px]">Stop</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!showLive && <RunSummary />}
          <ErrorCard />

          {!showLive && previewReady && (
            <div className="rounded-xl border border-border/60 bg-white/[0.025] p-2.5">
              <div className="flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500/25 to-cyan-500/15 ring-1 ring-violet-400/25">
                  <Play className="h-3 w-3 text-violet-200" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium">Preview ready</p>
                  <p className="text-[9.5px] text-muted-foreground">Play, scrub and export the result</p>
                </div>
                <Button variant="soft" size="xs" className="ml-auto h-6" onClick={() => window.dispatchEvent(new CustomEvent('prism:open-preview'))}>Open</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/70 bg-panel/80 px-2.5 pb-2 pt-2">
        <div className={cn('mb-1.5 flex items-center justify-between px-0.5 text-[9px] text-muted-foreground/70', !expandedMeta && 'hidden')}>
          <span className="truncate">{activeName}</span>
          <span className="font-mono">{tokensIn + tokensOut} tok · ${cost.toFixed(cost < 0.01 ? 4 : 3)}</span>
        </div>
        <div id="prism-ai-composer">
          <Composer onSend={handleSend} onStop={stop} running={running} onAnswer={answer} />
        </div>
        <div className="mt-1 flex items-center justify-between px-0.5">
          <button onClick={() => setExpandedMeta((v) => !v)} className="flex items-center gap-1 text-[9px] text-muted-foreground/60 transition-colors hover:text-foreground">
            <Cpu className="h-2.5 w-2.5" /> {target ? `${target.provider} / ${target.model}` : 'no model'} <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', expandedMeta && 'rotate-180')} />
          </button>
          {connected.length === 0 && (
            <span className="flex items-center gap-1 text-[9px] text-amber-300/80"><TriangleAlert className="h-2.5 w-2.5" /> No key connected</span>
          )}
          {status === 'paused' && (
            <button onClick={() => { useAgent.getState().askQuestion(null); useAgent.getState().setPaused(false); void send('Continue from where you stopped. Keep anything already built and finish the remaining steps.', target); }} className="flex items-center gap-1 text-[9.5px] text-amber-200">
              <Pause className="h-2.5 w-2.5" /> Resume
            </button>
          )}
          {status === 'done' && summary && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-300/80"><Sparkles className="h-2.5 w-2.5" /> {summary.tools} tools · {summary.duration.toFixed(1)}s</span>
          )}
        </div>
      </div>

      <ProviderPicker open={pickerOpen} onOpenChange={setPickerOpen} value={target} onChange={choose} />
    </aside>
  );
}
