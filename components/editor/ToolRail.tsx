'use client';
import * as React from 'react';
import { useEditor, type Tool } from '@/lib/store/editor';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { Kbd, Segmented } from '@/components/ui/misc';
import { LayoutTemplate as Collage, Layers, Image as ImageIcon, Sparkles } from 'lucide-react';
import {
  MousePointer2, Move, Hand, Square, PenTool, Type, ImagePlus, Film, AudioLines,
  ZoomIn, Shapes, Wand2, ChevronRight, Circle, Triangle, Star, Hexagon, Minus, ArrowRight, Diamond, RectangleHorizontal,
  Squircle, Pill, Heart, Cloud, Cross, ChevronsRight, CircleDot, Moon, Sun, Donut, Octagon, Pentagon, Asterisk, Waves, Gem,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createShape, createText, gradient } from '@/lib/engine/factory';
import { toast } from 'sonner';
import type { ShapeKind } from '@/lib/engine/types';
import { PALETTE_LIST } from '@/lib/store/editor';
import { useTheme } from '@/lib/hooks/use-theme';

const SHAPES: { kind: ShapeKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: 'rect', label: 'Rectangle', icon: Square },
  { kind: 'roundedRect', label: 'Rounded rectangle', icon: RectangleHorizontal },
  { kind: 'ellipse', label: 'Ellipse', icon: Circle },
  { kind: 'triangle', label: 'Triangle', icon: Triangle },
  { kind: 'polygon', label: 'Polygon', icon: Hexagon },
  { kind: 'star', label: 'Star', icon: Star },
  { kind: 'diamond', label: 'Diamond', icon: Diamond },
  { kind: 'octagon', label: 'Octagon', icon: Octagon },
  { kind: 'pentagon', label: 'Pentagon', icon: Pentagon },
  { kind: 'capsule', label: 'Capsule', icon: Pill },
  { kind: 'squircle', label: 'Squircle', icon: Squircle },
  { kind: 'ring', label: 'Ring', icon: Donut },
  { kind: 'halfCircle', label: 'Half circle', icon: Moon },
  { kind: 'quarterCircle', label: 'Quarter circle', icon: Sun },
  { kind: 'chevron', label: 'Chevron', icon: ChevronsRight },
  { kind: 'cross', label: 'Cross', icon: Cross },
  { kind: 'parallelogram', label: 'Parallelogram', icon: Gem },
  { kind: 'trapezoid', label: 'Trapezoid', icon: Square },
  { kind: 'burst', label: 'Burst', icon: Asterisk },
  { kind: 'heart', label: 'Heart', icon: Heart },
  { kind: 'cloud', label: 'Cloud', icon: Cloud },
  { kind: 'wave', label: 'Wave', icon: Waves },
  { kind: 'pillArrow', label: 'Pill arrow', icon: ArrowRight },
  { kind: 'line', label: 'Line', icon: Minus },
  { kind: 'arrow', label: 'Arrow', icon: ArrowRight },
];

const TOOLS: { id: Tool; label: string; shortcut: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'move', label: 'Move', shortcut: 'M', icon: Move },
  { id: 'hand', label: 'Hand', shortcut: 'H', icon: Hand },
  { id: 'shape', label: 'Shape', shortcut: 'R', icon: Square },
  { id: 'pen', label: 'Pen', shortcut: 'P', icon: PenTool },
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type },
  { id: 'image', label: 'Image', shortcut: 'I', icon: ImagePlus },
  { id: 'video', label: 'Video', shortcut: '⇧V', icon: Film },
  { id: 'audio', label: 'Audio', shortcut: '⇧A', icon: AudioLines },
  { id: 'zoom', label: 'Zoom', shortcut: 'Z', icon: ZoomIn },
];

