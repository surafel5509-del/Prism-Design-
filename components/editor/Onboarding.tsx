'use client';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, KeyRound, Layers, Sparkles, Wand2 } from 'lucide-react';
import { useEditor } from '@/lib/store/editor';
import { PrismMark } from '@/components/editor/AIPanelMark';
import { cn } from '@/lib/utils';

const KEY = 'prism:onboarded-v1';

const STEPS = [
  {
    title: 'A studio, not a template box',
    body: 'Every design is real vector layers, gradients, effects and keyframes — fully editable, never a flattened image.',
    bullets: ['Vector + text + image tools', 'Groups, masks and blending', 'Pixel-identical exports'],
    art: 'studio',
  },
  {
    title: 'Design and motion on one canvas',
    body: 'Switch from a static poster to an animated sequence without changing files. Keyframe any property, scrub the timeline, loop it.',
    bullets: ['Multi-track timeline', 'Spring, bounce and bezier easing', 'Particles, text animators, motion paths'],
    art: 'timeline',
  },
  {
    title: 'An agent that actually builds',
    body: 'The Prism Agent plans, writes real layer operations, and streams them into the document. You can intervene at any step.',
    bullets: ['40+ real editing tools', 'Live tool log and reasoning', 'Pause, edit the plan, approve'],
    art: 'agent',
  },
  {
    title: 'Your keys, your models',
    body: 'Bring OpenAI, Anthropic, Google, OpenRouter, Groq, DeepSeek, or any OpenAI-compatible endpoint. Keys are encrypted server-side and never returned to the browser.',
    bullets: ['AES-256-GCM at rest', 'Per-task provider routing', 'Usage and cost tracking'],
    art: 'keys',
  },
] as const;

