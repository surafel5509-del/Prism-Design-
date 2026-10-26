'use client';
import * as React from 'react';
import { useEditor } from '@/lib/store/editor';
import type { Effect, EffectType } from '@/lib/engine/types';
import { ANIMATION_PRESETS, applyPresetToLayer } from '@/lib/engine/presets';
import { EffectPreviewStyles, EffectThumb, MotionPresetGrid } from '@/components/editor/EffectPreviews';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Segmented, Kbd } from '@/components/ui/misc';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Sparkles, Droplets, Sun, Contrast, Palette, Aperture, Zap, Film, ScanLine, CircleDot, Waves,
  Trash2, Plus, Wand2, ArrowUp, ArrowDown, RotateCw, Activity, Layers, Type, Maximize, Eye,
  Thermometer, SlidersHorizontal, Grid2x2, Glasses, Lightbulb, Move3d, Move, Wind, Disc3,
} from 'lucide-react';
import { toast } from 'sonner';

const EFFECTS: { type: EffectType; label: string; amount: number; group: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'blur', label: 'Gaussian Blur', amount: 20, group: 'Focus', icon: Droplets },
  { type: 'bloom', label: 'Bloom', amount: 40, group: 'Focus', icon: Sun },
  { type: 'glow', label: 'Glow', amount: 45, group: 'Focus', icon: Sparkles },
  { type: 'shadow', label: 'Drop Shadow', amount: 30, group: 'Focus', icon: Layers },
  { type: 'dropShadow', label: 'Hard Shadow', amount: 55, group: 'Focus', icon: Layers },
  { type: 'brightness', label: 'Brightness', amount: 20, group: 'Colour', icon: Sun },
  { type: 'contrast', label: 'Contrast', amount: 25, group: 'Colour', icon: Contrast },
  { type: 'saturate', label: 'Saturate', amount: 40, group: 'Colour', icon: Palette },
  { type: 'hue', label: 'Hue Shift', amount: 60, group: 'Colour', icon: Aperture },
  { type: 'grayscale', label: 'Grayscale', amount: 100, group: 'Colour', icon: CircleDot },
  { type: 'sepia', label: 'Sepia', amount: 80, group: 'Colour', icon: Sun },
  { type: 'invert', label: 'Invert', amount: 100, group: 'Colour', icon: Contrast },
  { type: 'duotone', label: 'Duotone', amount: 70, group: 'Colour', icon: Palette },
  { type: 'thermal', label: 'Thermal Map', amount: 60, group: 'Colour', icon: Thermometer },
  { type: 'posterize', label: 'Posterize', amount: 45, group: 'Colour', icon: SlidersHorizontal },
  { type: 'chromatic', label: 'Chromatic', amount: 12, group: 'Stylise', icon: Zap },
  { type: 'grain', label: 'Film Grain', amount: 22, group: 'Stylise', icon: Film },
  { type: 'noise', label: 'Noise', amount: 15, group: 'Stylise', icon: Activity },
  { type: 'vignette', label: 'Vignette', amount: 45, group: 'Stylise', icon: Eye },
  { type: 'scanlines', label: 'Scanlines', amount: 30, group: 'Stylise', icon: ScanLine },
  { type: 'halftone', label: 'Halftone', amount: 40, group: 'Stylise', icon: Grid2x2 },
  { type: 'hologram', label: 'Hologram', amount: 55, group: 'Stylise', icon: Glasses },
  { type: 'vhs', label: 'VHS Tape', amount: 50, group: 'Stylise', icon: Film },
  { type: 'lightSweep', label: 'Light Sweep', amount: 55, group: 'Light', icon: Waves },
  { type: 'spotlight', label: 'Spotlight', amount: 70, group: 'Light', icon: Lightbulb },
  { type: 'pixelate', label: 'Pixelate', amount: 25, group: 'Distort', icon: Maximize },
  { type: 'displacement', label: 'Displace', amount: 30, group: 'Distort', icon: Move3d },
  { type: 'wiggle', label: 'Wiggle', amount: 30, group: 'Motion', icon: Move },
  { type: 'drift', label: 'Drift', amount: 35, group: 'Motion', icon: Wind },
  { type: 'beatPulse', label: 'Beat Pulse', amount: 40, group: 'Motion', icon: Disc3 },
];

const GROUPS = ['All', 'Focus', 'Colour', 'Stylise', 'Light', 'Distort', 'Motion'] as const;

