'use client';
import { useEffect, useRef, useState } from 'react';
import { Activity, CircleDot, Cloud, CloudOff, Cpu, Gauge, Layers, MousePointer2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditor } from '@/lib/store/editor';
import { useAgent } from '@/lib/store/agent';

const TOOL_LABEL: Record<string, string> = {
  select: 'Select', move: 'Move', hand: 'Hand', shape: 'Shape', pen: 'Pen', text: 'Text',
  image: 'Image', video: 'Video', audio: 'Audio', zoom: 'Zoom',
};

export function StatusBar() {
  const project = useEditor((s) => s.project);
  const tool = useEditor((s) => s.tool);
  const selection = useEditor((s) => s.selection);
  const time = useEditor((s) => s.time);
  const zoom = useEditor((s) => s.view.zoom);
  const dirty = useEditor((s) => s.dirty);
  const savedAt = useEditor((s) => s.savedAt);
  const snap = useEditor((s) => s.snap);
  const agentStatus = useAgent((s) => s.status);
  const agentProgress = useAgent((s) => s.progress);
  const toolCalls = useAgent((s) => s.toolCalls.length);
  const setRightTab = useEditor((s) => s.setRightTab);
  const togglePanel = useEditor((s) => s.toggle);
  const aiOpen = useEditor((s) => s.aiOpen);

  const [fps, setFps] = useState(60);
  const [mem, setMem] = useState<number | null>(null);
  const frames = useRef<{ count: number; at: number }>({ count: 0, at: performance.now() });

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      frames.current.count++;
      const now = performance.now();
      if (now - frames.current.at >= 500) {
        setFps(Math.round((frames.current.count * 1000) / (now - frames.current.at)));
        frames.current = { count: 0, at: now };
        const perf = performance as unknown as { memory?: { usedJSHeapSize: number } };
        if (perf.memory) setMem(Math.round(perf.memory.usedJSHeapSize / 1048576));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const selected = selection.length;
  const animated = project.layers.filter((l) => Object.keys(l.keyframes ?? {}).length).length;
  const agentLive = agentStatus === 'thinking' || agentStatus === 'building' || agentStatus === 'planning' || agentStatus === 'preparing';

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border/70 bg-panel/80 px-2.5 text-[9.5px] text-muted-foreground backdrop-blur">
      <span className="flex items-center gap-1"><MousePointer2 className="h-2.5 w-2.5" /> {TOOL_LABEL[tool] ?? tool}</span>
      <span className="text-muted-foreground/30">|</span>
      <span className={cn('flex items-center gap-1', snap && 'text-cyan-300/80')}><CircleDot className="h-2 w-2" /> snap {snap ? 'on' : 'off'}</span>
      <span className="text-muted-foreground/30">|</span>
      <span className="flex items-center gap-1 tabular-nums">
        <Activity className="h-2.5 w-2.5" />
        {formatTime(time)} / {formatTime(project.duration)}
      </span>
      <span className="hidden items-center gap-1 tabular-nums sm:flex">
        <Gauge className="h-2.5 w-2.5" /> {(zoom * 100).toFixed(0)}%
      </span>

      <span className="ml-auto flex items-center gap-3">
        <span className="hidden items-center gap-1 md:flex"><Layers className="h-2.5 w-2.5" /> {project.layers.length} layers · {animated} animated</span>
        {selected > 0 && <span className="text-violet-300">{selected} selected</span>}
        <span className="hidden items-center gap-1 sm:flex"><Cpu className="h-2.5 w-2.5" /> {project.width}×{project.height} @ {project.fps}fps{mem ? ` · ${mem} MB` : ''}</span>

        <button
          onClick={() => { setRightTab('ai'); if (!aiOpen) togglePanel('aiOpen'); }}
          className={cn('flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-white/5', agentLive && 'text-violet-300')}
          title={`Agent: ${agentStatus}`}
        >
          <Sparkles className={cn('h-2.5 w-2.5', agentLive && 'animate-pulse')} />
          agent {agentStatus}{agentLive ? ` ${Math.round(agentProgress)}%` : toolCalls ? ` · ${toolCalls}` : ''}
        </button>

        <span className="flex items-center gap-1">
          <span className={cn('h-1.5 w-1.5 rounded-full', fps >= 55 ? 'bg-emerald-400' : fps >= 40 ? 'bg-amber-400' : 'bg-rose-400')} />
          {fps} fps
        </span>

        <span className="flex items-center gap-1" title={savedAt ? `Saved ${new Date(savedAt).toLocaleTimeString()}` : 'Autosave'}>
          {dirty ? <CloudOff className="h-2.5 w-2.5 text-amber-300/80" /> : <Cloud className="h-2.5 w-2.5 text-emerald-400/80" />}
          {dirty ? 'saving…' : 'saved'}
        </span>
      </span>
    </footer>
  );
}

function formatTime(t: number) {
  const s = Math.max(0, t);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const ff = Math.floor((s % 1) * 100);
  return `${mm}:${String(ss).padStart(2, '0')}.${String(ff).padStart(2, '0')}`;
}
