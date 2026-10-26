'use client';
import * as React from 'react';
import { useEditor } from '@/lib/store/editor';
import { useAgent } from '@/lib/store/agent';
import type { AnimatableProp, BlendMode, EffectType, Gradient, Layer, ShapeKind, TextAnimator } from '@/lib/engine/types';
import { resolveLayer } from '@/lib/engine/animation';
import { EASING_PRESETS } from '@/lib/engine/easing';
import { ANIMATION_PRESETS, applyPresetToLayer } from '@/lib/engine/presets';
import { PALETTES } from '@/lib/engine/factory';
import { FONTS } from '@/lib/data/library';
import { ASPECTS } from '@/lib/engine/types';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState, Kbd, Segmented } from '@/components/ui/misc';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, clamp, fileToDataUrl, formatCost, readableOn } from '@/lib/utils';
import {
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  Diamond, Plus, Trash2, Sparkles, Move, Maximize2, RotateCw, Droplet, Type as TypeIcon,
  Image as ImageIcon, Shapes, Layers, Blend, Eye, Wand2, ChevronDown, ArrowUpRight, CircleDot,
  Settings2, Palette, Zap, Film, Grid3x3, MousePointer2, ArrowRight, Clock, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'design' | 'animate' | 'effects' | 'ai';
const ANIM_PROPS: { prop: AnimatableProp; label: string }[] = [
  { prop: 'x', label: 'X' }, { prop: 'y', label: 'Y' }, { prop: 'w', label: 'Width' }, { prop: 'h', label: 'Height' },
  { prop: 'rotation', label: 'Rotation' }, { prop: 'scaleX', label: 'Scale X' }, { prop: 'scaleY', label: 'Scale Y' },
  { prop: 'opacity', label: 'Opacity' }, { prop: 'fontSize', label: 'Font size' }, { prop: 'cornerRadius', label: 'Radius' },
];

export function Inspector() {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const time = useEditor((s) => s.time);
  const rightTab = useEditor((s) => s.rightTab);
  const setRightTab = useEditor((s) => s.setRightTab);
  const layer = project.layers.find((l) => l.id === selection[0]) ?? null;
  const resolved = layer ? resolveLayer(layer, time) : null;

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'design', label: 'Design', icon: Settings2 },
    { id: 'animate', label: 'Animate', icon: Zap },
    { id: 'effects', label: 'Effects', icon: Sparkles },
    { id: 'ai', label: 'AI', icon: Wand2 },
  ];

  return (
    <aside className="flex w-[286px] shrink-0 flex-col border-l border-border/70 bg-panel/60" aria-label="Inspector">
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border/60 px-1.5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setRightTab(t.id === 'animate' ? 'animate' : t.id === 'ai' ? 'ai' : t.id === 'effects' ? 'effects' : 'properties')}
            className={cn('relative flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[10px] transition-colors', (rightTab === 'properties' && t.id === 'design') || rightTab === t.id ? 'bg-violet-500/12 text-violet-300' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
            <t.icon className="h-3 w-3" /><span className="hidden xl:inline">{t.label}</span>
          </button>
        ))}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2.5">
          {rightTab === 'ai' ? <AISuggestions layer={layer} />
            : !layer ? <CanvasPanel project={project} />
            : rightTab === 'animate' ? <AnimatePanel layer={layer} />
            : rightTab === 'effects' ? <EffectsDetail layer={layer} />
            : <DesignPanel layer={layer} resolved={resolved!} />}
        </div>
      </ScrollArea>
      <div className="border-t border-border/60 p-2">
        <Button
          variant="soft" size="sm" className="w-full justify-start gap-1.5 text-[10px]"
          onClick={() => { useAgent.getState().setDraftPrompt(layer ? `Refine the selected layer "${layer.name}" — improve its composition, typography and motion.` : 'Give me three fresh directions for this project.'); useEditor.getState().toggle('aiOpen'); }}
        >
          <Sparkles className="h-3 w-3 text-violet-400" /> Ask AI about {layer ? 'this layer' : 'the canvas'}
        </Button>
      </div>
    </aside>
  );
}

// ── shared controls ─────────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true, action }: { title: string; children: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="mb-2 border-b border-border/50 pb-2 last:border-b-0">
      <div className="flex items-center gap-1 py-1">
        <button onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-1 text-left">
          <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform', !open && '-rotate-90')} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        </button>
        {action}
      </div>
      {open && <div className="space-y-1.5 pt-1">{children}</div>}
    </section>
  );
}

