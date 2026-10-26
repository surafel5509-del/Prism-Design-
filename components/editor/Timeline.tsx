'use client';
import * as React from 'react';
import { useEditor } from '@/lib/store/editor';
import { resolveLayer, isLayerActiveAt } from '@/lib/engine/animation';
import type { AnimatableProp, Easing, Keyframe, Layer } from '@/lib/engine/types';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Kbd } from '@/components/ui/misc';
import {
  Play, Pause, SkipBack, SkipForward, Repeat, ChevronLeft, ChevronRight, Plus, Minus,
  Diamond, ChevronDown, ChevronUp, Eye, EyeOff, Lock, Unlock, Volume2, VolumeX, Music2,
  Timer, ZoomIn, ZoomOut, ChevronsLeft, ChevronsRight, Magnet, Trash2, Square, Type, Image as ImageIcon,
  Film, AudioLines, Shapes, Layers, Zap, Activity, PawPrint,
} from 'lucide-react';
import { cn, clamp, formatTime } from '@/lib/utils';
import { EASING_PRESETS } from '@/lib/engine/easing';
import { proceduralPeaks, decodePeaks } from '@/lib/engine/audio';
import { toast } from 'sonner';

const TRACK_H = 26;
const CHANNEL_H = 20;
const HEADER_W = 188;
const PAD = 12;
const PROPS: { prop: AnimatableProp; label: string; icon: string }[] = [
  { prop: 'x', label: 'Position X', icon: 'x' }, { prop: 'y', label: 'Position Y', icon: 'y' },
  { prop: 'scaleX', label: 'Scale X', icon: 's' }, { prop: 'scaleY', label: 'Scale Y', icon: 's' },
  { prop: 'rotation', label: 'Rotation', icon: '°' }, { prop: 'opacity', label: 'Opacity', icon: 'α' },
  { prop: 'fontSize', label: 'Font size', icon: 'T' }, { prop: 'w', label: 'Width', icon: 'w' }, { prop: 'h', label: 'Height', icon: 'h' },
];

type DragKf = { layerId: string; prop: AnimatableProp; id: string; startTime: number; startX: number } | null;
type DragClip = { layerId: string; edge: 'left' | 'right' | 'body'; startX: number; start: number; end: number; origStart: number } | null;

