'use client';
import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Sparkles, Play, Layers, Wand2, ShieldCheck, Cpu, Zap, Film, Type,
  KeyRound, GitBranch, MousePointer2, Check, Command, Download, Infinity as InfinityIcon,
  Palette, AudioLines, ChevronRight, Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/misc';
import { SceneCanvas } from '@/components/canvas/SceneCanvas';
import { getTemplates } from '@/lib/data/templates';
import { useTheme } from '@/lib/hooks/use-theme';
import { cn } from '@/lib/utils';
import { PrismLogo } from '@/components/brand/PrismLogo';

const PROVIDERS = [
  { name: 'OpenAI', tag: 'GPT-4.1 · o3 · o4-mini' },
  { name: 'Anthropic', tag: 'Claude Opus 4 · Sonnet 4' },
  { name: 'Google', tag: 'Gemini 2.5 Pro / Flash' },
  { name: 'OpenRouter', tag: '300+ routed models' },
  { name: 'DeepSeek', tag: 'Chat · Reasoner' },
  { name: 'Groq', tag: 'Llama · custom base URL' },
  { name: 'Together', tag: 'Open weights' },
  { name: 'Ollama', tag: 'Local & private' },
];

const AGENT_STEPS = [
  { icon: Layers, title: 'Create project', detail: 'Infers canvas, duration, fps, palette and deliverable type from your brief.' },
  { icon: Cpu, title: 'Think & plan', detail: 'Streams reasoning and emits a Zod-validated plan before touching the canvas.' },
  { icon: Wand2, title: 'Select tools', detail: 'Picks from 60+ primitive and composite tools with typed JSON schemas.' },
  { icon: Sparkles, title: 'Build & edit', detail: 'Adds layers, keyframes, easing, effects and layout — in dependency order.' },
  { icon: AudioLines, title: 'Narrate', detail: 'Every action is streamed, inspectable and interruptible — pause or cancel anytime.' },
  { icon: Film, title: 'Preview & ship', detail: 'Renders a live preview, then exports MP4, GIF, PNG, SVG or Lottie.' },
];

const FEATURES = [
  { icon: Film, title: 'Motion engine', body: 'Multi-track timeline, keyframes on any property, spring/bounce/elastic easing, motion paths, particles, mattes and 2.5D transforms — rendered on GPU-accelerated canvas.' },
  { icon: Type, title: 'Type that performs', body: 'Kinetic typography animators, variable fonts, text on path, rich gradients and per-glyph stagger. 19 curated Google fonts, all editable.' },
  { icon: Palette, title: 'Design suite', body: 'Boolean ops, groups, masks, gradients, patterns, blend modes, smart guides, alignment, distribution, brand kits and 580+ editable templates.' },
  { icon: KeyRound, title: 'True BYO-AI', body: 'Plug in your own OpenAI, Anthropic, Google, OpenRouter, DeepSeek or OpenAI-compatible keys. AES-256-GCM encrypted at rest. Never sent to the browser.' },
  { icon: GitBranch, title: 'Agent, not chat', body: 'Real streaming tool-calls against the document. Watch every op, its params and result. Deterministic replay — the same ops rebuild the same scene.' },
  { icon: ShieldCheck, title: 'Production plumbing', body: 'Undo/redo history, IndexedDB autosave, share links, comments, version snapshots, rate limits, audit logs and graceful provider fallbacks.' },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } } };

export function Landing() {
  const reduce = useReducedMotion();
  const { toggle, resolved } = useTheme();
  const templates = React.useMemo(() => getTemplates(), []);
  const hero = React.useMemo(() => templates.find((t) => t.id === 'bold-statement--prism--16x9') ?? templates[0], [templates]);
  const showcase = React.useMemo(() => [
    templates.find((t) => t.id === 'mg-kinetic-swiss--0--16x9'),
    templates.find((t) => t.id === 'dt-promo-slab--0--1x1'),
    templates.find((t) => t.id === 'dt-editorial-quote--1--4x5'),
    templates.find((t) => t.id === 'mg-neon-cyber--0--16x9'),
  ].filter(Boolean) as typeof templates, [templates]);
  const heroProject = React.useMemo(() => (hero ? { ...hero.render(), duration: hero.duration } : null), [hero]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-fade" />
        <div className="absolute -left-40 top-[-10%] h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute right-[-10%] top-[8%] h-[460px] w-[460px] rounded-full bg-cyan-500/15 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[35%] h-[420px] w-[420px] rounded-full bg-magenta-500/15 blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.035] noise" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-7">
            <Link href="/" className="flex items-center gap-2"><PrismLogo className="h-7 w-7" /><span className="text-[15px] font-semibold tracking-[0.14em]">PRISM</span></Link>
            <nav className="hidden items-center gap-5 text-xs text-muted-foreground md:flex">
              <a href="#studio" className="transition-colors hover:text-foreground">Studio</a>
              <a href="#agent" className="transition-colors hover:text-foreground">AI agent</a>
              <a href="#templates" className="transition-colors hover:text-foreground">Templates</a>
              <a href="#byo-ai" className="transition-colors hover:text-foreground">BYO-AI</a>
              <Link href="/settings" className="transition-colors hover:text-foreground">Settings</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" title={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}>
              {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
            </Button>
            <Link href="/dashboard"><Button variant="ghost" size="sm" className="hidden sm:inline-flex">Dashboard</Button></Link>
            <Link href="/editor"><Button variant="prism" size="sm" className="gap-1.5">Open Studio <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative mx-auto max-w-7xl px-5 pb-10 pt-16 md:pt-24">
          <motion.div variants={container} initial={reduce ? undefined : 'hidden'} animate="show" className="mx-auto max-w-3xl text-center">
            <motion.div variants={item} className="mb-5 flex justify-center">
              <Badge variant="outline" className="gap-2 border-violet-500/30 bg-violet-500/[0.07] px-3 py-1 text-[11px] text-violet-300">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" /></span>
                Real agents · real tool calls · your own API keys
              </Badge>
            </motion.div>
            <motion.h1 variants={item} className="text-balance font-semibold tracking-[-0.045em] text-[2.6rem] leading-[1.02] sm:text-6xl md:text-[4.6rem]">
              Design, animate,<br /><span className="prism-text">then delegate.</span>
            </motion.h1>
            <motion.p variants={item} className="mx-auto mt-5 max-w-xl text-balance text-[15px] leading-relaxed text-muted-foreground sm:text-base">
              Prism is a professional motion-graphics editor, a full design suite, and an autonomous AI agent that builds real scenes on your canvas — with your provider, your model, your key.
            </motion.p>
            <motion.div variants={item} className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/editor"><Button variant="prism" size="lg" className="gap-2">Start creating <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/editor?tour=1"><Button variant="outline" size="lg" className="gap-2"><Play className="h-3.5 w-3.5" /> Watch the agent build</Button></Link>
            </motion.div>
            <motion.div variants={item} className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" /> No account required</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" /> Keys stay server-side</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" /> 60fps canvas</span>
            </motion.div>
          </motion.div>

          {/* App mock */}
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 30, scale: 0.985 }}
            animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto mt-14 max-w-6xl"
          >
            <div className="absolute -inset-x-6 -top-6 bottom-0 -z-10 rounded-[36px] bg-[linear-gradient(120deg,rgba(139,92,246,.35),rgba(34,211,238,.18),rgba(232,121,249,.3))] blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-panel shadow-float">
              <div className="flex h-9 items-center gap-2 border-b border-border/70 bg-panel-2/80 px-3">
                <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" /></div>
                <div className="mx-auto flex items-center gap-1.5 rounded-md border border-border/60 bg-background/50 px-3 py-0.5 text-[10px] text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-violet-400" /> prism.studio/editor — Aurora launch teaser
                </div>
                <Badge variant="success" className="hidden text-[9px] sm:inline-flex">autosaved</Badge>
              </div>
              <div className="grid grid-cols-[38px_168px_1fr_210px] grid-rows-[1fr_104px] text-[10px] max-md:grid-cols-[38px_1fr_190px]">
                {/* rail */}
                <div className="row-span-2 flex flex-col items-center gap-2 border-r border-border/60 py-3">
                  {[MousePointer2, Layers, Type, Sparkles, Wand2].map((Icon, i) => (
                    <div key={i} className={cn('flex h-7 w-7 items-center justify-center rounded-md', i === 0 ? 'bg-violet-500/15 text-violet-400' : 'text-muted-foreground/70')}><Icon className="h-3.5 w-3.5" /></div>
                  ))}
                </div>
                {/* layers */}
                <div className="hidden border-r border-border/60 p-2.5 md:block">
                  <p className="panel-title mb-2">Layers</p>
                  {['Headline', 'Accent bar', 'Gradient orb', 'Kicker', 'Particles'].map((n, i) => (
                    <div key={n} className={cn('mb-1 flex items-center gap-1.5 rounded px-1.5 py-1', i === 0 && 'bg-violet-500/10 text-violet-300')}>
                      <span className={cn('h-2 w-2 rounded-sm', ['bg-fuchsia-400', 'bg-cyan-400', 'bg-violet-500', 'bg-amber-400', 'bg-emerald-400'][i])} />
                      <span className="truncate text-muted-foreground">{n}</span>
                    </div>
                  ))}
                  <p className="panel-title mb-1.5 mt-3">Assets</p>
                  <div className="grid grid-cols-3 gap-1">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-square rounded bg-[linear-gradient(135deg,rgba(139,92,246,.35),rgba(34,211,238,.2))]" />)}
                  </div>
                </div>
                {/* canvas */}
                <div className="relative overflow-hidden bg-[#0a0a12]">
                  <div className="absolute inset-0 checker opacity-20" />
                  <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
                    {heroProject && <div className="aspect-video w-full max-w-[560px] overflow-hidden rounded-md ring-1 ring-white/10"><SceneCanvas project={heroProject} playing /></div>}
                  </div>
                  <div className="absolute bottom-2 left-2 rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[9px] text-white/60">1920 × 1080 · 30fps</div>
                </div>
                {/* ai panel */}
                <div className="row-span-2 border-l border-border/60 bg-panel-2/60 p-2.5">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                    <span className="font-medium">Agent</span>
                    <span className="ml-auto rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-400">running</span>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/50 p-2">
                    <p className="text-[10px] leading-relaxed text-muted-foreground">“A launch teaser for Aurora — bold type, violet–cyan gradient, kinetic headline, 6 seconds.”</p>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {[
                      ['create_project', '16:9 · 6s · 30fps'],
                      ['generate_palette', '#8b5cf6 → #22d3ee'],
                      ['add_text', 'headline · Sora 118'],
                      ['add_keyframe', 'opacity · easeOut'],
                      ['add_particles', '90 · screen'],
                      ['render_preview', 'ready ✓'],
                    ].map(([tool, detail], i) => (
                      <div key={tool} className="flex items-start gap-1.5 rounded-md border border-border/50 bg-background/40 px-1.5 py-1">
                        <Check className={cn('mt-0.5 h-2.5 w-2.5 shrink-0', i === 5 ? 'text-emerald-400' : 'text-violet-400')} />
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[9px] text-foreground/90">{tool}</p>
                          <p className="truncate text-[8.5px] text-muted-foreground">{detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full w-[86%] rounded-full bg-[linear-gradient(90deg,#8b5cf6,#22d3ee,#e879f9)]" /></div>
                  <p className="mt-1 text-[8.5px] text-muted-foreground">Working on scene 3 of 3 — adding grain…</p>
                </div>
                {/* timeline */}
                <div className="col-span-3 border-t border-border/60 px-2.5 py-2 max-md:col-span-2">
                  <div className="mb-1 flex items-center gap-2 text-[9px] text-muted-foreground"><Play className="h-2.5 w-2.5" /><span className="tabular">00:02:12</span><span>/</span><span className="tabular">00:06:00</span></div>
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="mb-1 flex items-center gap-2">
                      <span className="w-[74px] truncate text-[8.5px] text-muted-foreground">{['Headline', 'Kicker', 'Orb', 'Particles'][row]}</span>
                      <div className="relative h-3 flex-1 rounded bg-muted/50">
                        <div className="absolute inset-y-0 left-[4%] rounded bg-violet-500/25" style={{ width: `${70 + row * 8}%` }} />
                        <span className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-fuchsia-400" style={{ left: `${12 + row * 16}%` }} />
                        <span className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan-400" style={{ left: `${48 + row * 10}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="absolute" />
                </div>
              </div>
            </div>
          </motion.div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Star className="h-3 w-3 text-amber-400" /> Built for editors who ship</span>
            <span className="inline-flex items-center gap-1.5"><Command className="h-3 w-3" /> Command palette <Kbd>⌘K</Kbd></span>
            <span className="inline-flex items-center gap-1.5"><Download className="h-3 w-3" /> MP4 · GIF · PNG · SVG · Lottie</span>
            <span className="inline-flex items-center gap-1.5"><InfinityIcon className="h-3 w-3" /> Unlimited local projects</span>
          </div>
        </section>

        {/* PROVIDERS */}
        <section id="byo-ai" className="mx-auto max-w-7xl px-5 py-16">
          <div className="rounded-2xl border border-border/70 bg-panel/50 p-6 backdrop-blur-sm">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="panel-title mb-2">Bring your own AI</p>
                <h2 className="text-xl font-semibold tracking-tight">Your key. Your model. Your bill — and no markup.</h2>
                <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted-foreground">Every agent call is a real provider call through the Vercel AI SDK. Keys are encrypted with AES-256-GCM and never leave the server.</p>
              </div>
              <Link href="/settings"><Button variant="outline" size="sm" className="gap-1.5">Configure providers <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROVIDERS.map((p) => (
                <div key={p.name} className="group rounded-xl border border-border/60 bg-background/40 p-3 transition-colors hover:border-violet-500/40 hover:bg-violet-500/[0.04]">
                  <div className="flex items-center gap-2"><ProviderMark name={p.name} /><span className="text-xs font-medium">{p.name}</span><ChevronRight className="ml-auto h-3 w-3 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5" /></div>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">{p.tag}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AGENT */}
        <section id="agent" className="mx-auto max-w-7xl px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-3 text-[10px]">Agent architecture</Badge>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Six steps between a sentence and a finished scene.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">The agent isn’t a chat sidebar bolted onto a canvas. It runs a plan → tool → observe loop against the same document the editor uses, then hands you something real to refine.</p>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {AGENT_STEPS.map((s, i) => (
              <motion.div key={s.title} initial={reduce ? undefined : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * 0.05, duration: 0.5 }} className="group relative overflow-hidden rounded-xl border border-border/70 bg-card/60 p-4 transition-colors hover:border-violet-500/30">
                <div className="absolute right-3 top-3 font-mono text-[10px] text-muted-foreground/40">0{i + 1}</div>
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/12 text-violet-400"><s.icon className="h-4 w-4" /></div>
                <h3 className="text-sm font-medium">{s.title}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.detail}</p>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 overflow-hidden rounded-2xl border border-border/70">
            <div className="flex items-center gap-2 border-b border-border/70 bg-panel-2/60 px-4 py-2"><span className="flex gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400/80" /><span className="h-2 w-2 rounded-full bg-violet-400/80" /><span className="h-2 w-2 rounded-full bg-cyan-400/80" /></span><span className="panel-title">live tool stream</span><Badge variant="success" className="ml-auto text-[9px]">streaming</Badge></div>
            <pre className="overflow-x-auto bg-[#08080d] p-4 font-mono text-[10.5px] leading-relaxed text-zinc-400"><code>{`▸ step 1/9  thinking        "Poster brief → 1080×1350, editorial palette, one hero headline."
▸ step 2/9  tool:create_project   { width: 1080, height: 1350, fps: 30, duration: 6 }
✔ result                     project pa_7f2 · 0 layers · bg #0b0b12
▸ step 3/9  tool:generate_palette { mood: "editorial", anchor: "#c8462f" }
✔ result                     ["#c8462f","#f5f1e8","#2f4538","#111111"]
▸ step 4/9  tool:add_text         { content: "A NEW SPECIES", font: "Playfair Display", size: 118 }
✔ result                     layer ly_91c · w 812 h 260
▸ step 5/9  tool:add_keyframe     { layerId: "ly_91c", property: "opacity", time: 0.4, value: 1 }
✔ result                     keyframe kf_2a1 · easeOut · 0.9s
▸ step 6/9  narrating        "Working on scene 1 of 1 — animating the headline…"
▸ step 7/9  tool:add_effect       { layerId: "ly_44e", type: "grain", amount: 22 }
✔ result                     effect fx_8b2
▸ step 8/9  tool:render_preview   { time: 1.2 }
✔ result                     preview ready · 1920×1080 · 1.4 MB estimate
▸ step 9/9  finish           "Poster is on the canvas. Want the reel version next?"`}</code></pre>
          </div>
        </section>

        {/* FEATURES */}
        <section id="studio" className="mx-auto max-w-7xl px-5 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="secondary" className="mb-3 text-[10px]">The studio</Badge>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">A serious editor underneath the magic.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Every AI action lands in a document you can scrub, keyframe, restyle and export. No dead-end generations.</p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} initial={reduce ? undefined : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: (i % 3) * 0.05, duration: 0.5 }} className="rounded-xl border border-border/70 bg-card/50 p-5">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[linear-gradient(135deg,rgba(139,92,246,.2),rgba(34,211,238,.12))] text-violet-300"><f.icon className="h-4 w-4" /></div>
                <h3 className="text-sm font-medium">{f.title}</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* TEMPLATES */}
        <section id="templates" className="mx-auto max-w-7xl px-5 py-16">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Badge variant="secondary" className="mb-3 text-[10px]">Templates</Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Start from {templates.length} editable scenes.</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Design families, colourways and aspect ratios — including 14 long-form motion styles cut between 18 and 30 seconds. Every template is a real, keyframed layer tree; nothing is flattened.</p>
            </div>
            <Link href="/editor?panel=templates"><Button variant="outline" size="sm" className="gap-1.5">Browse all <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {showcase.map((t, i) => {
              const p = t.render();
              return (
                <motion.div key={t.id} initial={reduce ? undefined : { opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="group overflow-hidden rounded-xl border border-border/70 bg-card/60">
                  <div className="aspect-[4/5] w-full overflow-hidden bg-black/40"><SceneCanvas project={{ ...p, duration: t.duration }} playing={i === 0 && t.duration >= 12} /></div>
                  <div className="flex items-center justify-between px-3 py-2"><span className="truncate text-[11px] text-muted-foreground">{t.name}</span><span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">{t.aspect}</span></div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* KEYBOARD / CRAFT */}
        <section className="mx-auto max-w-7xl px-5 py-16">
          <div className="grid gap-4 rounded-2xl border border-border/70 bg-[linear-gradient(140deg,rgba(139,92,246,.08),rgba(34,211,238,.04),rgba(232,121,249,.07))] p-6 md:grid-cols-2 md:p-10">
            <div>
              <Badge variant="secondary" className="mb-3 text-[10px]">Craft</Badge>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Muscle memory included.</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Figma and After Effects shortcuts, a command palette for everything, and buttery 60fps interaction — because an agent is only useful if the manual path is just as fast.</p>
              <div className="mt-6 grid grid-cols-2 gap-2 text-[11px]">
                {[
                  ['Undo / redo', ['⌘', 'Z']], ['Command palette', ['⌘', 'K']], ['Duplicate', ['⌘', 'D']], ['Group', ['⌘', 'G']],
                  ['Play / pause', ['Space']], ['Export', ['⌘', '⇧', 'E']], ['Zoom to fit', ['⇧', '1']], ['Pan', ['H']],
                ].map(([label, keys]) => (
                  <div key={label as string} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-2.5 py-1.5">
                    <span className="text-muted-foreground">{label as string}</span>
                    <span className="flex gap-1">{(keys as string[]).map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-center gap-3">
              {[
                { icon: Zap, title: 'Live preview while you scrub', body: 'The same renderer powers the canvas, the preview modal and the exporters. What you see is what ships.' },
                { icon: ShieldCheck, title: 'Keys never touch the client', body: 'Provider calls run in server routes. The client only ever sees a masked fingerprint like sk-…a91f.' },
                { icon: GitBranch, title: 'Replayable agent runs', body: 'Every tool call, op and result is logged with params, latency and token cost — re-openable from Settings.' },
              ].map((x) => (
                <div key={x.title} className="flex gap-3 rounded-xl border border-border/70 bg-background/40 p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 text-violet-400"><x.icon className="h-4 w-4" /></div>
                  <div><p className="text-xs font-medium">{x.title}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{x.body}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-5 pb-24 pt-8">
          <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/70 p-10 text-center md:p-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,.22),transparent_65%)]" />
            <h2 className="relative text-balance text-3xl font-semibold tracking-tight sm:text-5xl">Your next title sequence<br className="hidden sm:block" /> starts with a sentence.</h2>
            <p className="relative mx-auto mt-4 max-w-lg text-sm text-muted-foreground">Open the studio, drop in a key, and describe what you want. Prism handles the rest — and leaves everything editable.</p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/editor"><Button variant="prism" size="lg" className="gap-2">Open the studio <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/settings"><Button variant="outline" size="lg" className="gap-2"><KeyRound className="h-4 w-4" /> Connect a provider</Button></Link>
            </div>
            <p className="relative mt-4 text-[11px] text-muted-foreground">Free and local-first. Your projects live in your browser.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5"><PrismLogo className="h-6 w-6" /><div><p className="text-xs font-semibold tracking-[0.18em]">PRISM</p><p className="text-[10px] text-muted-foreground">Motion & design studio</p></div></div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-muted-foreground">
            <Link href="/editor" className="hover:text-foreground">Studio</Link>
            <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
            <Link href="/settings" className="hover:text-foreground">Settings</Link>
            <a href="#agent" className="hover:text-foreground">Agent</a>
            <a href="#byo-ai" className="hover:text-foreground">BYO-AI</a>
          </div>
          <p className="text-[10px] text-muted-foreground/70">© {new Date().getFullYear()} Prism Studio · Built with Next.js & the Vercel AI SDK</p>
        </div>
      </footer>
    </div>
  );
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}
function MoonIcon() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>;
}

const MARK_COLORS: Record<string, string> = {
  OpenAI: 'from-emerald-400 to-teal-500', Anthropic: 'from-orange-400 to-amber-500', Google: 'from-blue-400 to-cyan-400',
  OpenRouter: 'from-violet-400 to-fuchsia-500', DeepSeek: 'from-indigo-400 to-blue-500', Groq: 'from-rose-400 to-orange-400',
  Together: 'from-sky-400 to-indigo-400', Ollama: 'from-zinc-300 to-zinc-500',
};
function ProviderMark({ name }: { name: string }) {
  return <span className={cn('flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br text-[8px] font-bold text-black/80', MARK_COLORS[name] ?? 'from-violet-400 to-cyan-400')}>{name.slice(0, 1)}</span>;
}