function NumberField({ label, value, onChange, min = -100000, max = 100000, step = 1, suffix, onFocus, keyframe, onToggleKeyframe, className }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string;
  onFocus?: () => void; keyframe?: boolean; onToggleKeyframe?: () => void; className?: string;
}) {
  const [draft, setDraft] = React.useState(String(Math.round(value * 100) / 100));
  const dragging = React.useRef<{ startX: number; startValue: number } | null>(null);
  React.useEffect(() => { setDraft(String(Math.round(value * 100) / 100)); }, [value]);

  React.useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragging.current.startX;
      const next = clamp(dragging.current.startValue + dx * step * (e.shiftKey ? 10 : 1), min, max);
      onChange(Math.round(next * 100) / 100);
    };
    const up = () => { dragging.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [onChange, min, max, step]);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span
        onPointerDown={(e) => { dragging.current = { startX: e.clientX, startValue: value }; onFocus?.(); }}
        className="w-8 shrink-0 cursor-ew-resize select-none text-[9.5px] text-muted-foreground hover:text-foreground"
        title="Drag to scrub"
      >{label}</span>
      <div className="relative flex-1">
        <Input
          value={draft}
          onFocus={() => onFocus?.()}
          onChange={(e) => { setDraft(e.target.value); const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(clamp(n, min, max)); }}
          onBlur={() => setDraft(String(Math.round(value * 100) / 100))}
          inputMode="decimal"
          className="h-6 rounded-md px-1.5 pr-4 font-mono text-[10px] tabular"
          aria-label={label}
        />
        {suffix && <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground/60">{suffix}</span>}
      </div>
      {onToggleKeyframe && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={onToggleKeyframe} className={cn('shrink-0 rounded p-0.5 transition-colors', keyframe ? 'text-cyan-400' : 'text-muted-foreground/40 hover:text-foreground')} aria-label={`Keyframe ${label}`}>
              <Diamond className={cn('h-2.5 w-2.5', keyframe && 'fill-current')} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{keyframe ? 'Remove keyframe at playhead' : 'Add keyframe at playhead'}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function ColorField({ color, gradient: g, onChange, onGradientChange, label = 'Fill' }: { color: string; gradient?: Gradient | null; onChange: (c: string) => void; onGradientChange: (g: Gradient | null) => void; label?: string }) {
  const isGradient = !!g;
  const preview = isGradient && g ? `linear-gradient(${g.angle ?? 135}deg, ${g.stops.map((s) => s.color).join(', ')})` : color;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex w-full items-center gap-1.5 rounded-md border border-border/70 bg-background/40 px-1.5 py-1 text-left transition-colors hover:border-violet-500/40">
          <span className="h-4 w-4 shrink-0 rounded-[3px] border border-white/20" style={{ background: preview }} />
          <span className="flex-1 font-mono text-[9.5px] text-muted-foreground">{isGradient ? `${g!.type} gradient` : color.toUpperCase()}</span>
          <span className="text-[8px] text-muted-foreground/60">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2.5" align="end">
        <Segmented size="xs" value={isGradient ? 'gradient' : 'solid'} onChange={(v) => {
          if (v === 'solid') onGradientChange(null);
          else onGradientChange(g ?? { type: 'linear', angle: 135, stops: [{ offset: 0, color }, { offset: 1, color: '#22d3ee' }] });
        }} options={[{ value: 'solid', label: 'Solid' }, { value: 'gradient', label: 'Gradient' }]} />
        {!isGradient ? (
          <div className="mt-2 space-y-1.5">
            <input type="color" value={color} onChange={(e) => onChange(e.target.value)} className="h-8 w-full cursor-pointer rounded border border-border bg-transparent" aria-label="Fill colour" />
            <Input value={color} onChange={(e) => onChange(e.target.value)} className="h-7 font-mono text-[10px]" />
            <div className="grid grid-cols-5 gap-1">
              {PALETTES[0].colors.concat(PALETTES[3].colors).map((c) => <button key={c} onClick={() => onChange(c)} className="aspect-square rounded border border-white/10" style={{ background: c }} aria-label={c} />)}
            </div>
          </div>
        ) : (
          <GradientEditor gradient={g!} onChange={onGradientChange} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function GradientEditor({ gradient: g, onChange }: { gradient: Gradient; onChange: (g: Gradient) => void }) {
  return (
    <div className="mt-2 space-y-2">
      <Segmented size="xs" value={g.type} onChange={(v) => onChange({ ...g, type: v })} options={[{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }, { value: 'conic', label: 'Conic' }]} />
      {g.type === 'linear' && (
        <label className="flex items-center justify-between gap-2 text-[9.5px] text-muted-foreground">Angle
          <input type="number" value={g.angle ?? 135} onChange={(e) => onChange({ ...g, angle: Number(e.target.value) })} className="h-6 w-16 rounded border border-border bg-background/50 px-1 text-right font-mono text-[10px]" />
        </label>
      )}
      <div className="h-5 rounded border border-border" style={{ background: `linear-gradient(90deg, ${g.stops.map((s) => `${s.color} ${s.offset * 100}%`).join(', ')})` }} />
      <div className="space-y-1.5">
        {g.stops.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input type="color" value={s.color} onChange={(e) => { const stops = g.stops.slice(); stops[i] = { ...s, color: e.target.value }; onChange({ ...g, stops }); }} className="h-5 w-5 cursor-pointer rounded border border-border bg-transparent" aria-label={`Stop ${i + 1}`} />
            <Slider value={[s.offset]} min={0} max={1} step={0.01} onValueChange={([v]) => { const stops = g.stops.slice(); stops[i] = { ...s, offset: v }; onChange({ ...g, stops }); }} className="flex-1" aria-label={`Stop ${i + 1} position`} />
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <Button variant="outline" size="xs" className="flex-1" onClick={() => onChange({ ...g, stops: [...g.stops, { offset: 0.5, color: '#e879f9' }].sort((a, b) => a.offset - b.offset) })}><Plus className="h-2.5 w-2.5" /> Stop</Button>
        {g.stops.length > 2 && <Button variant="ghost" size="xs" onClick={() => onChange({ ...g, stops: g.stops.slice(0, -1) })}><Trash2 className="h-2.5 w-2.5" /></Button>}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {PALETTES.slice(0, 8).map((p) => (
          <button key={p.name} onClick={() => onChange({ ...g, stops: [{ offset: 0, color: p.colors[0] }, { offset: 1, color: p.colors[1] }] })} className="h-3 rounded" style={{ background: `linear-gradient(90deg,${p.colors[0]},${p.colors[1]})` }} title={p.name} aria-label={p.name} />
        ))}
      </div>
    </div>
  );
}

function KeyframeRow({ layer, prop, label, value, onChange, min, max, step, suffix }: {
  layer: Layer; prop: AnimatableProp; label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string;
}) {
  const time = useEditor((s) => s.time);
  const toggleKeyframe = useEditor((s) => s.toggleKeyframe);
  const pushHistory = useEditor((s) => s.pushHistory);
  const hasChannel = (layer.keyframes[prop]?.length ?? 0) > 0;
  const atPlayhead = (layer.keyframes[prop] ?? []).some((k) => Math.abs(k.time - time) < 0.03);
  return (
    <NumberField label={label} value={value} onChange={onChange} min={min} max={max} step={step} suffix={suffix}
      keyframe={atPlayhead} onToggleKeyframe={() => toggleKeyframe(layer.id, prop)} onFocus={pushHistory} />
  );
}

// ── canvas (no selection) ────────────────────────────────────────────────────
function CanvasPanel({ project }: { project: ReturnType<typeof useEditor.getState>['project'] }) {
  const patchProject = useEditor((s) => s.patchProject);
  const setBackground = useEditor((s) => s.setBackground);
  const showGrid = useEditor((s) => s.showGrid);
  const showGuides = useEditor((s) => s.showGuides);
  const showSafe = useEditor((s) => s.showSafe);
  const snap = useEditor((s) => s.snap);
  const toggle = useEditor((s) => s.toggle);
  const setDuration = useEditor((s) => s.setDuration);

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/12 text-violet-300"><Layers className="h-3.5 w-3.5" /></div>
        <div><p className="text-[11px] font-medium">Composition</p><p className="text-[9px] text-muted-foreground">No layer selected</p></div>
      </div>
      <Section title="Canvas">
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(ASPECTS) as (keyof typeof ASPECTS)[]).map((a) => (
            <button key={a} onClick={() => patchProject({ width: ASPECTS[a].w, height: ASPECTS[a].h })}
              className={cn('rounded-md border px-1 py-1 text-[9px] transition-colors', project.width === ASPECTS[a].w && project.height === ASPECTS[a].h ? 'border-violet-500/50 bg-violet-500/15 text-violet-300' : 'border-border/60 text-muted-foreground hover:text-foreground')}>{a}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="W" value={project.width} onChange={(v) => patchProject({ width: Math.round(clamp(v, 64, 8192)) })} min={64} max={8192} />
          <NumberField label="H" value={project.height} onChange={(v) => patchProject({ height: Math.round(clamp(v, 64, 8192)) })} min={64} max={8192} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="Dur" value={project.duration} onChange={(v) => setDuration(v)} min={0.5} max={600} step={0.5} suffix="s" />
          <NumberField label="FPS" value={project.fps} onChange={(v) => patchProject({ fps: Math.round(clamp(v, 1, 120)) })} min={1} max={120} />
        </div>
      </Section>
      <Section title="Background">
        <ColorField color={project.background} gradient={project.backgroundGradient} onChange={(c) => setBackground(c, null)} onGradientChange={(g) => setBackground(project.background, g)} label="BG" />
      </Section>
      <Section title="View">
        <ToggleRow label="Grid" checked={showGrid} onChange={() => toggle('showGrid')} shortcut="⇧G" />
        <ToggleRow label="Centre guides" checked={showGuides} onChange={() => toggle('showGuides')} />
        <ToggleRow label="Safe areas" checked={showSafe} onChange={() => toggle('showSafe')} />
        <ToggleRow label="Snapping" checked={snap} onChange={() => toggle('snap')} />
      </Section>
      <div className="rounded-lg border border-border/60 bg-muted/20 p-2 text-[9px] leading-relaxed text-muted-foreground">
        <MousePointer2 className="mr-1 inline h-2.5 w-2.5" /> Tip: press <Kbd>R</Kbd> to draw a shape, <Kbd>T</Kbd> for text, <Kbd>Space</Kbd> to play, <Kbd>⌘K</Kbd> for every command.
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange, shortcut }: { label: string; checked: boolean; onChange: () => void; shortcut?: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">{shortcut && <Kbd>{shortcut}</Kbd>}<Switch checked={checked} onCheckedChange={onChange} aria-label={label} /></div>
    </div>
  );
}

// ── design ─────────────────────────────────────────────────────────────────
function DesignPanel({ layer, resolved }: { layer: Layer; resolved: ReturnType<typeof resolveLayer> }) {
  const updateLayer = useEditor((s) => s.updateLayer);
  const pushHistory = useEditor((s) => s.pushHistory);
  const alignSelected = useEditor((s) => s.alignSelected);
  const distributeSelected = useEditor((s) => s.distributeSelected);
  const selection = useEditor((s) => s.selection);
  const set = (patch: Partial<Layer>) => updateLayer(layer.id, patch);

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/12 text-violet-300">
          {layer.type === 'text' ? <TypeIcon className="h-3.5 w-3.5" /> : layer.type === 'image' ? <ImageIcon className="h-3.5 w-3.5" /> : <Shapes className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium">{layer.name}</p>
          <p className="text-[9px] capitalize text-muted-foreground">{layer.type}{layer.shape ? ` · ${layer.shape}` : ''} · {layer.blendMode}</p>
        </div>
        <button onClick={() => set({ visible: !layer.visible })} className={cn('rounded p-1', layer.visible ? 'text-muted-foreground hover:text-foreground' : 'text-red-400')} aria-label="Toggle visibility"><Eye className="h-3 w-3" /></button>
      </div>

      <Section title="Transform">
        <div className="grid grid-cols-2 gap-1.5">
          <KeyframeRow layer={layer} prop="x" label="X" value={Math.round(resolved.x)} onChange={(v) => set({ x: v })} />
          <KeyframeRow layer={layer} prop="y" label="Y" value={Math.round(resolved.y)} onChange={(v) => set({ y: v })} />
          <KeyframeRow layer={layer} prop="w" label="W" value={Math.round(resolved.w)} onChange={(v) => set({ w: Math.max(1, v) })} min={1} />
          <KeyframeRow layer={layer} prop="h" label="H" value={Math.round(resolved.h)} onChange={(v) => set({ h: Math.max(1, v) })} min={1} />
          <KeyframeRow layer={layer} prop="rotation" label="Rot" value={Math.round(resolved.rotation)} onChange={(v) => set({ rotation: v })} suffix="°" />
          <div className="flex items-center gap-1">
            <span className="w-8 text-[9.5px] text-muted-foreground">Opac</span>
            <Slider value={[resolved.opacity * 100]} min={0} max={100} step={1} onValueChange={([v]) => set({ opacity: v / 100 })} aria-label="Opacity" className="flex-1" />
          </div>
          <KeyframeRow layer={layer} prop="scaleX" label="SX" value={resolved.scaleX} onChange={(v) => set({ scaleX: v })} step={0.01} />
          <KeyframeRow layer={layer} prop="scaleY" label="SY" value={resolved.scaleY} onChange={(v) => set({ scaleY: v })} step={0.01} />
        </div>
        <div className="mt-1 flex items-center gap-1">
          <button onClick={() => set({ anchorX: layer.anchorX === 0.5 ? 0 : 0.5, anchorY: layer.anchorY === 0.5 ? 0 : 0.5 })} className="flex-1 rounded-md border border-border/60 py-0.5 text-[9px] text-muted-foreground hover:text-foreground">Anchor {layer.anchorX === 0.5 ? 'centre' : 'top-left'}</button>
          <Select value={layer.blendMode} onChange={(e) => set({ blendMode: e.target.value as BlendMode })} containerClassName="flex-1">
            {['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'soft-light', 'hard-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'].map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </div>
        <div className="mt-1 flex items-center justify-between rounded-md border border-border/50 bg-background/30 px-1 py-0.5">
          {[
            { m: 'left' as const, icon: AlignHorizontalJustifyStart }, { m: 'hcenter' as const, icon: AlignHorizontalJustifyCenter }, { m: 'right' as const, icon: AlignHorizontalJustifyEnd },
            { m: 'top' as const, icon: AlignVerticalJustifyStart }, { m: 'vcenter' as const, icon: AlignVerticalJustifyCenter }, { m: 'bottom' as const, icon: AlignVerticalJustifyEnd },
          ].map(({ m, icon: Icon }) => (
            <Tooltip key={m}><TooltipTrigger asChild><button onClick={() => alignSelected(m)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Align ${m}`}><Icon className="h-3 w-3" /></button></TooltipTrigger><TooltipContent>Align {m}</TooltipContent></Tooltip>
          ))}
          <button onClick={() => distributeSelected('horizontal')} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Distribute horizontally"><ArrowRight className="h-3 w-3" /></button>
          <span className="font-mono text-[8px] text-muted-foreground/60">{selection.length}×</span>
        </div>
      </Section>

      <Section title="Appearance">
        <ColorField color={layer.fill} gradient={layer.fillGradient} onChange={(c) => set({ fill: c, fillGradient: null })} onGradientChange={(g) => set({ fillGradient: g })} />
        <div className="grid grid-cols-2 gap-1.5">
          <KeyframeRow layer={layer} prop="cornerRadius" label="Radius" value={Math.round(resolved.cornerRadius)} onChange={(v) => set({ radius: v })} min={0} />
          <div className="flex items-center gap-1">
            <span className="w-8 text-[9.5px] text-muted-foreground">Stroke</span>
            <input type="color" value={layer.stroke ?? '#ffffff'} onChange={(e) => set({ stroke: e.target.value })} className="h-5 w-6 cursor-pointer rounded border border-border bg-transparent" aria-label="Stroke colour" />
            <Input value={layer.strokeWidth ?? 0} onChange={(e) => set({ strokeWidth: Number(e.target.value) || 0 })} className="h-6 w-full px-1 font-mono text-[10px]" aria-label="Stroke width" />
          </div>
        </div>
        <ToggleRow label="Mask layer" checked={!!layer.mask} onChange={() => set({ mask: layer.mask ? null : { type: 'rect', feather: 0 } })} />
        {layer.mask && (
          <div className="flex items-center gap-1.5">
            <Select value={layer.mask.type} onChange={(e) => set({ mask: { ...layer.mask!, type: e.target.value as 'rect' } })} containerClassName="flex-1">
              {['rect', 'ellipse', 'gradient'].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Input type="number" value={layer.mask.feather} onChange={(e) => set({ mask: { ...layer.mask!, feather: Number(e.target.value) || 0 } })} className="h-6 w-14 font-mono text-[10px]" aria-label="Mask feather" />
          </div>
        )}
      </Section>

      {layer.type === 'text' && layer.text && <TextSection layer={layer} />}
      {(layer.type === 'image' || layer.type === 'video') && <MediaSection layer={layer} />}
      {layer.type === 'shape' && <ShapeSection layer={layer} />}
      {layer.type === 'particles' && layer.particles && (
        <Section title="Particles">
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="Count" value={layer.particles.count} onChange={(v) => set({ particles: { ...layer.particles!, count: Math.round(clamp(v, 1, 600)) } })} min={1} max={600} />
            <NumberField label="Size" value={layer.particles.size} onChange={(v) => set({ particles: { ...layer.particles!, size: v } })} min={1} max={50} />
            <NumberField label="Speed" value={layer.particles.speed} onChange={(v) => set({ particles: { ...layer.particles!, speed: v } })} step={0.05} />
            <NumberField label="Spread" value={layer.particles.spread} onChange={(v) => set({ particles: { ...layer.particles!, spread: v } })} />
          </div>
          <ColorField color={layer.particles.color} onChange={(c) => set({ particles: { ...layer.particles!, color: c } })} onGradientChange={() => {}} label="Tint" />
        </Section>
      )}

      <Section title="Timing">
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="In" value={layer.startTime} onChange={(v) => set({ startTime: clamp(v, 0, layer.endTime - 0.1) })} step={0.1} suffix="s" />
          <NumberField label="Out" value={layer.endTime} onChange={(v) => set({ endTime: clamp(v, layer.startTime + 0.1, 600) })} step={0.1} suffix="s" />
        </div>
      </Section>
    </div>
  );
}

function TextSection({ layer }: { layer: Layer }) {
  const updateLayer = useEditor((s) => s.updateLayer);
  const setText = (patch: Partial<NonNullable<Layer['text']>>) => updateLayer(layer.id, { text: { ...layer.text!, ...patch } });
  const t = layer.text!;
  return (
    <Section title="Typography" action={<Badge variant="secondary" className="text-[8px]">{t.fontFamily}</Badge>}>
      <Textarea value={t.content} onChange={(e) => setText({ content: e.target.value })} rows={2} className="text-[10.5px]" aria-label="Text content" />
      <Select value={t.fontFamily} onChange={(e) => setText({ fontFamily: e.target.value })}>
        {FONTS.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-1.5">
        <NumberField label="Size" value={t.fontSize} onChange={(v) => setText({ fontSize: Math.max(4, v) })} min={4} />
        <Select value={String(t.fontWeight)} onChange={(e) => setText({ fontWeight: Number(e.target.value) })}>
          {[300, 400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
        </Select>
        <NumberField label="Line" value={t.lineHeight} onChange={(v) => setText({ lineHeight: v })} step={0.05} min={0.6} max={3} />
        <NumberField label="Track" value={t.letterSpacing} onChange={(v) => setText({ letterSpacing: v })} step={0.1} />
      </div>
      <div className="flex items-center gap-1">
        <Segmented size="xs" value={t.align} onChange={(v) => setText({ align: v })} options={[{ value: 'left', label: 'L' }, { value: 'center', label: 'C' }, { value: 'right', label: 'R' }]} />
        <button onClick={() => setText({ uppercase: !t.uppercase })} className={cn('rounded border px-1.5 py-0.5 text-[9px]', t.uppercase ? 'border-violet-500/50 bg-violet-500/15 text-violet-300' : 'border-border text-muted-foreground')}>AA</button>
        <button onClick={() => setText({ fontStyle: t.fontStyle === 'italic' ? 'normal' : 'italic' })} className={cn('rounded border px-1.5 py-0.5 text-[9px] italic', t.fontStyle === 'italic' ? 'border-violet-500/50 bg-violet-500/15 text-violet-300' : 'border-border text-muted-foreground')}>It</button>
        <button onClick={() => setText({ underline: !t.underline })} className={cn('rounded border px-1.5 py-0.5 text-[9px] underline', t.underline ? 'border-violet-500/50 bg-violet-500/15 text-violet-300' : 'border-border text-muted-foreground')}>U</button>
      </div>
      <ColorField color={t.color} gradient={t.gradient} onChange={(c) => setText({ color: c, gradient: null })} onGradientChange={(g) => setText({ gradient: g })} label="Text" />
      <div className="mt-1">
        <Label className="mb-0.5 block">Text animator</Label>
        <div className="grid grid-cols-2 gap-1">
          {(['typewriter', 'wordReveal', 'charRise', 'slideUp', 'blurIn', 'scaleIn'] as TextAnimator['type'][]).map((a) => (
            <button key={a} onClick={() => setText({ animator: t.animator?.type === a ? null : { type: a, duration: 0.9, stagger: 0.04, delay: 0.1 } })}
              className={cn('rounded border px-1 py-0.5 text-[8.5px] capitalize', t.animator?.type === a ? 'border-violet-500/50 bg-violet-500/15 text-violet-300' : 'border-border/60 text-muted-foreground hover:text-foreground')}>
              {a.replace(/([A-Z])/g, ' $1').toLowerCase()}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

function MediaSection({ layer }: { layer: Layer }) {
  const updateLayer = useEditor((s) => s.updateLayer);
  const m = layer.media;
  return (
    <Section title="Media">
      <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 p-1.5">
        {layer.media?.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={layer.media.src} alt="Layer media" className="h-8 w-8 rounded object-cover" />
        ) : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground">{layer.media?.src ? layer.media.src.slice(0, 28) : 'No source'}</span>
        <label className="cursor-pointer rounded border border-border px-1.5 py-0.5 text-[8.5px] hover:bg-accent">Replace
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const src = await fileToDataUrl(f); updateLayer(layer.id, { media: { ...layer.media!, src } }); toast.success('Media replaced'); }} />
        </label>
      </div>
      {m && (
        <>
          <Segmented size="xs" value={m.fit} onChange={(v) => updateLayer(layer.id, { media: { ...m, fit: v } })} options={[{ value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Contain' }, { value: 'fill', label: 'Fill' }]} />
          <div className="grid grid-cols-2 gap-1.5">
            <NumberField label="Radius" value={layer.radius ?? 0} onChange={(v) => updateLayer(layer.id, { radius: v })} min={0} />
            <NumberField label="Opacity" value={Math.round((m.opacity ?? 1) * 100)} onChange={(v) => updateLayer(layer.id, { media: { ...m, opacity: v / 100 } })} min={0} max={100} suffix="%" />
          </div>
          {layer.type === 'video' && (
            <div className="grid grid-cols-2 gap-1.5">
              <NumberField label="In" value={m.trimStart ?? 0} onChange={(v) => updateLayer(layer.id, { media: { ...m, trimStart: v } })} step={0.1} suffix="s" />
              <NumberField label="Rate" value={m.playbackRate ?? 1} onChange={(v) => updateLayer(layer.id, { media: { ...m, playbackRate: v } })} step={0.05} suffix="×" />
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function ShapeSection({ layer }: { layer: Layer }) {
  const updateLayer = useEditor((s) => s.updateLayer);
  return (
    <Section title="Shape" defaultOpen={false}>
      <Select value={layer.shape ?? 'rect'} onChange={(e) => updateLayer(layer.id, { shape: e.target.value as ShapeKind })}>
        {['rect', 'roundedRect', 'ellipse', 'polygon', 'star', 'triangle', 'diamond', 'hexagon', 'line', 'arrow'].map((s) => <option key={s} value={s}>{s}</option>)}
      </Select>
      {(layer.shape === 'polygon' || layer.shape === 'star') && <NumberField label="Points" value={layer.points ?? 5} onChange={(v) => updateLayer(layer.id, { points: Math.round(clamp(v, 3, 30)) })} min={3} max={30} />}
      {layer.shape === 'star' && <NumberField label="Inner" value={layer.innerRadius ?? 0.45} onChange={(v) => updateLayer(layer.id, { innerRadius: clamp(v, 0.05, 0.95) })} step={0.01} min={0.05} max={0.95} />}
    </Section>
  );
}

// ── animate ────────────────────────────────────────────────────────────────
function AnimatePanel({ layer }: { layer: Layer }) {
  const time = useEditor((s) => s.time);
  const keyframeProp = useEditor((s) => s.keyframeProp);
  const clearPropertyKeyframes = useEditor((s) => s.clearPropertyKeyframes);
  const setLayerEasing = useEditor((s) => s.setLayerEasing);
  const setTime = useEditor((s) => s.setTime);
  const updateLayer = useEditor((s) => s.updateLayer);
  const duration = useEditor((s) => s.project.duration);
  const resolved = resolveLayer(layer, time);

  const addMotionPath = () => {
    const cx = resolved.x + resolved.w / 2, cy = resolved.y + resolved.h / 2;
    const radius = 140;
    const kfs = Array.from({ length: 5 }, (_, i) => {
      const angle = (i / 4) * Math.PI * 2;
      return { id: `kf_${i}`, time: (i / 4) * Math.min(duration, 4), value: Math.round(cx + Math.cos(angle) * radius), easing: { type: 'linear' as const } };
    });
    updateLayer(layer.id, { motionPath: { points: Array.from({ length: 16 }, (_, i) => [cx - radius + Math.cos((i / 16) * Math.PI * 2) * radius, cy + Math.sin((i / 16) * Math.PI * 2) * radius] as [number, number]), orient: false, progress: 0 }, keyframes: { ...layer.keyframes, x: kfs, y: kfs.map((k, i) => ({ ...k, value: Math.round(cy + Math.sin((i / 4) * Math.PI * 2) * radius) })) } });
    toast.success('Circular motion added');
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/12 text-cyan-300"><Zap className="h-3.5 w-3.5" /></div>
        <div className="flex-1"><p className="text-[11px] font-medium">Motion · {layer.name}</p><p className="text-[9px] text-muted-foreground">{Object.values(layer.keyframes).reduce((a, k) => a + (k?.length ?? 0), 0)} keyframes</p></div>
      </div>

      <Section title="Channels">
        <div className="space-y-1">
          {ANIM_PROPS.map(({ prop, label }) => {
            const keys = layer.keyframes[prop] ?? [];
            return (
              <div key={prop} className={cn('flex items-center gap-1.5 rounded-md border px-1.5 py-1', keys.length ? 'border-cyan-500/25 bg-cyan-500/[0.05]' : 'border-border/50')}>
                <span className="w-12 text-[9.5px] text-muted-foreground">{label}</span>
                <div className="flex flex-1 flex-wrap gap-0.5">
                  {keys.length ? keys.slice(0, 6).map((k) => (
                    <button key={k.id} onClick={() => setTime(k.time)} className="h-1.5 w-1.5 rotate-45 rounded-[1px] bg-cyan-400/80 hover:scale-125" title={`${k.time.toFixed(2)}s`} aria-label={`Go to ${k.time}s`} />
                  )) : <span className="text-[8.5px] text-muted-foreground/50">static</span>}
                </div>
                {keys.length > 0 && (
                  <Select value={typeof keys[0].easing === 'object' ? keys[0].easing?.type ?? 'easeInOut' : 'easeInOut'} onChange={(e) => setLayerEasing(layer.id, prop, e.target.value)} containerClassName="w-[74px]">
                    {EASING_PRESETS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </Select>
                )}
                <button onClick={() => keyframeProp(layer.id, prop)} className="rounded p-0.5 text-muted-foreground hover:text-cyan-400" aria-label={`Keyframe ${label}`}><Diamond className="h-2.5 w-2.5" /></button>
                {keys.length > 0 && <button onClick={() => clearPropertyKeyframes(layer.id, prop)} className="rounded p-0.5 text-muted-foreground/50 hover:text-red-400" aria-label={`Clear ${label}`}><Trash2 className="h-2.5 w-2.5" /></button>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Motion path">
        {layer.motionPath ? (
          <>
            <div className="flex items-center justify-between text-[9.5px]"><span className="text-muted-foreground">{layer.motionPath.points.length} points</span>
              <button onClick={() => updateLayer(layer.id, { motionPath: null })} className="text-red-400">Remove</button>
            </div>
            <div className="flex items-center gap-1.5"><span className="text-[9px] text-muted-foreground">Progress</span>
              <input type="range" min={0} max={1} step={0.01} value={layer.motionPath.progress ?? 0} onChange={(e) => updateLayer(layer.id, { motionPath: { ...layer.motionPath!, progress: Number(e.target.value) } })} className="prism-range" aria-label="Motion path progress" />
            </div>
            <ToggleRow label="Orient to path" checked={!!layer.motionPath.orient} onChange={() => updateLayer(layer.id, { motionPath: { ...layer.motionPath!, orient: !layer.motionPath!.orient } })} />
          </>
        ) : (
          <Button variant="outline" size="sm" className="w-full gap-1" onClick={addMotionPath}><RotateCw className="h-3 w-3" /> Add circular path</Button>
        )}
      </Section>

      <Section title="Presets">
        <div className="grid grid-cols-2 gap-1">
          {ANIMATION_PRESETS.filter((p) => p.group === 'In' || p.group === 'Loop').map((p) => (
            <button key={p.id} onClick={() => { const { keyframes, text } = applyPresetToLayer(layer, p.id, duration); updateLayer(layer.id, { keyframes, ...(text ? { text } : {}) }); toast.success(`${p.name} applied`); }}
              className="rounded border border-border/60 px-1 py-1 text-[9px] text-muted-foreground transition-colors hover:border-violet-500/40 hover:text-violet-300">{p.icon} {p.name}</button>
          ))}
        </div>
      </Section>

      <div className="rounded-md border border-border/50 bg-muted/20 p-2 text-[9px] leading-relaxed text-muted-foreground">
        Easing is stored per keyframe. Click any channel’s easing dropdown to change the whole curve, or open the timeline diamond for a single segment.
      </div>
    </div>
  );
}

// ── effects detail ─────────────────────────────────────────────────────────
function EffectsDetail({ layer }: { layer: Layer }) {
  const addEffect = useEditor((s) => s.addEffect);
  const removeEffect = useEditor((s) => s.removeEffect);
  const updateEffect = useEditor((s) => s.updateEffect);
  const ALL: EffectType[] = ['blur', 'glow', 'shadow', 'bloom', 'brightness', 'contrast', 'saturate', 'hue', 'grayscale', 'sepia', 'invert', 'chromatic', 'grain', 'noise', 'vignette', 'scanlines', 'lightSweep', 'pixelate'];
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-500/12 text-fuchsia-300"><Sparkles className="h-3.5 w-3.5" /></div>
        <div className="flex-1"><p className="text-[11px] font-medium">Effects · {layer.name}</p><p className="text-[9px] text-muted-foreground">{layer.effects.length} applied</p></div>
      </div>
      <Section title="Add effect">
        <div className="grid grid-cols-2 gap-1">
          {ALL.filter((t) => !layer.effects.some((e) => e.type === t)).map((t) => (
            <button key={t} onClick={() => addEffect(layer.id, t)} className="flex items-center justify-between rounded border border-border/60 px-1.5 py-1 text-[9px] capitalize text-muted-foreground hover:border-violet-500/40 hover:text-foreground">{t}<Plus className="h-2.5 w-2.5" /></button>
          ))}
        </div>
      </Section>
      <Section title="Applied">
        {layer.effects.length === 0 ? <p className="rounded border border-border/50 bg-muted/20 px-2 py-2 text-[9px] text-muted-foreground">No effects. Try Film Grain or Bloom for instant texture.</p> : (
          <div className="space-y-1.5">
            {layer.effects.map((fx) => (
              <div key={fx.id} className="rounded-lg border border-border/60 bg-background/40 p-2">
                <div className="mb-1 flex items-center gap-1.5">
                  <Switch checked={fx.enabled} onCheckedChange={(v) => updateEffect(layer.id, fx.id, { enabled: v })} className="scale-[0.8]" aria-label={`Enable ${fx.type}`} />
                  <span className="flex-1 text-[10px] capitalize">{fx.type}</span>
                  <span className="font-mono text-[8.5px] text-muted-foreground">{Math.round(fx.amount)}</span>
                  <button onClick={() => removeEffect(layer.id, fx.id)} className="text-muted-foreground hover:text-red-400" aria-label={`Remove ${fx.type}`}><Trash2 className="h-2.5 w-2.5" /></button>
                </div>
                <Slider value={[fx.amount]} min={0} max={100} step={1} onValueChange={([v]) => updateEffect(layer.id, fx.id, { amount: v })} aria-label={`${fx.type} amount`} />
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── AI suggestions ─────────────────────────────────────────────────────────
function AISuggestions({ layer }: { layer: Layer | null }) {
  const setDraftPrompt = useAgent((s) => s.setDraftPrompt);
  const runLog = useAgent((s) => s.runLog);
  const messages = useAgent((s) => s.messages);
  const open = useEditor((s) => s.aiOpen);
  const toggle = useEditor((s) => s.toggle);

  const suggestions = layer ? [
    { icon: Zap, label: 'Animate this layer', prompt: `Animate "${layer.name}" with a polished entrance — kinetic typography, spring easing and a matching accent element.` },
    { icon: Palette, label: 'Suggest a palette', prompt: `Suggest a 5-colour palette for the current scene, keeping "${layer.name}" as the focal layer. Apply it to the canvas.` },
    { icon: Sparkles, label: 'Add depth', prompt: `Add depth and atmosphere around "${layer.name}" — particles, glow, grain and a subtle vignette.` },
    { icon: ArrowUpRight, label: 'Improve hierarchy', prompt: 'Improve the visual hierarchy of the canvas: spacing, scale contrast and alignment. Keep every existing layer editable.' },
  ] : [
    { icon: Sparkles, label: 'Draft a poster', prompt: 'Design a bold editorial poster for a motion-design conference in Addis Ababa — warm palette, oversized serif headline, 4:5.' },
    { icon: Film, label: 'Make an intro', prompt: 'Create a 6-second 16:9 logo reveal intro for Prism Studio — violet/cyan gradient, geometric mark, kinetic wordmark.' },
    { icon: Palette, label: 'Build a brand system', prompt: 'Generate a complete brand kit: palette, heading + body fonts, voice and three social templates.' },
    { icon: Clock, label: 'Story sequence', prompt: 'Create a three-scene 9:16 Instagram story sequence for a product launch, with transitions and captions.' },
  ];

  return (
    <div>
      <div className="mb-2 rounded-xl border border-violet-500/25 bg-[linear-gradient(140deg,rgba(139,92,246,.14),rgba(34,211,238,.05))] p-2.5">
        <div className="mb-1 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-violet-300" /><p className="text-[11px] font-medium">Agent suggestions</p></div>
        <p className="text-[9px] leading-relaxed text-muted-foreground">Context-aware starting points. Each opens the agent with a ready prompt.</p>
      </div>
      <div className="space-y-1">
        {suggestions.map((s) => (
          <button key={s.label} onClick={() => { setDraftPrompt(s.prompt); if (!open) toggle('aiOpen'); }}
            className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/[0.06]">
            <s.icon className="h-3 w-3 shrink-0 text-violet-300" />
            <span className="flex-1 text-[10px]">{s.label}</span>
            <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground/50" />
          </button>
        ))}
      </div>

      <Section title="Recent runs">
        {runLog.length === 0 ? <EmptyState icon={<Loader2 className="h-4 w-4" />} title="No agent runs yet" description="Ask the agent to build something — every run is logged here with tools and token usage." /> : (
          <div className="space-y-1">
            {runLog.slice(0, 6).map((r) => (
              <div key={r.id} className="rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  {r.status === 'done' ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : r.status === 'error' ? <XCircle className="h-3 w-3 text-red-400" /> : r.status === 'cancelled' ? <XCircle className="h-3 w-3 text-muted-foreground" /> : <Loader2 className="h-3 w-3 animate-spin text-violet-400" />}
                  <p className="min-w-0 flex-1 truncate text-[9.5px]">{r.prompt}</p>
                </div>
                <p className="mt-0.5 font-mono text-[8px] text-muted-foreground">{r.tools} tools · {r.tokens} tok · {new Date(r.at).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        )}
      </Section>
      {messages.length > 0 && <p className="mt-2 text-center text-[8.5px] text-muted-foreground">{messages.length} messages in this session</p>}
    </div>
  );
}
