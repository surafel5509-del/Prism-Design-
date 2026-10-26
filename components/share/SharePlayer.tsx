'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, Pause, Play, Repeat, Send, Share2, Sparkles } from 'lucide-react';
import { SceneCanvas } from '@/components/canvas/SceneCanvas';
import type { Project } from '@/lib/engine/types';
import { cn } from '@/lib/utils';

interface Comment { id: string; author: string; text: string; at: number; t?: number }

export function SharePlayer({ project, shareId, name, author, allowComments, initialComments }: {
  project: Project; shareId: string; name: string; author: string; allowComments: boolean; initialComments: Comment[];
}) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [comments, setComments] = useState<Comment[]>(initialComments ?? []);
  const [text, setText] = useState('');
  const [name_, setName] = useState('');
  const [sending, setSending] = useState(false);

  const animated = useMemo(() => project.layers.some((l) => Object.keys(l.keyframes ?? {}).length > 0), [project.layers]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => {
        const next = t + dt;
        if (next >= project.duration) return loop ? 0 : project.duration;
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, loop, project.duration]);

  useEffect(() => { if (animated) setPlaying(true); }, [animated]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/share/${shareId}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ author: name_ || 'Guest', text, t: time }),
      });
      const json = await res.json();
      if (res.ok) { setComments(json.comments ?? []); setText(''); }
    } finally { setSending(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">{name}</h1>
            <p className="mt-0.5 text-[11px] text-white/45">{project.width}×{project.height} · {project.duration.toFixed(1)}s · {project.layers.length} layers · by {author}</p>
          </div>
          <button
            onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); } catch { /* noop */ } }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/70 transition-colors hover:text-white"
          >
            <Share2 className="h-3.5 w-3.5" /> Copy link
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-[0_40px_120px_-40px_rgba(0,0,0,.95)]">
          <div className="relative" style={{ aspectRatio: `${project.width} / ${project.height}` }}>
            <SceneCanvas project={project} time={time} className="h-full w-full" ariaLabel={`${name} preview`} />
          </div>
          <div className="flex items-center gap-2 border-t border-white/[0.06] bg-black/50 px-3 py-2">
            <button onClick={() => setTime(0)} className="grid h-7 w-7 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/5 hover:text-white" aria-label="Restart"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setPlaying(!playing)} className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(110deg,#7c3aed,#0891b2_52%,#c026d3)] text-white" aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" />}
            </button>
            <button onClick={() => setTime((t) => Math.min(project.duration, t + 1 / project.fps))} className="grid h-7 w-7 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/5 hover:text-white" aria-label="Next frame"><ChevronRight className="h-4 w-4" /></button>
            <input
              type="range" min={0} max={project.duration} step={1 / Math.max(1, project.fps)} value={time}
              onChange={(e) => setTime(Number(e.target.value))}
              className="mx-2 h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-300"
              aria-label="Scrub timeline"
            />
            <span className="font-mono text-[10px] tabular-nums text-white/50">{time.toFixed(2)}s</span>
            <button onClick={() => setLoop(!loop)} className={cn('grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-white/5', loop ? 'text-violet-300' : 'text-white/50')} aria-label="Loop"><Repeat className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30"><Sparkles className="h-3 w-3 text-violet-400/70" /> Rendered live from vector layers and keyframes — not a video.</p>
      </div>

      <aside className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5 text-white/50" />
          <span className="text-[11px] font-medium text-white/80">Comments</span>
          <span className="ml-auto rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-white/50">{comments.length}</span>
        </div>
        <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
          {comments.length === 0 && <p className="py-6 text-center text-[10.5px] text-white/35">No notes yet. Leave feedback for the creator.</p>}
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-white/75">{c.author}</span>
                {c.t !== undefined && <span className="rounded bg-violet-500/15 px-1 text-[8.5px] text-violet-200">{c.t.toFixed(1)}s</span>}
                <span className="ml-auto text-[8.5px] text-white/30">{new Date(c.at).toLocaleDateString()}</span>
              </div>
              <p className="mt-0.5 text-[10.5px] leading-snug text-white/55">{c.text}</p>
            </div>
          ))}
        </div>

        {allowComments ? (
          <div className="mt-2 space-y-1.5">
            <input value={name_} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-7 w-full rounded-md border border-white/10 bg-black/30 px-2 text-[10.5px] text-white/80 outline-none placeholder:text-white/25 focus:border-violet-400/40" />
            <div className="flex gap-1.5">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send(); }} placeholder={`Note at ${time.toFixed(1)}s…`} className="h-7 min-w-0 flex-1 rounded-md border border-white/10 bg-black/30 px-2 text-[10.5px] text-white/80 outline-none placeholder:text-white/25 focus:border-violet-400/40" />
              <button onClick={() => void send()} disabled={sending || !text.trim()} className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-violet-500/80 text-white disabled:opacity-40" aria-label="Send comment"><Send className="h-3 w-3" /></button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[9.5px] text-white/30">Comments are disabled by the creator.</p>
        )}
      </aside>
    </div>
  );
}
