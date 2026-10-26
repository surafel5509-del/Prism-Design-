'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, Check, ChevronRight, CircleDashed, Clock, Coins, Cpu, Download, Eye, Film, Image as ImageIcon,
  Layers, Loader2, Music, Palette, Search, Shapes, Sparkles, SquareStack, Type, Wand2, X, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgent, type PlanStep, type ToolCallLog } from '@/lib/store/agent';

const TOOL_ICONS: [RegExp, React.ReactNode][] = [
  [/text|copy|caption|typograph/i, <Type key="t" className="h-3 w-3" />],
  [/design|template|motion|scene|animate|keyframe|easing|transition|timing|duration/i, <Wand2 key="w" className="h-3 w-3" />],
  [/shape|layer|group|align|distribute|layout|reorder|parent|mask|boolean/i, <Shapes key="s" className="h-3 w-3" />],
  [/image|icon|stock|asset|generat/i, <ImageIcon key="i" className="h-3 w-3" />],
  [/video|export|render|preview|reframe/i, <Film key="f" className="h-3 w-3" />],
  [/music|audio|voice|speech|sfx/i, <Music key="m" className="h-3 w-3" />],
  [/palette|gradient|style|brand|effect|color/i, <Palette key="p" className="h-3 w-3" />],
  [/search|font|lottie|analyze|extract|vision/i, <Search key="se" className="h-3 w-3" />],
  [/plan|step|project|state|save/i, <SquareStack key="sq" className="h-3 w-3" />],
];

function iconFor(name: string) {
  for (const [re, icon] of TOOL_ICONS) if (re.test(name)) return icon;
  return <Cpu className="h-3 w-3" />;
}