export function ToolRail() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const shapeKind = useEditor((s) => s.shapeKind);
  const setShapeKind = useEditor((s) => s.setShapeKind);
  const leftOpen = useEditor((s) => s.leftOpen);
  const leftTab = useEditor((s) => s.leftTab);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  const toggleLeft = useEditor((s) => s.toggle);
  const setRightTab = useEditor((s) => s.setRightTab);
  const aiOpen = useEditor((s) => s.aiOpen);
  const toggleAi = useEditor((s) => s.toggle);
  const addLayer = useEditor((s) => s.addLayer);
  const project = useEditor((s) => s.project);
  const activeShape = SHAPES.find((s) => s.kind === shapeKind) ?? SHAPES[0];

  const insertShape = (kind: ShapeKind) => {
    const colors = PALETTE_LIST[0].colors;
    const l = createShape(kind, { endTime: project.duration, fill: colors[1] });
    l.x = project.width / 2 - l.w / 2;
    l.y = project.height / 2 - l.h / 2;
    addLayer(l);
    toast.success(`Added ${kind}`);
  };

  const insertText = () => {
    const l = createText('Your headline', {
      x: project.width / 2 - 420, y: project.height / 2 - 60, w: 840, h: 140, endTime: project.duration,
    }, { fontSize: Math.round(project.width / 14), fontWeight: 700, color: '#ffffff' });
    addLayer(l);
    setRightTab('properties');
  };

  return (
    <nav aria-label="Tools" className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-border/70 bg-panel/60 py-2">
      <Popover>
        <PopoverTrigger asChild>
          <div>
            <RailButton active={tool === 'shape'} label={`${activeShape.label} (R)`} onClick={() => setTool('shape')}>
              <activeShape.icon className="h-[15px] w-[15px]" />
            </RailButton>
          </div>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-[212px] p-2">
          <p className="panel-title flex items-center justify-between px-1 pb-1.5">Shapes <span className="text-[8.5px] font-normal text-muted-foreground">{SHAPES.length}</span></p>
          <div className="grid max-h-[280px] grid-cols-4 gap-1 overflow-y-auto pr-1">
            {SHAPES.map((s) => (
              <button key={s.kind} onClick={() => { setShapeKind(s.kind); setTool('shape'); insertShape(s.kind); }}
                title={s.label}
                className={cn('flex aspect-square items-center justify-center rounded-md border border-transparent transition-colors hover:border-border hover:bg-accent', shapeKind === s.kind && 'border-violet-500/40 bg-violet-500/10 text-violet-400')}>
                <s.icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-[10px] leading-relaxed text-muted-foreground">Click to add · drag on canvas to draw. Hold <Kbd>⇧</Kbd> for perfect shapes.</p>
        </PopoverContent>
      </Popover>

      {TOOLS.filter((t) => t.id !== 'shape').map((t) => (
        <RailButton
          key={t.id}
          active={tool === t.id}
          label={`${t.label} (${t.shortcut})`}
          onClick={() => {
            setTool(t.id);
            if (t.id === 'text') insertText();
            if (t.id === 'image') setLeftTab('assets');
          }}
        >
          <t.icon className="h-[15px] w-[15px]" />
        </RailButton>
      ))}

      <div className="my-1.5 h-px w-6 bg-border/80" />

      <RailButton active={leftOpen && ['layers'].includes(leftTab)} label="Layers panel" onClick={() => { setLeftTab('layers'); if (!leftOpen) toggleLeft('leftOpen'); }}>
        <Layers className="h-[15px] w-[15px]" />
      </RailButton>
      <RailButton active={leftOpen && leftTab === 'assets'} label="Assets" onClick={() => setLeftTab('assets')}>
        <ImageIcon className="h-[15px] w-[15px]" />
      </RailButton>
      <RailButton active={leftOpen && leftTab === 'templates'} label="Templates" onClick={() => setLeftTab('templates')}>
        <Collage className="h-[15px] w-[15px]" />
      </RailButton>
      <RailButton active={leftOpen && leftTab === 'brand'} label="Brand kit" onClick={() => setLeftTab('brand')}>
        <Wand2 className="h-[15px] w-[15px]" />
      </RailButton>

      <div className="my-1.5 h-px w-6 bg-border/80" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={() => toggleAi('aiOpen')} aria-pressed={aiOpen} aria-label="AI agent panel"
            className={cn('relative flex h-9 w-9 items-center justify-center rounded-lg transition-all', aiOpen ? 'bg-[linear-gradient(135deg,#8b5cf6,#22d3ee)] text-white shadow-glow' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
            <Sparkles className="h-[15px] w-[15px]" />
            {!aiOpen && <span className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full bg-violet-400" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">AI agent <Kbd className="ml-1">⌘J</Kbd></TooltipContent>
      </Tooltip>

      <ColorSwatches className="mt-auto" />
      <ThemeMini />
    </nav>
  );
}

function RailButton({ active, label, onClick, children }: { active?: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={onClick} aria-pressed={active} aria-label={label}
          className={cn('relative flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150',
            active ? 'bg-violet-500/15 text-violet-300' : 'text-muted-foreground/80 hover:bg-accent hover:text-foreground')}>
          {active && <span className="absolute -left-2 h-4 w-[2px] rounded-full bg-[linear-gradient(180deg,#8b5cf6,#22d3ee)]" />}
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function ColorSwatches({ className }: { className?: string }) {
  const selection = useEditor((s) => s.selection);
  const layers = useEditor((s) => s.project.layers);
  const updateLayer = useEditor((s) => s.updateLayer);
  const selected = layers.filter((l) => selection.includes(l.id));
  const current = selected[0]?.fill?.startsWith('#') ? selected[0].fill : '#8b5cf6';
  const [open, setOpen] = React.useState(false);
  const colors = PALETTE_LIST[0].colors.concat(PALETTE_LIST[3].colors);

  const apply = (c: string) => {
    if (!selected.length) { toast.info('Select a layer first'); return; }
    selected.forEach((l) => updateLayer(l.id, { fill: c, fillGradient: null }, { history: false }));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn('mb-1 flex flex-col items-center gap-0.5 rounded-lg p-1.5 hover:bg-accent', className)} aria-label="Fill color">
          <span className="h-4 w-4 rounded-[5px] border border-white/20 shadow-inner" style={{ background: selected[0]?.fillGradient ? `linear-gradient(135deg,${selected[0].fillGradient.stops.map((s) => s.color).join(',')})` : current }} />
          <span className="text-[8px] text-muted-foreground">fill</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-[204px] p-2.5">
        <p className="panel-title mb-2">Quick fill</p>
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from(new Set(colors)).map((c) => (
            <button key={c} onClick={() => apply(c)} className="aspect-square rounded-md border border-white/15 transition-transform hover:scale-110" style={{ background: c }} aria-label={c} />
          ))}
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <button onClick={() => apply('#ffffff')} className="rounded-md border border-border bg-white py-1 text-[10px] text-black">White</button>
          <button onClick={() => apply('#0b0b12')} className="rounded-md border border-border bg-[#0b0b12] py-1 text-[10px] text-white">Ink</button>
        </div>
        <label className="mt-2 flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5">
          <input type="color" value={current} onChange={(e) => apply(e.target.value)} className="h-4 w-4 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Custom color" />
          <span className="font-mono text-[10px] text-muted-foreground">{current.toUpperCase()}</span>
        </label>
      </PopoverContent>
    </Popover>
  );
}

function ThemeMini() {
  const { resolved: r, setTheme: st } = useTheme();
  return (
    <div className="pb-1">
      <Segmented size="xs" value={r} onChange={(v) => st(v as 'light' | 'dark' | 'system')} options={[{ value: 'light', label: 'L' }, { value: 'dark', label: 'D' }, { value: 'system', label: 'A' }]} className="scale-[0.85]" />
    </div>
  );
}
