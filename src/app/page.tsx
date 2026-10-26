"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clapperboard, Copy, FolderOpen, KeyRound, LayoutTemplate, Play, Plus, Search, Settings, Sparkles, Trash2, Wand2 } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";
import { emptyProject } from "@/lib/layers";
import type { ProviderStatus } from "@/lib/types";
import { Badge, Button, PrismLogo, inputCls } from "@/components/ui";
import { cn } from "@/lib/utils";
import { nanoid } from "nanoid";

interface ProjectSummary {
  id: string; name: string; width: number; height: number; duration: number;
  background: string; layerCount: number; updatedAt: string; accent: string; headline: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [query, setQuery] = useState("");
  const [heroPrompt, setHeroPrompt] = useState("");

  const load = async () => {
    try {
      const [pRes, aiRes] = await Promise.all([fetch("/api/projects"), fetch("/api/ai/providers")]);
      const pData = await pRes.json();
      const aiData = await aiRes.json();
      setProjects(pData.projects ?? []);
      setProviders(aiData.providers ?? []);
    } catch { /* offline */ }
  };
  useEffect(() => { load(); }, []);

  const connected = providers.filter((p) => p.connected);
  const filtered = useMemo(() => projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())), [projects, query]);

  const createBlank = async (w: number, h: number, label: string) => {
    const p = emptyProject({ id: nanoid(12), name: `Untitled ${label}`, width: w, height: h });
    try { await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: p }) }); } catch { /* noop */ }
    try { localStorage.setItem(`prism:project:${p.id}`, JSON.stringify(p)); } catch { /* noop */ }
    router.push(`/studio?project=${p.id}`);
  };

  const startFromPrompt = () => {
    try { sessionStorage.setItem("prism:pending-prompt", heroPrompt); } catch { /* noop */ }
    router.push("/studio");
  };

  const duplicate = async (id: string) => {
    const res = await fetch(`/api/projects?id=${id}`);
    const data = await res.json();
    if (!data.project) return;
    const copy = { ...data.project, id: nanoid(12), name: `${data.project.name} copy` };
    await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: copy }) });
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/projects?id=${id}`, { method: "DELETE" });
    try { localStorage.removeItem(`prism:project:${id}`); } catch { /* noop */ }
    load();
  };

  return (
    <div className="min-h-screen bg-ink-950">
      {/* nav */}
      <header className="sticky top-0 z-30 glass">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 h-14">
          <span className="flex items-center gap-2"><PrismLogo size={26} /><span className="font-display font-bold tracking-[.2em] prism-text">PRISM</span></span>
          <nav className="hidden md:flex items-center gap-4 ml-6 text-[13px] text-zinc-400" aria-label="Main">
            <a href="#projects" className="hover:text-white transition">Projects</a>
            <a href="#templates" className="hover:text-white transition">Templates</a>
            <a href="#how" className="hover:text-white transition">How the agent works</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {connected.length > 0 ? <Badge tone="green">{connected.length} AI provider{connected.length > 1 ? "s" : ""} live</Badge> : <Badge tone="amber"><KeyRound size={10} /> No AI key yet</Badge>}
            <Link href="/settings"><Button variant="ghost" size="sm"><Settings size={14} /> AI Providers</Button></Link>
            <Link href="/studio"><Button size="sm">Open Studio <ArrowRight size={13} /></Button></Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-violet-600/25 blur-[110px]" />
          <div className="absolute top-10 right-1/5 h-80 w-80 rounded-full bg-cyan-500/20 blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-[100px]" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 pt-16 pb-10 text-center">
          <Badge tone="violet"><Sparkles size={11} /> Motion graphics × graphic design × true AI agent</Badge>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] mt-5 text-balance">
            Describe it. Watch the agent <span className="prism-text">build it.</span>
          </h1>
          <p className="text-zinc-400 text-base md:text-lg mt-4 max-w-2xl mx-auto leading-relaxed">
            Prism is a professional editor with an autonomous AI builder — it creates the project, plans, picks tools,
            animates keyframe by keyframe on your canvas, and hits play. Powered by your own OpenAI, Claude, Gemini, OpenRouter or DeepSeek key.
          </p>
          <form
            className="mt-7 flex items-center gap-2 max-w-2xl mx-auto rounded-2xl glass p-2 text-left"
            onSubmit={(e) => { e.preventDefault(); startFromPrompt(); }}
          >
            <Wand2 size={17} className="text-violet-300 ml-2 shrink-0" />
            <input
              value={heroPrompt} onChange={(e) => setHeroPrompt(e.target.value)}
              placeholder="A neon launch animation for my headphone brand PULSE…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-zinc-600 h-10 min-w-0"
              aria-label="Describe what to create"
            />
            <Button type="submit" className="shrink-0">Build with AI <ArrowRight size={14} /></Button>
          </form>
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => createBlank(1920, 1080, "HD Video")}><Plus size={13} /> HD Video</Button>
            <Button variant="outline" size="sm" onClick={() => createBlank(1080, 1080, "Instagram Post")}><Plus size={13} /> Instagram Post</Button>
            <Button variant="outline" size="sm" onClick={() => createBlank(1080, 1920, "Story")}><Plus size={13} /> Story / Reel</Button>
            <Button variant="outline" size="sm" onClick={() => createBlank(1240, 1754, "Poster")}><Plus size={13} /> Poster</Button>
            <Link href="/studio"><Button variant="ghost" size="sm"><Play size={13} /> Open studio with showcase</Button></Link>
          </div>
        </div>
      </section>

      {/* projects */}
      <main className="max-w-7xl mx-auto px-4 pb-20">
        <section id="projects" aria-label="Your projects">
          <div className="flex items-center gap-3 mt-6 flex-wrap">
            <h2 className="font-display font-semibold text-lg flex items-center gap-2"><FolderOpen size={17} className="text-violet-300" /> Your projects</h2>
            <div className="relative ml-auto w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects…" className={cn(inputCls, "pl-8")} aria-label="Search projects" />
            </div>
          </div>
          {filtered.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-white/12 p-10 text-center">
              <Clapperboard size={26} className="mx-auto text-zinc-600" />
              <p className="text-zinc-400 mt-3 text-sm">No saved projects yet — everything you build in the studio autosaves here.</p>
              <Link href="/studio"><Button className="mt-4">Create your first design</Button></Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
              {filtered.map((p) => (
                <article key={p.id} className="group rounded-2xl bg-ink-900 ring-1 ring-white/[.08] overflow-hidden hover:ring-violet-400/50 transition">
                  <button onClick={() => router.push(`/studio?project=${p.id}`)} className="block w-full text-left" aria-label={`Open ${p.name}`}>
                    <div className="h-36 relative flex items-center justify-center p-4" style={{ background: `linear-gradient(150deg, ${p.accent}40, ${p.background} 65%)` }}>
                      <span className="font-display font-bold text-lg text-center leading-tight line-clamp-2 text-white/95">{p.headline || p.name}</span>
                      <span className="absolute bottom-2 right-2 text-[9px] font-mono bg-black/55 px-1.5 py-0.5 rounded text-zinc-300">{p.width}×{p.height} · {p.duration}s</span>
                    </div>
                  </button>
                  <div className="p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-zinc-500">{p.layerCount} layers · edited {new Date(p.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => duplicate(p.id)} className="p-1.5 text-zinc-500 hover:text-white" title="Duplicate" aria-label={`Duplicate ${p.name}`}><Copy size={14} /></button>
                    <button onClick={() => remove(p.id)} className="p-1.5 text-zinc-500 hover:text-red-300" title="Delete" aria-label={`Delete ${p.name}`}><Trash2 size={14} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* templates */}
        <section id="templates" className="mt-12" aria-label="Templates">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2"><LayoutTemplate size={17} className="text-cyan-300" /> Start from a template</h2>
          <p className="text-[13px] text-zinc-500 mt-1">Fully editable, pre-animated compositions — not images. {TEMPLATES.length} included.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            {TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => router.push(`/studio?template=${t.id}`)} className="group text-left rounded-2xl bg-ink-900 ring-1 ring-white/[.08] overflow-hidden hover:ring-cyan-400/60 hover:-translate-y-0.5 transition-all">
                <div className="h-28 relative flex items-center justify-center" style={{ background: `linear-gradient(140deg, ${t.accent}30, #0b0b14 70%)` }}>
                  <span className="font-display font-bold px-3 text-center leading-tight" style={{ color: t.accent }}>{t.name}</span>
                  <span className="absolute bottom-2 left-2"><Badge>{t.category}</Badge></span>
                  <span className="absolute bottom-2 right-2 text-[9px] font-mono text-zinc-400">{t.width}×{t.height}</span>
                </div>
                <p className="p-3 text-[11.5px] text-zinc-400 leading-relaxed">{t.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="mt-14 rounded-3xl bg-gradient-to-br from-violet-600/[.14] via-ink-900 to-fuchsia-600/[.1] ring-1 ring-white/[.08] p-6 md:p-8" aria-label="How the agent works">
          <h2 className="font-display font-semibold text-xl">Not a chatbot. <span className="prism-text">A builder.</span></h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mt-5">
            {[
              ["1 · Create", "Parses your brief, sizes the canvas, sets duration & background."],
              ["2 · Think", "Streams its plan and reasoning — palette, type, motion design."],
              ["3 · Select tools", "Picks from 12 Zod-validated canvas/motion tools."],
              ["4 · Build", "Adds layers, keyframes, easing and effects on your real canvas."],
              ["5 · Narrate", "Every tool call, param and result is visible — cancel anytime."],
              ["6 · Preview", "Auto-plays the result; refine in chat or export MP4/GIF/PNG."],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-xl bg-black/25 ring-1 ring-white/[.06] p-3.5">
                <p className="font-display font-semibold text-[13px] text-cyan-200">{title}</p>
                <p className="text-[11.5px] text-zinc-400 mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-6 items-center">
            <span className="text-[12px] text-zinc-400 mr-1">Works with your keys:</span>
            {["OpenAI", "Anthropic", "Google Gemini", "OpenRouter", "DeepSeek", "Groq", "Together", "Fireworks", "Ollama", "Custom /v1"].map((n) => <Badge key={n}>{n}</Badge>)}
            <Link href="/settings" className="ml-auto"><Button size="sm" variant="outline"><KeyRound size={13} /> Connect a provider</Button></Link>
          </div>
        </section>

        <footer className="mt-14 flex items-center justify-between text-[11px] text-zinc-600 flex-wrap gap-2">
          <span>PRISM — design in motion. Keys encrypted at rest · every AI action is a real provider call.</span>
          <span className="font-mono">Next.js · Vercel AI SDK · Zustand · Canvas2D</span>
        </footer>
      </main>
    </div>
  );
}