const humanize = (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function ToolLog({ compact = false }: { compact?: boolean }) {
  const toolCalls = useAgent((s) => s.toolCalls);
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!toolCalls.length) return null;

  return (
    <div className="space-y-0.5">
      <AnimatePresence initial={false}>
        {toolCalls.map((call) => (
          <motion.div
            key={call.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'group rounded-lg border border-transparent px-1.5 py-1 transition-colors hover:border-border/60 hover:bg-white/[0.025]',
              call.status === 'failed' && 'bg-rose-500/[0.06]',
            )}
          >
            <button onClick={() => setExpanded(expanded === call.id ? null : call.id)} className="flex w-full items-center gap-1.5 text-left">
              <StatusIcon status={call.status} />
              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md', statusTint(call.status))}>{iconFor(call.name)}</span>
              <span className={cn('min-w-0 flex-1 truncate text-[11px]', call.status === 'success' ? 'text-foreground/75' : 'text-foreground/90')}>
                {call.summary ?? humanize(call.name)}
              </span>
              {call.endedAt && <span className="shrink-0 font-mono text-[9px] text-muted-foreground/60">{Math.max(0.1, (call.endedAt - call.startedAt) / 1000).toFixed(1)}s</span>}
              <ChevronRight className={cn('h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform', expanded === call.id && 'rotate-90')} />
            </button>
            <AnimatePresence>
              {expanded === call.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-1 space-y-1 rounded-md bg-black/35 p-2">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{call.name}</p>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[9.5px] leading-relaxed text-foreground/60">{JSON.stringify({ args: call.args, error: call.error }, null, 1).slice(0, compact ? 900 : 2400)}</pre>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function statusTint(status: ToolCallLog['status']) {
  switch (status) {
    case 'success': return 'bg-emerald-500/10 text-emerald-300';
    case 'failed': return 'bg-rose-500/12 text-rose-300';
    case 'running': return 'bg-violet-500/15 text-violet-300';
    case 'awaiting_approval': return 'bg-amber-500/12 text-amber-300';
    default: return 'bg-white/[0.05] text-muted-foreground';
  }
}

function StatusIcon({ status }: { status: ToolCallLog['status'] }) {
  if (status === 'running') return <Loader2 className="h-3 w-3 shrink-0 animate-spin text-violet-300" />;
  if (status === 'success') return <Check className="h-3 w-3 shrink-0 text-emerald-400" />;
  if (status === 'failed') return <X className="h-3 w-3 shrink-0 text-rose-400" />;
  if (status === 'awaiting_approval') return <Clock className="h-3 w-3 shrink-0 text-amber-400" />;
  return <CircleDashed className="h-3 w-3 shrink-0 text-muted-foreground" />;
}

export function PlanCard() {
  const plan = useAgent((s) => s.plan);
  const progress = useAgent((s) => s.progress);
  const status = useAgent((s) => s.status);
  if (!plan.length) return null;
  const done = plan.filter((p) => p.status === 'done').length;

  return (
    <div className="overflow-hidden rounded-xl border border-violet-400/20 bg-[linear-gradient(160deg,rgba(124,58,237,.12),rgba(8,145,178,.05))]">
      <div className="flex items-center gap-2 border-b border-violet-400/15 px-2.5 py-1.5">
        <Sparkles className={cn('h-3.5 w-3.5 text-violet-300', (status === 'planning' || status === 'building') && 'animate-pulse')} />
        <span className="text-[10.5px] font-medium tracking-wide text-violet-100">Run plan</span>
        <span className="ml-auto font-mono text-[9.5px] text-violet-200/70">{done}/{plan.length}</span>
      </div>
      <div className="px-2.5 py-2">
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-cyan-400 to-fuchsia-400" animate={{ width: `${Math.max(progress, (done / plan.length) * 100)}%` }} transition={{ duration: 0.4 }} />
        </div>
        <ol className="space-y-1">
          {plan.map((step, i) => (
            <PlanRow key={step.id} step={step} index={i} />
          ))}
        </ol>
      </div>
    </div>
  );
}

function PlanRow({ step, index }: { step: PlanStep; index: number }) {
  return (
    <li className="flex items-start gap-2">
      <span className={cn(
        'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[8.5px] font-semibold',
        step.status === 'done' ? 'bg-emerald-400/20 text-emerald-300'
          : step.status === 'active' ? 'bg-violet-400/25 text-violet-100 ring-1 ring-violet-300/40'
            : step.status === 'skipped' ? 'bg-white/[0.05] text-muted-foreground/50 line-through'
              : 'bg-white/[0.06] text-muted-foreground',
      )}>
        {step.status === 'done' ? <Check className="h-2.5 w-2.5" /> : index + 1}
      </span>
      <div className="min-w-0">
        <p className={cn('text-[11px] leading-tight', step.status === 'active' ? 'font-medium text-foreground' : step.status === 'skipped' ? 'text-muted-foreground/50 line-through' : 'text-foreground/70')}>{step.title}</p>
        {step.detail && <p className="mt-0.5 text-[9.5px] leading-snug text-muted-foreground">{step.detail}</p>}
      </div>
    </li>
  );
}

export function ReasoningPanel() {
  const reasoning = useAgent((s) => s.reasoning);
  const status = useAgent((s) => s.status);
  const [open, setOpen] = useState(false);
  if (!reasoning) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-black/20">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left">
        <Zap className={cn('h-3 w-3 text-amber-300', (status === 'thinking' || status === 'planning') && 'animate-pulse')} />
        <span className="text-[10px] font-medium text-foreground/70">Reasoning</span>
        <span className="ml-auto truncate text-[9.5px] text-muted-foreground">{open ? 'Hide' : `${reasoning.length} chars`}</span>
        <ChevronRight className={cn('h-3 w-3 text-muted-foreground transition-transform', open && 'rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <p className="max-h-56 overflow-y-auto whitespace-pre-wrap border-t border-border/50 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-foreground/55">{reasoning}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RunSummary() {
  const summary = useAgent((s) => s.summary);
  const idle = useAgent((s) => s.status) === 'idle';
  if (!summary || idle) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <Check className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-[10.5px] font-medium text-emerald-200">Run complete</span>
        <span className="ml-auto text-[9.5px] text-emerald-200/60">{summary.duration.toFixed(1)}s</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Stat icon={<Wand2 className="h-3 w-3" />} label="Tools" value={String(summary.tools)} />
        <Stat icon={<Layers className="h-3 w-3" />} label="Layers" value={String(summary.layers)} />
        <Stat icon={<Sparkles className="h-3 w-3" />} label="Keyframes" value={String(summary.keyframes)} />
        <Stat icon={<Cpu className="h-3 w-3" />} label="Tokens" value={fmt(summary.tokensIn + summary.tokensOut)} />
        <Stat icon={<Coins className="h-3 w-3" />} label="Cost" value={`$${summary.cost.toFixed(summary.cost < 0.01 ? 4 : 3)}`} />
        <Stat icon={<Clock className="h-3 w-3" />} label="Duration" value={`${summary.duration.toFixed(0)}s`} />
      </div>
    </motion.div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md bg-black/25 px-1.5 py-1">
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground/70">{icon}{label}</div>
      <p className="mt-0.5 font-mono text-[11px] text-foreground/85">{value}</p>
    </div>
  );
}

export function ErrorCard() {
  const error = useAgent((s) => s.error);
  const status = useAgent((s) => s.status);
  if (!error || status !== 'error') return null;
  const isMissingKey = /provider|key|connect/i.test(error);
  return (
    <div className="rounded-xl border border-rose-400/25 bg-rose-500/[0.07] p-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-rose-200">Run stopped</p>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-rose-200/70">{error}</p>
          {isMissingKey && (
            <a href="/settings/ai" target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-rose-200 underline underline-offset-2">
              Open AI settings <Download className="h-3 w-3 rotate-180" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function PerfHud({ fps, agentStatus }: { fps: number; agentStatus: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
      <span className={cn('h-1.5 w-1.5 rounded-full', fps >= 55 ? 'bg-emerald-400' : fps >= 40 ? 'bg-amber-400' : 'bg-rose-400')} />
      {fps} FPS
      <span className="text-muted-foreground/40">·</span>
      <Eye className="h-2.5 w-2.5" /> agent {agentStatus}
    </div>
  );
}

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