export function Onboarding() {
  const step = useEditor((s) => s.onboardingStep);
  const setStep = useEditor((s) => s.setOnboardingStep);

  useEffect(() => {
    let done = true;
    try { done = Boolean(localStorage.getItem(KEY)); } catch { /* noop */ }
    if (!done) setStep(0);
  }, [setStep]);

  const close = (finished: boolean) => {
    if (finished) { try { localStorage.setItem(KEY, '1'); } catch { /* noop */ } }
    setStep(null);
  };

  if (step === null) return null;
  const current = STEPS[Math.min(step, STEPS.length - 1)];

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[130] grid place-items-center bg-black/70 px-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="w-full max-w-[620px] overflow-hidden rounded-2xl border border-border bg-popover shadow-[0_50px_140px_-40px_rgba(0,0,0,.95)]"
        >
          <div className="relative overflow-hidden border-b border-border/70 bg-[radial-gradient(120%_140%_at_10%_0%,rgba(124,58,237,.28),transparent_60%),radial-gradient(120%_120%_at_90%_100%,rgba(6,182,212,.16),transparent_60%)] px-5 pb-4 pt-5">
            <PrismMark className="absolute -right-10 -top-12 h-44 w-44 text-white opacity-[0.06]" />
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest text-violet-200">Step {step + 1} / {STEPS.length}</span>
              <span className="text-[9.5px] text-muted-foreground">Prism Studio</span>
              <button onClick={() => close(false)} className="ml-auto text-[10px] text-muted-foreground transition-colors hover:text-foreground">Skip tour</button>
            </div>
            <h2 className="prism-text mt-2 text-[19px] font-semibold tracking-tight">{current.title}</h2>
            <p className="mt-1 max-w-[430px] text-[11.5px] leading-relaxed text-muted-foreground">{current.body}</p>
          </div>

          <div className="grid grid-cols-[1fr_190px] gap-4 p-5">
            <ul className="space-y-2">
              {current.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[11.5px] text-foreground/80">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="h-2.5 w-2.5" /></span>
                  {b}
                </li>
              ))}
              <li className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground">
                {current.art === 'keys' ? <KeyRound className="h-3 w-3 text-violet-300" /> : current.art === 'agent' ? <Sparkles className="h-3 w-3 text-violet-300" /> : current.art === 'timeline' ? <Layers className="h-3 w-3 text-cyan-300" /> : <Wand2 className="h-3 w-3 text-fuchsia-300" />}
                Tip: press <kbd className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[9px]">⌘K</kbd> for anything
              </li>
            </ul>

            <div className="relative overflow-hidden rounded-xl border border-border/70 bg-black/30 p-2">
              <StepArt kind={current.art} />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/70 bg-panel/40 px-5 py-3">
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <button key={i} onClick={() => setStep(i)} aria-label={`Step ${i + 1}`} className={cn('h-1 rounded-full transition-all', i === step ? 'w-6 bg-violet-400' : i < step ? 'w-3 bg-violet-400/40' : 'w-3 bg-white/10')} />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {step > 0 && <button onClick={() => setStep(step - 1)} className="rounded-md px-2 py-1 text-[10.5px] text-muted-foreground transition-colors hover:text-foreground">Back</button>}
              {step < STEPS.length - 1 ? (
                <button onClick={() => setStep(step + 1)} className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(110deg,#7c3aed,#0891b2_52%,#c026d3)] px-3 py-1.5 text-[11.5px] font-medium text-white shadow-[0_6px_24px_-8px_rgba(139,92,246,.9)]">
                  Next <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <button onClick={() => close(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[linear-gradient(110deg,#7c3aed,#0891b2_52%,#c026d3)] px-3 py-1.5 text-[11.5px] font-medium text-white shadow-[0_6px_24px_-8px_rgba(139,92,246,.9)]">
                  Start building <Sparkles className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function StepArt({ kind }: { kind: string }) {
  if (kind === 'studio') {
    return (
      <div className="grid h-full grid-cols-2 gap-1">
        <div className="rounded-md bg-gradient-to-br from-violet-500/70 to-fuchsia-500/40" />
        <div className="rounded-full bg-cyan-400/60" />
        <div className="rounded-md border border-white/20 bg-white/[0.06]" />
        <div className="rounded-md bg-gradient-to-tr from-cyan-400/50 to-violet-500/40" />
      </div>
    );
  }
  if (kind === 'timeline') {
    return (
      <div className="flex h-full flex-col justify-center gap-1.5">
        {[70, 40, 90, 55].map((w, i) => (
          <div key={i} className="h-2 rounded-full bg-white/[0.07]">
            <div className={cn('h-2 rounded-full', i === 0 ? 'bg-violet-400/70' : i === 1 ? 'bg-cyan-400/70' : i === 2 ? 'bg-fuchsia-400/60' : 'bg-emerald-400/50')} style={{ width: `${w}%` }} />
          </div>
        ))}
        <div className="mt-1 flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/20" />)}
        </div>
      </div>
    );
  }
  if (kind === 'agent') {
    return (
      <div className="space-y-1.5">
        {['Plan', 'Build', 'Review'].map((s, i) => (
          <div key={s} className="flex items-center gap-1.5 rounded-md bg-white/[0.05] px-1.5 py-1">
            <span className={cn('grid h-3.5 w-3.5 place-items-center rounded-full text-[7px]', i === 0 ? 'bg-emerald-400/25 text-emerald-300' : i === 1 ? 'bg-violet-400/25 text-violet-200' : 'bg-white/10 text-muted-foreground')}>{i === 0 ? '✓' : i + 1}</span>
            <span className="text-[8.5px] text-foreground/70">{s}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5">
      <KeyRound className="h-6 w-6 text-violet-300" />
      <div className="w-full rounded-md bg-white/[0.06] px-1.5 py-1 font-mono text-[7.5px] tracking-widest text-muted-foreground">••••••••••••</div>
      <span className="text-[7.5px] text-emerald-300/80">AES-256-GCM</span>
    </div>
  );
}