export function Timeline() {
  const project = useEditor((s) => s.project);
  const time = useEditor((s) => s.time);
  const playing = useEditor((s) => s.playing);
  const loopMode = useEditor((s) => s.loopMode);
  const speed = useEditor((s) => s.speed);
  const selection = useEditor((s) => s.selection);
  const timelineZoom = useEditor((s) => s.timelineZoom);
  const height = useEditor((s) => s.timelineHeight);
  const setTime = useEditor((s) => s.setTime);
  const togglePlay = useEditor((s) => s.togglePlay);
  const setLoopMode = useEditor((s) => s.setLoopMode);
  const setSpeed = useEditor((s) => s.setSpeed);
  const stepFrames = useEditor((s) => s.stepFrames);
  const setTimelineZoom = useEditor((s) => s.setTimelineZoom);
  const setTimelineHeight = useEditor((s) => s.setTimelineHeight);
  const toggle = useEditor((s) => s.toggle);
  const select = useEditor((s) => s.select);
  const toggleSelect = useEditor((s) => s.toggleSelect);
  const updateLayer = useEditor((s) => s.updateLayer);
  const pushHistory = useEditor((s) => s.pushHistory);
  const keyframeProp = useEditor((s) => s.keyframeProp);
  const setDuration = useEditor((s) => s.setDuration);
  const setLayerEasing = useEditor((s) => s.setLayerEasing);
  const removeKeyframeAt = useEditor((s) => s.removeKeyframeAt);

  const [expanded, setExpanded] = React.useState<string[]>([]);
  const [kfDrag, setKfDrag] = React.useState<DragKf>(null);
  const [clipDrag, setClipDrag] = React.useState<DragClip>(null);
  const [muted, setMuted] = React.useState(false);
  const laneRef = React.useRef<HTMLDivElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  const pps = 92 * timelineZoom;
  const duration = project.duration;
  const laneWidth = Math.max(600, duration * pps + PAD * 2);

  const orderedLayers = React.useMemo(() => project.layers.filter((l) => !l.parentId).length ? project.layers : project.layers, [project.layers]);
  const visibleLayers = React.useMemo(() => [...orderedLayers].reverse(), [orderedLayers]);

  const timeFromEvent = (clientX: number) => {
    const rect = laneRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    const x = clientX - rect.left + scrollLeft - PAD;
    return clamp(x / pps, 0, duration);
  };

  // keyframe drag
  React.useEffect(() => {
    if (!kfDrag) return;
    const move = (e: PointerEvent) => {
      const dx = e.clientX - kfDrag.startX;
      const newTime = clamp(kfDrag.startTime + dx / pps, 0, duration);
      const layer = useEditor.getState().project.layers.find((l) => l.id === kfDrag.layerId);
      if (!layer) return;
      const list = (layer.keyframes[kfDrag.prop] ?? []).map((k) => (k.id === kfDrag.id ? { ...k, time: Math.round(newTime * 100) / 100 } : k));
      updateLayer(kfDrag.layerId, { keyframes: { ...layer.keyframes, [kfDrag.prop]: list } }, { history: false });
    };
    const up = () => setKfDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [kfDrag, pps, duration, updateLayer]);

  // clip drag
  React.useEffect(() => {
    if (!clipDrag) return;
    const move = (e: PointerEvent) => {
      const dt = (e.clientX - clipDrag.startX) / pps;
      if (clipDrag.edge === 'body') {
        const len = clipDrag.end - clipDrag.start;
        const ns = clamp(clipDrag.start + dt, 0, duration - len);
        updateLayer(clipDrag.layerId, { startTime: round2(ns), endTime: round2(ns + len) }, { history: false });
      } else if (clipDrag.edge === 'left') {
        updateLayer(clipDrag.layerId, { startTime: round2(clamp(clipDrag.start + dt, 0, clipDrag.end - 0.1)) }, { history: false });
      } else {
        updateLayer(clipDrag.layerId, { endTime: round2(clamp(clipDrag.end + dt, clipDrag.start + 0.1, duration)) }, { history: false });
      }
    };
    const up = () => setClipDrag(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [clipDrag, pps, duration, updateLayer]);

  const scrub = (e: React.PointerEvent) => {
    const apply = (clientX: number) => setTime(timeFromEvent(clientX));
    apply(e.clientX);
    const move = (ev: PointerEvent) => apply(ev.clientX);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const totalRows = visibleLayers.reduce((acc, l) => acc + 1 + (expanded.includes(l.id) ? PROPS.filter((p) => (l.keyframes[p.prop]?.length ?? 0) > 0).length : 0), 0);
  const playheadX = PAD + time * pps;

  return (
    <section className="relative flex shrink-0 flex-col border-t border-border/70 bg-panel/70" style={{ height }} aria-label="Timeline">
      <div onPointerDown={(e) => {
        if (e.button !== 0) return;
        const startY = e.clientY; const startH = height;
        const move = (ev: PointerEvent) => setTimelineHeight(startH - (ev.clientY - startY));
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      }} className="group absolute -top-1 left-0 right-0 z-20 h-2 cursor-row-resize" aria-hidden="true">
        <div className="mx-auto mt-[3px] h-0.5 w-10 rounded-full bg-border opacity-0 transition-opacity group-hover:opacity-100" />
      </div>

      {/* transport */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <div className="flex items-center gap-0.5">
          <IconBtn onClick={() => setTime(0)} label="Go to start"><SkipBack className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={() => stepFrames(-1)} label="Previous frame"><ChevronLeft className="h-3.5 w-3.5" /></IconBtn>
          <Button size="icon-sm" variant="prism" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} className="h-6 w-6 rounded-md">
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 translate-x-[1px]" />}
          </Button>
          <IconBtn onClick={() => stepFrames(1)} label="Next frame"><ChevronRight className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={() => setTime(duration)} label="Go to end"><SkipForward className="h-3.5 w-3.5" /></IconBtn>
        </div>
        <div className="mx-1 flex items-baseline gap-1 rounded-md border border-border/70 bg-background/50 px-2 py-0.5 font-mono text-[11px] tabular text-foreground/90">
          {formatTime(time, project.fps)}<span className="text-[9px] text-muted-foreground">/ {formatTime(duration, project.fps)}</span>
        </div>
        <IconBtn onClick={() => setLoopMode(loopMode === 'loop' ? 'none' : loopMode === 'pingpong' ? 'loop' : 'pingpong')} label={`Loop: ${loopMode}`} active={loopMode !== 'none'}>
          <Repeat className="h-3.5 w-3.5" />
        </IconBtn>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-md px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground">{speed.toFixed(2)}×</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-32">
            {[0.25, 0.5, 1, 1.5, 2, 4].map((s) => <DropdownMenuItem key={s} onClick={() => setSpeed(s)}>{s}× {s === 1 && <span className="ml-auto text-[9px] text-muted-foreground">normal</span>}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-4 w-px bg-border/70" />
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground" title="Composition settings">
              <Timer className="h-3 w-3" /> {duration.toFixed(1)}s · {project.fps}fps
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 space-y-2.5">
            <p className="panel-title">Composition</p>
            <label className="flex items-center justify-between gap-3 text-[11px]">Duration
              <input type="number" min={0.5} max={600} step={0.5} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 5)} className="h-7 w-20 rounded-md border border-border bg-background/50 px-2 text-right font-mono text-[11px]" />
            </label>
            <label className="flex items-center justify-between gap-3 text-[11px]">Frame rate
              <select value={project.fps} onChange={(e) => useEditor.getState().patchProject({ fps: Number(e.target.value) })} className="h-7 w-20 rounded-md border border-border bg-background/50 px-1 font-mono text-[11px]">
                {[24, 25, 30, 50, 60].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <div className="flex items-center gap-2 pt-1 text-[10px] text-muted-foreground"><Magnet className="h-3 w-3" /> Keyframing follows the playhead.</div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip><TooltipTrigger asChild><IconBtn onClick={() => toggle('timelineOpen')} label="Collapse timeline"><ChevronDown className="h-3.5 w-3.5" /></IconBtn></TooltipTrigger><TooltipContent>Collapse timeline</TooltipContent></Tooltip>
          <IconBtn onClick={() => setTimelineZoom(timelineZoom / 1.25)} label="Zoom out timeline"><ZoomOut className="h-3.5 w-3.5" /></IconBtn>
          <div className="w-20"><Slider value={[timelineZoom]} min={0.4} max={6} step={0.1} onValueChange={([v]) => setTimelineZoom(v)} aria-label="Timeline zoom" /></div>
          <IconBtn onClick={() => setTimelineZoom(timelineZoom * 1.25)} label="Zoom in timeline"><ZoomIn className="h-3.5 w-3.5" /></IconBtn>
          <div className="mx-1 h-4 w-px bg-border/70" />
          <IconBtn onClick={() => setMuted(!muted)} label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}</IconBtn>
        </div>
      </div>

      {/* tracks */}
      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        <div className="relative min-w-full" style={{ width: HEADER_W + laneWidth }}>
          {/* ruler */}
          <div className="sticky top-0 z-20 flex h-6 border-b border-border/60 bg-panel-2/95 backdrop-blur" style={{ width: HEADER_W + laneWidth }}>
            <div className="sticky left-0 z-10 flex w-[188px] shrink-0 items-center gap-1 border-r border-border/60 bg-panel-2/95 px-2">
              <span className="panel-title">Tracks</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/60">{project.layers.length}</span>
            </div>
            <div ref={laneRef} className="relative flex-1 cursor-crosshair select-none" onPointerDown={scrub}>
              <Ticks duration={duration} pps={pps} />
              <div className="absolute top-0 z-10 h-full w-[1.5px] bg-[linear-gradient(180deg,#e879f9,#8b5cf6)]" style={{ left: playheadX }}>
                <div className="absolute -left-[4px] top-0 h-2 w-2.5 rounded-b-[2px] bg-fuchsia-400" />
              </div>
            </div>
          </div>

          {/* empty state */}
          {visibleLayers.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Layers className="h-5 w-5 text-muted-foreground/40" />
              <p className="text-[11px] text-muted-foreground">No layers yet — press <Kbd>R</Kbd> for a shape or <Kbd>T</Kbd> for text.</p>
            </div>
          )}

          {visibleLayers.map((layer) => {
            const isSel = selection.includes(layer.id);
            const isExpanded = expanded.includes(layer.id);
            const animatedProps = PROPS.filter((p) => (layer.keyframes[p.prop]?.length ?? 0) > 0);
            const inRange = isLayerActiveAt(layer, time);
            return (
              <div key={layer.id} className="group/row">
                <div className={cn('flex border-b border-border/40 transition-colors', isSel ? 'bg-violet-500/[0.07]' : 'hover:bg-accent/30')} style={{ height: TRACK_H }}>
                  <div
                    className={cn('sticky left-0 z-10 flex w-[188px] shrink-0 items-center gap-1 border-r border-border/50 px-1.5', isSel ? 'bg-[#17131f]' : 'bg-panel/95')}
                    onClick={(e) => { if (e.shiftKey || e.metaKey) toggleSelect(layer.id, true); else select([layer.id]); }}
                  >
                    <button className="flex h-4 w-3 items-center justify-center text-muted-foreground/60 hover:text-foreground" onClick={(e) => { e.stopPropagation(); setExpanded((x) => x.includes(layer.id) ? x.filter((i) => i !== layer.id) : [...x, layer.id]); }} aria-label={isExpanded ? 'Collapse channels' : 'Expand channels'}>
                      {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                    <LayerTypeIcon layer={layer} />
                    <span className="min-w-0 flex-1 truncate text-[10.5px] text-foreground/85" title={layer.name}>{layer.name}</span>
                    {animatedProps.length > 0 && <span className="rounded bg-cyan-500/10 px-1 font-mono text-[8px] text-cyan-400">{animatedProps.length}</span>}
                    <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }} className="text-muted-foreground/50 hover:text-foreground" aria-label={layer.visible ? 'Hide layer' : 'Show layer'}>
                      {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-red-400/80" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }} className="text-muted-foreground/50 hover:text-foreground" aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}>
                      {layer.locked ? <Lock className="h-3 w-3 text-amber-400/90" /> : <Unlock className="h-3 w-3" />}
                    </button>
                  </div>
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0" style={{ left: PAD, width: duration * pps }}>
                      {[0.25, 0.5, 0.75].map((f) => <div key={f} className="absolute top-0 h-full w-px bg-border/25" style={{ left: f * duration * pps }} />)}
                    </div>
                    <Clip layer={layer} pps={pps} selected={isSel} duration={duration}
                      onSelect={(e) => { if (e.shiftKey) toggleSelect(layer.id, true); else select([layer.id]); }}
                      onBodyDown={(e) => { pushHistory(); setClipDrag({ layerId: layer.id, edge: 'body', startX: e.clientX, start: layer.startTime, end: layer.endTime, origStart: layer.startTime }); }}
                      onEdgeDown={(edge, e) => { pushHistory(); setClipDrag({ layerId: layer.id, edge, startX: e.clientX, start: layer.startTime, end: layer.endTime, origStart: layer.startTime }); }}
                    />
                  </div>
                </div>

                {isExpanded && animatedProps.map(({ prop, label, icon }) => (
                  <div key={prop} className="flex border-b border-border/30 bg-background/20" style={{ height: CHANNEL_H }}>
                    <div className="sticky left-0 z-10 flex w-[188px] shrink-0 items-center gap-1.5 border-r border-border/40 bg-panel/95 pl-7 pr-2">
                      <span className="flex h-3 w-3 items-center justify-center rounded-sm bg-muted font-mono text-[7.5px] text-muted-foreground">{icon}</span>
                      <span className="truncate text-[9.5px] text-muted-foreground">{label}</span>
                      <button className="ml-auto text-muted-foreground/60 hover:text-foreground" onClick={() => keyframeProp(layer.id, prop)} aria-label={`Add ${label} keyframe`}><Plus className="h-2.5 w-2.5" /></button>
                    </div>
                    <div className="relative flex-1">
                      <div className="absolute top-1/2 h-px w-full bg-border/30" style={{ left: 0 }} />
                      <div className="absolute inset-y-0" style={{ left: PAD }}>
                        {(layer.keyframes[prop] ?? []).map((kf, i, arr) => (
                          <KeyframeDiamond key={kf.id} kf={kf} layerId={layer.id} prop={prop} pps={pps} last={i === arr.length - 1}
                            onDown={(e) => { e.stopPropagation(); pushHistory(); setKfDrag({ layerId: layer.id, prop, id: kf.id, startTime: kf.time, startX: e.clientX }); setTime(kf.time); }}
                            onDelete={() => removeKeyframeAt(layer.id, prop, kf.time)}
                            onEasing={(easingId) => setLayerEasing(layer.id, prop, easingId)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {visibleLayers.length > 0 && (
            <div className="flex h-6 items-center border-b border-border/30">
              <div className="sticky left-0 z-10 flex w-[188px] shrink-0 items-center gap-1 border-r border-border/40 bg-panel/95 px-2">
                <Plus className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-[9px] text-muted-foreground/50">Add layer from the toolbar</span>
              </div>
              <div className="flex-1" />
            </div>
          )}
        </div>
      </div>
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,.35),transparent)]" />
      {totalRows === 0 && <span className="sr-only">Timeline is empty</span>}
    </section>
  );
}

function round2(n: number) { return Math.round(n * 100) / 100; }

function IconBtn({ children, onClick, label, active }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onClick} aria-label={label} aria-pressed={active} className={cn('flex h-6 w-6 items-center justify-center rounded-md transition-colors', active ? 'bg-violet-500/15 text-violet-300' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>{children}</button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Ticks({ duration, pps }: { duration: number; pps: number }) {
  const stepCandidates = [0.1, 0.25, 0.5, 1, 2, 5, 10];
  const step = stepCandidates.find((s) => s * pps >= 44) ?? 10;
  const count = Math.ceil(duration / step);
  return (
    <div className="relative h-full">
      {Array.from({ length: count + 1 }, (_, i) => {
        const t = i * step;
        return (
          <div key={i} className="absolute top-0 h-full" style={{ left: PAD + t * pps }}>
            <div className="absolute top-1 h-1.5 w-px bg-border" />
            <span className="absolute top-[7px] translate-x-1 font-mono text-[8.5px] text-muted-foreground/70">{t % 1 === 0 ? `${t}s` : `${t.toFixed(2)}s`}</span>
          </div>
        );
      })}
    </div>
  );
}

function LayerTypeIcon({ layer }: { layer: Layer }) {
  const cls = 'h-3 w-3 shrink-0';
  if (layer.type === 'text') return <Type className={cn(cls, 'text-fuchsia-400')} />;
  if (layer.type === 'image') return <ImageIcon className={cn(cls, 'text-cyan-400')} />;
  if (layer.type === 'video') return <Film className={cn(cls, 'text-sky-400')} />;
  if (layer.type === 'audio') return <AudioLines className={cn(cls, 'text-emerald-400')} />;
  if (layer.type === 'group') return <Layers className={cn(cls, 'text-amber-400')} />;
  if (layer.type === 'particles') return <PawPrint className={cn(cls, 'text-violet-300')} />;
  if (layer.type === 'path') return <Activity className={cn(cls, 'text-violet-400')} />;
  return <Shapes className={cn(cls, 'text-violet-400')} />;
}

function Clip({ layer, pps, selected, duration, onSelect, onBodyDown, onEdgeDown }: {
  layer: Layer; pps: number; selected: boolean; duration: number;
  onSelect: (e: React.PointerEvent) => void;
  onBodyDown: (e: React.PointerEvent) => void;
  onEdgeDown: (edge: 'left' | 'right', e: React.PointerEvent) => void;
}) {
  const [peaks, setPeaks] = React.useState<number[] | null>(null);
  const left = PAD + layer.startTime * pps;
  const width = Math.max(8, (layer.endTime - layer.startTime) * pps);
  const isAudio = layer.type === 'audio';

  React.useEffect(() => {
    if (!isAudio) return;
    let alive = true;
    const barCount = Math.max(18, Math.round(width / 3));
    if (layer.media?.src?.startsWith('data:')) void decodePeaks(layer.media.src, Math.min(220, barCount)).then((p) => { if (alive) setPeaks(p); });
    else setPeaks(proceduralPeaks(layer.id, Math.min(220, barCount)));
    return () => { alive = false; };
  }, [isAudio, layer.id, layer.media?.src, width]);

  const color = layer.type === 'text' ? 'from-fuchsia-500/30 to-fuchsia-500/10 border-fuchsia-500/40'
    : layer.type === 'image' ? 'from-cyan-500/30 to-cyan-500/10 border-cyan-500/40'
    : layer.type === 'video' ? 'from-sky-500/30 to-sky-500/10 border-sky-500/40'
    : layer.type === 'audio' ? 'from-emerald-500/30 to-emerald-500/10 border-emerald-500/40'
    : layer.type === 'group' ? 'from-amber-500/30 to-amber-500/10 border-amber-500/40'
    : 'from-violet-500/30 to-violet-500/10 border-violet-500/40';

  return (
    <div
      className={cn('absolute top-1/2 -translate-y-1/2 overflow-hidden rounded-[4px] border bg-gradient-to-b', color, selected && 'ring-2 ring-violet-400/70 ring-offset-1 ring-offset-panel')}
      style={{ left, width, height: 17 }}
      onPointerDown={onSelect}
      onDoubleClick={() => { useEditor.getState().setTime(layer.startTime); }}
      title={`${layer.name} · ${layer.startTime.toFixed(2)}s → ${layer.endTime.toFixed(2)}s`}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-white/20" style={{ zIndex: 2 }} onPointerDown={(e) => { e.stopPropagation(); onEdgeDown('left', e); }} />
      <div className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize hover:bg-white/20" style={{ zIndex: 2 }} onPointerDown={(e) => { e.stopPropagation(); onEdgeDown('right', e); }} />
      <div className="flex h-full cursor-grab items-center px-2" onPointerDown={(e) => { e.stopPropagation(); onSelect(e); onBodyDown(e); }}>
        {isAudio && peaks ? (
          <svg viewBox={`0 0 ${peaks.length * 2} 20`} preserveAspectRatio="none" className="h-full w-full opacity-80" aria-hidden="true">
            {peaks.map((p, i) => <rect key={i} x={i * 2} y={10 - p * 8} width={1.2} height={Math.max(1, p * 16)} fill="currentColor" className="text-emerald-300" />)}
          </svg>
        ) : (
          <span className="truncate text-[9px] text-foreground/75">{layer.name}</span>
        )}
      </div>
      {layer.type === 'audio' && <Music2 className="absolute right-1 top-0.5 h-2.5 w-2.5 text-emerald-300/70" />}
    </div>
  );
}

function KeyframeDiamond({ kf, layerId, prop, pps, onDown, onDelete, onEasing, last }: {
  kf: Keyframe; layerId: string; prop: AnimatableProp; pps: number; last?: boolean;
  onDown: (e: React.PointerEvent) => void; onDelete: () => void; onEasing: (id: string) => void;
}) {
  void layerId;
  const easingLabel = typeof kf.easing === 'object' ? kf.easing?.type : 'easeInOut';
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          onPointerDown={onDown}
          onDoubleClick={onDelete}
          className={cn('absolute top-1/2 z-[3] h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[1px] border transition-transform hover:scale-125',
            last ? 'border-fuchsia-300 bg-fuchsia-400' : 'border-cyan-200/80 bg-cyan-400/80')}
          style={{ left: kf.time * pps }}
          aria-label={`Keyframe at ${kf.time.toFixed(2)}s`}
          title={`${prop} · ${kf.time.toFixed(2)}s · ${easingLabel}`}
        />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" side="top">
        <p className="panel-title mb-1.5 px-1">Keyframe · {prop}</p>
        <div className="mb-2 flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 font-mono text-[10px]">
          <span className="text-muted-foreground">time</span><span>{kf.time.toFixed(2)}s</span>
        </div>
        <div className="mb-2 flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 font-mono text-[10px]">
          <span className="text-muted-foreground">value</span><span>{Array.isArray(kf.value) ? kf.value.join(', ') : String(kf.value)}</span>
        </div>
        <p className="mb-1 px-1 text-[9.5px] text-muted-foreground">Easing from this keyframe</p>
        <div className="grid grid-cols-2 gap-1">
          {EASING_PRESETS.slice(0, 8).map((e) => (
            <button key={e.id} onClick={() => onEasing(e.id)} className={cn('rounded border px-1.5 py-1 text-[10px] transition-colors', easingLabel === e.id ? 'border-violet-500/50 bg-violet-500/15 text-violet-300' : 'border-border hover:bg-accent')}>{e.label}</button>
          ))}
        </div>
        <button onClick={onDelete} className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-red-500/30 py-1 text-[10px] text-red-400 hover:bg-red-500/10"><Trash2 className="h-2.5 w-2.5" /> Delete keyframe</button>
      </PopoverContent>
    </Popover>
  );
}