export function EffectsPanel() {
  const selection = useEditor((s) => s.selection);
  const layers = useEditor((s) => s.project.layers);
  const addEffect = useEditor((s) => s.addEffect);
  const updateEffect = useEditor((s) => s.updateEffect);
  const removeEffect = useEditor((s) => s.removeEffect);
  const updateLayer = useEditor((s) => s.updateLayer);
  const setRightTab = useEditor((s) => s.setRightTab);
  const [group, setGroup] = React.useState<(typeof GROUPS)[number]>('All');
  const selected = layers.find((l) => l.id === selection[0]);

  const applyAnimation = (presetId: string) => {
    if (!selection.length) { toast.info('Select a layer first'); return; }
    const preset = ANIMATION_PRESETS.find((p) => p.id === presetId);
    for (const id of selection) {
      const layer = useEditor.getState().project.layers.find((l) => l.id === id);
      if (!layer) continue;
      const { keyframes, text } = applyPresetToLayer(layer, presetId, useEditor.getState().project.duration);
      updateLayer(id, { keyframes, ...(text ? { text } : {}) }, { history: false });
    }
    toast.success(`${preset?.name ?? 'Animation'} applied`, { description: 'Scrub the timeline or press Space to preview.' });
  };

  return (
    <div className="flex h-full flex-col">
      <EffectPreviewStyles />
      <div className="border-b border-border/60 px-2 py-2">
        <p className="panel-title mb-1.5">Effect library</p>
        <div className="flex flex-wrap gap-1">
          {GROUPS.map((g) => (
            <button key={g} onClick={() => setGroup(g)} className={cn('rounded-full border px-1.5 py-0.5 text-[9.5px]', group === g ? 'border-violet-500/50 bg-violet-500/15 text-violet-300' : 'border-border text-muted-foreground hover:text-foreground')}>{g}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {EFFECTS.filter((e) => group === 'All' || e.group === group).map((e) => (
            <button
              key={e.type}
              disabled={!selected}
              onClick={() => { if (selected) { addEffect(selected.id, e.type, e.amount); toast.success(`${e.label} added`, { description: 'Live preview updates on the canvas.' }); } }}
              title={`${e.label} · ${e.group}`}
              className="group relative overflow-hidden rounded-lg border border-border/60 bg-background/30 text-left transition-all hover:-translate-y-0.5 hover:border-violet-500/45 hover:shadow-[0_10px_26px_-18px_rgba(139,92,246,.9)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            >
              <EffectThumb type={e.type} />
              <span className="flex items-center gap-1 px-1.5 py-1">
                <e.icon className="h-2.5 w-2.5 shrink-0 text-violet-300/80" />
                <span className="truncate text-[9px] leading-tight text-foreground/85">{e.label}</span>
              </span>
            </button>
          ))}
        </div>
        {!selected && <p className="mt-2 rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-[9px] text-muted-foreground">Select a layer to add effects.</p>}

        {selected?.effects && selected.effects.length > 0 && (
          <div className="mt-3">
            <p className="panel-title mb-1.5">Active · {selected.name}</p>
            <div className="space-y-1.5">
              {selected.effects.map((fx) => (
                <div key={fx.id} className="rounded-lg border border-border/60 bg-background/40 p-1.5">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Switch checked={fx.enabled} onCheckedChange={(v) => updateEffect(selected.id, fx.id, { enabled: v })} className="scale-[0.8]" aria-label={`Toggle ${fx.type}`} />
                    <span className="flex-1 truncate text-[10px] capitalize">{fx.type}</span>
                    <span className="font-mono text-[8.5px] text-muted-foreground">{Math.round(fx.amount)}</span>
                    <button onClick={() => removeEffect(selected.id, fx.id)} className="text-muted-foreground hover:text-red-400" aria-label={`Remove ${fx.type}`}><Trash2 className="h-2.5 w-2.5" /></button>
                  </div>
                  <Slider value={[fx.amount]} min={0} max={fx.type === 'hue' ? 360 : 100} step={1} onValueChange={([v]) => updateEffect(selected.id, fx.id, { amount: v })} aria-label={`${fx.type} amount`} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="panel-title">Animation presets</p>
            <Badge variant="secondary" className="text-[8px]">{ANIMATION_PRESETS.length}</Badge>
          </div>
          {(['In', 'Out', 'Loop', 'Emphasis'] as const).map((g) => (
            <div key={g} className="mb-1.5">
              <p className="mb-1 text-[8.5px] uppercase tracking-wider text-muted-foreground/70">{g}</p>
              <MotionPresetGrid
                presets={ANIMATION_PRESETS.filter((p) => p.group === g)}
                onApply={applyAnimation}
                disabled={!selected}
                columns={2}
              />
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2 text-[9px] leading-relaxed text-muted-foreground">
          <Wand2 className="mr-1 inline h-2.5 w-2.5" /> Presets write real keyframes you can edit on the timeline. Nothing is baked.
        </div>
      </div>
      <div className="border-t border-border/60 p-2">
        <Button variant="soft" size="sm" className="w-full gap-1" onClick={() => setRightTab('effects')}><Sparkles className="h-3 w-3" /> Advanced controls <Kbd className="ml-auto">⌥E</Kbd></Button>
      </div>
    </div>
  );
}
