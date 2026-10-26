'use client';
import { useCallback, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Download, Expand, Film, Layers, Pause, Play, Repeat, RotateCcw, Share2, Sparkles, Volume2,
} from 'lucide-react';
import { SceneCanvas } from '@/components/canvas/SceneCanvas';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEditor } from '@/lib/store/editor';
import { cn } from '@/lib/utils';

export function PreviewDialog({ onExport, onShare }: { onExport: () => void; onShare: () => void }) {
  const open = useEditor((s) => s.previewOpen);
  const setOpen = useEditor((s) => s.setPreviewOpen);
  const project = useEditor((s) => s.project);
  const time = useEditor((s) => s.time);
  const playing = useEditor((s) => s.playing);
  const togglePlay = useEditor((s) => s.togglePlay);
  const setTime = useEditor((s) => s.setTime);
  const loopMode = useEditor((s) => s.loopMode);

  const step = useCallback((dir: 1 | -1) => {
    const state = useEditor.getState();
    const fps = state.project.fps || 30;
    state.setTime(Math.max(0, Math.min(state.project.duration, state.time + dir / fps)));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      if (e.key === 'l' || e.key === 'L') {
        const s = useEditor.getState();
        s.setLoopMode(s.loopMode === 'loop' ? 'none' : 'loop');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, togglePlay, step]);

  useEffect(() => {
    if (open) { useEditor.getState().setPlaying(false); }
  }, [open]);

  const withMotion = project.layers.some((l) => Object.keys(l.keyframes ?? {}).length > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[min(97vw,1240px)] gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Review and preview</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-500/15 ring-1 ring-violet-400/25">
            <Sparkles className="h-3 w-3 text-violet-200" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold tracking-tight">{project.name}</p>
            <p className="text-[9.5px] text-muted-foreground">{project.width}×{project.height} · {project.fps}fps · {project.duration.toFixed(1)}s · {project.layers.length} layers</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {withMotion ? <Badge variant="prism" className="h-5">Motion</Badge> : <Badge variant="secondary" className="h-5">Static</Badge>}
            <Button variant="outline" size="sm" onClick={onShare}><Share2 className="h-3.5 w-3.5" /> Share</Button>
            <Button variant="prism" size="sm" onClick={onExport}><Download className="h-3.5 w-3.5" /> Export</Button>
          </div>
        </div>

        <div className="grid max-h-[76vh] grid-cols-1 md:grid-cols-[1fr_228px]">
          <div className="flex min-h-0 flex-col bg-[#07070c]">
            <div className="relative flex min-h-[340px] flex-1 items-center justify-center p-4">
              <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(124,58,237,.14), transparent 60%)' }} />
              <div className="relative aspect-auto max-h-[52vh] w-full max-w-[820px] overflow-hidden rounded-lg shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)] ring-1 ring-white/10" style={{ aspectRatio: `${project.width} / ${project.height}` }}>
                <SceneCanvas project={project} time={time} className="h-full w-full" ariaLabel="Project preview" />
              </div>
            </div>

            <div className="border-t border-white/[0.06] bg-black/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setTime(0)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" title="Restart"><RotateCcw className="h-3.5 w-3.5" /></button>
                <button onClick={() => step(-1)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" title="Previous frame"><ChevronLeft className="h-3.5 w-3.5" /></button>
                <Button size="icon-sm" variant="prism" onClick={togglePlay} className="h-8 w-8 rounded-full" aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" />}
                </Button>
                <button onClick={() => step(1)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground" title="Next frame"><ChevronRight className="h-3.5 w-3.5" /></button>
                <span className="ml-1 font-mono text-[10px] tabular-nums text-foreground/70">{time.toFixed(2)}s</span>

                <input
                  type="range"
                  min={0}
                  max={project.duration}
                  step={1 / Math.max(1, project.fps)}
                  value={time}
                  onChange={(e) => setTime(Number(e.target.value))}
                  className="mx-2 h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-violet-400 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-300"
                  aria-label="Scrub"
                />

                <button
                  onClick={() => { const s = useEditor.getState(); s.setLoopMode(s.loopMode === 'loop' ? 'none' : 'loop'); }}
                  className={cn('grid h-7 w-7 place-items-center rounded-md transition-colors hover:bg-white/5', loopMode === 'loop' ? 'text-violet-300' : 'text-muted-foreground hover:text-foreground')}
                  title="Loop"
                ><Repeat className="h-3.5 w-3.5" /></button>
                <button
                  onClick={() => {
                    const s = useEditor.getState();
                    const audio = s.project.layers.filter((l) => l.type === 'audio' && l.media);
                    const allMuted = audio.length > 0 && audio.every((l) => l.media?.muted);
                    audio.forEach((l) => s.updateLayer(l.id, { media: { ...l.media!, muted: !allMuted } }, { history: false }));
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  title="Mute / unmute audio"
                ><Volume2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>

          <div className="hidden min-h-0 flex-col gap-2 overflow-y-auto border-l border-border/70 bg-panel/60 p-2.5 md:flex">
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Composition</p>
            <Stat icon={<Layers className="h-3 w-3" />} label="Layers" value={String(project.layers.length)} />
            <Stat icon={<Film className="h-3 w-3" />} label="Duration" value={`${project.duration.toFixed(1)}s`} />
            <Stat icon={<Expand className="h-3 w-3" />} label="Resolution" value={`${project.width}×${project.height}`} />
            <Stat icon={<Volume2 className="h-3 w-3" />} label="Audio tracks" value={String(project.layers.filter((l) => l.type === 'audio').length)} />
            <Stat icon={<Sparkles className="h-3 w-3" />} label="Animated" value={String(project.layers.filter((l) => Object.keys(l.keyframes ?? {}).length).length)} />

            <div className="mt-1 rounded-lg border border-border/60 bg-black/20 p-2">
              <p className="text-[9.5px] font-medium text-foreground/80">Keyboard</p>
              <ul className="mt-1 space-y-0.5 text-[9.5px] text-muted-foreground">
                <li><kbd className="rounded bg-white/[0.07] px-1">space</kbd> play / pause</li>
                <li><kbd className="rounded bg-white/[0.07] px-1">← →</kbd> frame step</li>
                <li><kbd className="rounded bg-white/[0.07] px-1">L</kbd> loop</li>
              </ul>
            </div>

            <div className="mt-auto rounded-lg border border-violet-400/20 bg-violet-500/[0.07] p-2">
              <p className="text-[10px] font-medium text-violet-100">Happy with it?</p>
              <p className="mt-0.5 text-[9.5px] leading-snug text-violet-200/60">Export a video or still, or hand the user a live share link.</p>
              <div className="mt-1.5 flex gap-1">
                <Button size="xs" variant="prism" onClick={onExport} className="h-6 flex-1"><Download className="h-2.5 w-2.5" /> Export</Button>
                <Button size="xs" variant="outline" onClick={onShare} className="h-6 flex-1"><Share2 className="h-2.5 w-2.5" /> Share</Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-white/[0.025] px-2 py-1.5">
      <span className="text-muted-foreground/70">{icon}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="ml-auto font-mono text-[10px] text-foreground/85">{value}</span>
    </div>
  );
}
