'use client';
import * as React from 'react';
import {
  Check, Crop, Eraser, Grid2X2, Hand, Loader2, Minus, Paintbrush, Pipette, Plus, Redo2, RotateCcw, Scissors,
  Sparkles, Undo2, Wand2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEditor } from '@/lib/store/editor';
import { createLayer } from '@/lib/engine/factory';
import { composeCutout, featherMask, floodSelect, keyColourMask, makeMask, paintStroke, type StrokePoint } from '@/lib/engine/cutout';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tool = 'brush' | 'restore' | 'wand' | 'key' | 'rect';
type Mode = 'remove' | 'keep';

const TOOLS: { id: Tool; label: string; hint: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'brush', label: 'Erase brush', hint: 'Paint the area you want removed', icon: Paintbrush },
  { id: 'restore', label: 'Restore brush', hint: 'Paint back areas you erased by mistake', icon: Eraser },
  { id: 'wand', label: 'Magic wand', hint: 'Click a region with a similar colour (Shift = subtract)', icon: Wand2 },
  { id: 'key', label: 'Colour pick', hint: 'Click any colour to key it out (Shift = subtract)', icon: Pipette },
  { id: 'rect', label: 'Box select', hint: 'Drag a rectangle to erase (Shift = keep)', icon: Crop },
];

const MAX_PREVIEW = 980;
const UNDO_LIMIT = 14;

export function BackgroundRemoverDialog() {
  const open = useEditor((s) => s.cutoutOpen);
  const layerId = useEditor((s) => s.cutoutLayerId);
  const setOpen = useEditor((s) => s.setCutoutOpen);
  const layer = useEditor((s) => s.project.layers.find((l) => l.id === s.cutoutLayerId) ?? null);
  const updateLayer = useEditor((s) => s.updateLayer);
  const addLayer = useEditor((s) => s.addLayer);

  const viewRef = React.useRef<HTMLCanvasElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const baseRef = React.useRef<HTMLCanvasElement | null>(null);
  const maskRef = React.useRef<HTMLCanvasElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const compRef = React.useRef<HTMLCanvasElement | null>(null);
  const tintRef = React.useRef<HTMLCanvasElement | null>(null);
  const undoRef = React.useRef<ImageData[]>([]);
  const redoRef = React.useRef<ImageData[]>([]);
  const dragRef = React.useRef<{ active: boolean; points: StrokePoint[]; subtract: boolean; start?: StrokePoint; last?: StrokePoint }>({ active: false, points: [], subtract: false });

  const [tool, setTool] = React.useState<Tool>('brush');
  const [mode, setMode] = React.useState<Mode>('remove');
  const [brush, setBrush] = React.useState(64);
  const [softness, setSoftness] = React.useState(0.35);
  const [tolerance, setTolerance] = React.useState(38);
  const [feather, setFeather] = React.useState(2);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [showMask, setShowMask] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [canUndo, setCanUndo] = React.useState(false);
  const [canRedo, setCanRedo] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [swatches, setSwatches] = React.useState<string[]>([]);

  const render = React.useCallback(() => {
    const view = viewRef.current;
    const base = baseRef.current;
    const mask = maskRef.current;
    if (!view || !base || !mask) return;
    const ctx = view.getContext('2d');
    if (!ctx) return;
    const w = view.width, h = view.height;
    ctx.clearRect(0, 0, w, h);
    // checkerboard for transparency
    const s = 10;
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        ctx.fillStyle = ((x / s + y / s) | 0) % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.32)';
        ctx.fillRect(x, y, s, s);
      }
    }
    const comp = compRef.current ?? document.createElement('canvas');
    compRef.current = comp;
    comp.width = w; comp.height = h;
    const cctx = comp.getContext('2d')!;
    cctx.clearRect(0, 0, w, h);
    if (mode === 'keep') {
      cctx.drawImage(mask, 0, 0);
      cctx.globalCompositeOperation = 'source-in';
      cctx.drawImage(base, 0, 0);
    } else {
      cctx.drawImage(base, 0, 0);
      cctx.globalCompositeOperation = 'destination-out';
      cctx.drawImage(mask, 0, 0);
    }
    cctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(comp, 0, 0);
    if (showMask) {
      const tint = tintRef.current ?? document.createElement('canvas');
      tintRef.current = tint;
      tint.width = w; tint.height = h;
      const tctx = tint.getContext('2d')!;
      tctx.clearRect(0, 0, w, h);
      tctx.drawImage(mask, 0, 0);
      tctx.globalCompositeOperation = 'source-in';
      tctx.fillStyle = mode === 'keep' ? '#22d3ee' : '#f43f5e';
      tctx.fillRect(0, 0, w, h);
      tctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(tint, 0, 0);
      ctx.restore();
    }
  }, [mode, showMask]);

  // Load the source image whenever the dialog opens on a new layer.
  React.useEffect(() => {
    if (!open || !layer?.media?.src) return;
    let cancelled = false;
    setReady(false);
    undoRef.current = [];
    redoRef.current = [];
    setCanUndo(false); setCanRedo(false);
    setPicked(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;
      const ratio = Math.min(1, MAX_PREVIEW / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * ratio));
      const h = Math.max(1, Math.round(img.naturalHeight * ratio));
      const base = baseRef.current ?? document.createElement('canvas');
      baseRef.current = base;
      base.width = w; base.height = h;
      base.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const mask = maskRef.current ?? makeMask(w, h);
      maskRef.current = mask;
      mask.width = w; mask.height = h;
      mask.getContext('2d')!.clearRect(0, 0, w, h);
      const view = viewRef.current;
      if (view) { view.width = w; view.height = h; }
      setReady(true);
      // Dominant colour swatches — 8 buckets, most frequent first.
      const data = base.getContext('2d')!.getImageData(0, 0, w, h).data;
      const buckets = new Map<string, number>();
      for (let i = 0; i < data.length; i += 4 * 37) {
        if (data[i + 3] < 40) continue;
        const r = (data[i] >> 4) << 4, g = (data[i + 1] >> 4) << 4, b = (data[i + 2] >> 4) << 4;
        const key = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
      setSwatches([...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k]) => k));
      render();
    };
    img.onerror = () => { if (!cancelled) toast.error('Could not load this image'); };
    img.src = layer.media.src;
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, layer?.id, layer?.media?.src]);

  React.useEffect(() => { if (open && ready) render(); }, [open, ready, render]);

  const snapshot = () => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext('2d')!;
    undoRef.current.push(ctx.getImageData(0, 0, mask.width, mask.height));
    if (undoRef.current.length > UNDO_LIMIT) undoRef.current.shift();
    redoRef.current = [];
    setCanUndo(true); setCanRedo(false);
  };

  const undo = () => {
    const mask = maskRef.current;
    const snap = undoRef.current.pop();
    if (!mask || !snap) return;
    const ctx = mask.getContext('2d')!;
    redoRef.current.push(ctx.getImageData(0, 0, mask.width, mask.height));
    ctx.putImageData(snap, 0, 0);
    setCanUndo(undoRef.current.length > 0);
    setCanRedo(true);
    render();
  };

  const redo = () => {
    const mask = maskRef.current;
    const snap = redoRef.current.pop();
    if (!mask || !snap) return;
    const ctx = mask.getContext('2d')!;
    undoRef.current.push(ctx.getImageData(0, 0, mask.width, mask.height));
    ctx.putImageData(snap, 0, 0);
    setCanRedo(redoRef.current.length > 0);
    setCanUndo(true);
    render();
  };

  const resetMask = () => {
    const mask = maskRef.current;
    if (!mask) return;
    snapshot();
    mask.getContext('2d')!.clearRect(0, 0, mask.width, mask.height);
    render();
  };

  const toCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint => {
    const view = viewRef.current!;
    const rect = view.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * view.width,
      y: ((e.clientY - rect.top) / rect.height) * view.height,
    };
  };

  const pickColourAt = (p: StrokePoint): string | null => {
    const base = baseRef.current;
    if (!base) return null;
    const d = base.getContext('2d')!.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data;
    if (d[3] < 8) return null;
    return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };

  const applyKeyAt = (p: StrokePoint, subtract: boolean) => {
    const base = baseRef.current, mask = maskRef.current;
    if (!base || !mask) return;
    const colour = pickColourAt(p);
    if (!colour) return;
    setPicked(colour);
    const src = base.getContext('2d')!.getImageData(0, 0, base.width, base.height);
    const k = keyColourMask(src, colour, tolerance);
    const tmp = makeMask(base.width, base.height);
    tmp.getContext('2d')!.putImageData(k, 0, 0);
    const ctx = mask.getContext('2d')!;
    ctx.save();
    ctx.globalCompositeOperation = subtract ? 'destination-out' : 'source-over';
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    render();
  };

  const applyWandAt = (p: StrokePoint, subtract: boolean) => {
    const base = baseRef.current, mask = maskRef.current;
    if (!base || !mask) return;
    const src = base.getContext('2d')!.getImageData(0, 0, base.width, base.height);
    const sel = floodSelect(src, p.x, p.y, tolerance);
    const tmp = makeMask(base.width, base.height);
    tmp.getContext('2d')!.putImageData(sel, 0, 0);
    const ctx = mask.getContext('2d')!;
    ctx.save();
    ctx.globalCompositeOperation = subtract ? 'destination-out' : 'source-over';
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    render();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const p = toCanvasPoint(e);
    const subtract = e.shiftKey || e.altKey;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    snapshot();
    if (tool === 'wand') { applyWandAt(p, subtract); return; }
    if (tool === 'key') { applyKeyAt(p, subtract); return; }
    if (tool === 'rect') {
      dragRef.current = { active: true, points: [], subtract, start: p, last: p };
      return;
    }
    const ctx = maskRef.current!.getContext('2d')!;
    paintStroke(ctx, [p], brush, softness, tool === 'restore' ? 'erase' : 'paint');
    dragRef.current = { active: true, points: [p], subtract, last: p };
    render();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current;
    if (!d.active || !ready) return;
    const p = toCanvasPoint(e);
    const mask = maskRef.current!;
    const ctx = mask.getContext('2d')!;
    if (tool === 'rect') {
      // Live preview: draw the working rectangle on the view only.
      render();
      const view = viewRef.current!;
      const vctx = view.getContext('2d')!;
      const x = Math.min(d.start!.x, p.x), y = Math.min(d.start!.y, p.y);
      const w = Math.abs(p.x - d.start!.x), h = Math.abs(p.y - d.start!.y);
      vctx.save();
      vctx.fillStyle = d.subtract ? 'rgba(255,255,255,0.18)' : 'rgba(244,63,94,0.28)';
      vctx.strokeStyle = d.subtract ? 'rgba(255,255,255,0.7)' : 'rgba(244,63,94,0.9)';
      vctx.lineWidth = 1.5;
      vctx.fillRect(x, y, w, h);
      vctx.strokeRect(x, y, w, h);
      vctx.restore();
      d.last = p;
      return;
    }
    paintStroke(ctx, [d.last ?? p, p], brush, softness, tool === 'restore' ? 'erase' : 'paint');
    d.points.push(p);
    d.last = p;
    render();
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d.active) return;
    if (tool === 'rect' && d.start && d.last) {
      const mask = maskRef.current!;
      const ctx = mask.getContext('2d')!;
      const x = Math.min(d.start.x, d.last.x), y = Math.min(d.start.y, d.last.y);
      const w = Math.abs(d.last.x - d.start.x), h = Math.abs(d.last.y - d.start.y);
      ctx.save();
      ctx.globalCompositeOperation = d.subtract ? 'destination-out' : 'source-over';
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, w, h);
      ctx.restore();
      render();
    }
    dragRef.current = { active: false, points: [], subtract: false };
    setCanUndo(undoRef.current.length > 0);
  };

  const buildFullMask = (): HTMLCanvasElement | null => {
    const mask = maskRef.current, img = imgRef.current;
    if (!mask || !img) return null;
    const full = makeMask(img.naturalWidth, img.naturalHeight);
    const fctx = full.getContext('2d')!;
    fctx.imageSmoothingEnabled = true;
    fctx.drawImage(mask, 0, 0, full.width, full.height);
    if (feather > 0) {
      const scale = full.width / mask.width;
      const data = fctx.getImageData(0, 0, full.width, full.height);
      fctx.putImageData(featherMask(data, Math.max(1, Math.round(feather * scale))), 0, 0);
    }
    return full;
  };

  const apply = () => {
    if (!layer) return;
    const full = buildFullMask();
    if (!full) return;
    setBusy(true);
    try {
      updateLayer(layer.id, { cutout: { src: full.toDataURL('image/png'), mode } });
      toast.success('Cut-out applied', { description: mode === 'remove' ? 'Painted areas are now transparent' : 'Only the painted areas remain' });
      setOpen(false);
    } finally { setBusy(false); }
  };

  const cutOut = () => {
    if (!layer) return;
    const img = imgRef.current;
    const full = buildFullMask();
    if (!img || !full) return;
    setBusy(true);
    try {
      const composed = composeCutout(img, full, mode);
      const src = composed.toDataURL('image/png');
      const newLayer = createLayer({
        type: 'image', name: `${layer.name} · cut-out`,
        x: layer.x, y: layer.y, w: layer.w, h: layer.h,
        rotation: layer.rotation, opacity: layer.opacity, blendMode: layer.blendMode,
        media: { src, fit: 'fill', radius: layer.media?.radius },
        fill: layer.fill, startTime: layer.startTime, endTime: layer.endTime,
      });
      addLayer(newLayer);
      updateLayer(layer.id, { visible: false }, { history: false });
      toast.success('Cut-out created', { description: 'New transparent layer added — the original is hidden' });
      setOpen(false);
    } finally { setBusy(false); }
  };

  const clearCutout = () => {
    if (!layer) return;
    updateLayer(layer.id, { cutout: null });
    toast.success('Cut-out cleared');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[min(98vw,1220px)] gap-0 overflow-hidden p-0" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Manual background remover</DialogTitle>
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-3 py-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-500/25 to-cyan-500/15 ring-1 ring-fuchsia-400/25">
            <Scissors className="h-3 w-3 text-fuchsia-200" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12.5px] font-semibold tracking-tight">Cut-out studio</p>
            <p className="truncate text-[9.5px] text-muted-foreground">{layer?.name ?? 'Image'} · you choose exactly what goes</p>
          </div>
          <Badge variant="secondary" className="ml-1 h-5 text-[9px]">Manual, on-device</Badge>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="flex items-center gap-0.5 rounded-md border border-border/70 p-0.5">
              <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground" title="Zoom out"><Minus className="h-3 w-3" /></button>
              <span className="w-10 text-center font-mono text-[9.5px] tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground" title="Zoom in"><Plus className="h-3 w-3" /></button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            {layer?.cutout && <Button variant="outline" size="sm" onClick={clearCutout}><RotateCcw className="h-3.5 w-3.5" /> Clear</Button>}
            <Button variant="outline" size="sm" onClick={cutOut} disabled={!ready || busy}><Scissors className="h-3.5 w-3.5" /> Cut out</Button>
            <Button variant="prism" size="sm" onClick={apply} disabled={!ready || busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Apply mask
            </Button>
          </div>
        </div>

        <div className="grid max-h-[76vh] grid-cols-1 lg:grid-cols-[212px_1fr_236px]">
          {/* tools */}
          <div className="hidden min-h-0 flex-col gap-2 overflow-y-auto border-r border-border/70 bg-panel/50 p-2.5 lg:flex">
            <p className="px-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tools</p>
            <div className="grid gap-1">
              {TOOLS.map((t) => {
                const Icon = t.icon;
                const active = tool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTool(t.id)}
                    title={t.hint}
                    className={cn('group flex items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors',
                      active ? 'border-violet-400/45 bg-violet-500/12 text-foreground' : 'border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground')}
                  >
                    <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', active && 'text-violet-300')} />
                    <span className="min-w-0">
                      <span className="block text-[10.5px] font-medium leading-tight">{t.label}</span>
                      <span className="block text-[8.5px] leading-tight text-muted-foreground/80">{t.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-1 space-y-2">
              <div>
                <Label className="mb-0.5 flex items-center justify-between text-[9px]">Brush size <span className="font-mono text-muted-foreground">{brush}px</span></Label>
                <input type="range" min={6} max={260} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="w-full accent-violet-400" aria-label="Brush size" />
              </div>
              <div>
                <Label className="mb-0.5 flex items-center justify-between text-[9px]">Softness <span className="font-mono text-muted-foreground">{Math.round(softness * 100)}%</span></Label>
                <input type="range" min={0} max={1} step={0.01} value={softness} onChange={(e) => setSoftness(Number(e.target.value))} className="w-full accent-violet-400" aria-label="Brush softness" />
              </div>
              <div>
                <Label className="mb-0.5 flex items-center justify-between text-[9px]">Colour tolerance <span className="font-mono text-muted-foreground">{tolerance}</span></Label>
                <input type="range" min={1} max={120} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="w-full accent-violet-400" aria-label="Colour tolerance" />
              </div>
              <div>
                <Label className="mb-0.5 flex items-center justify-between text-[9px]">Edge feather <span className="font-mono text-muted-foreground">{feather}px</span></Label>
                <input type="range" min={0} max={18} value={feather} onChange={(e) => setFeather(Number(e.target.value))} className="w-full accent-violet-400" aria-label="Edge feather" />
              </div>
            </div>

            <div className="mt-1 space-y-1">
              <p className="px-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">History</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={undo} disabled={!canUndo}><Undo2 className="h-3.5 w-3.5" /> Undo</Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={redo} disabled={!canRedo}><Redo2 className="h-3.5 w-3.5" /> Redo</Button>
              </div>
              <Button variant="ghost" size="sm" className="w-full" onClick={resetMask} disabled={!ready}><RotateCcw className="h-3.5 w-3.5" /> Reset mask</Button>
            </div>
          </div>

          {/* canvas */}
          <div ref={wrapRef} className="relative flex min-h-[300px] flex-col items-center justify-center overflow-auto bg-[#06060b] p-4">
            <div className="absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(circle at 50% 42%, rgba(139,92,246,.13), transparent 62%)' }} />
            {!ready && (
              <div className="relative flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
                <p className="text-[10px]">Loading image…</p>
              </div>
            )}
            <canvas
              ref={viewRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={cn('relative max-h-[58vh] max-w-full touch-none select-none rounded-lg ring-1 ring-white/12 shadow-[0_26px_70px_-30px_rgba(0,0,0,.9)]',
                ready ? 'opacity-100' : 'opacity-0',
                tool === 'brush' || tool === 'restore' ? 'cursor-cell' : tool === 'key' || tool === 'wand' ? 'cursor-crosshair' : 'cursor-crosshair')}
              style={{ width: zoom === 1 ? undefined : `${zoom * 100}%`, height: 'auto' }}
              aria-label="Cut-out canvas"
            />
            <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[9px] text-white/70 backdrop-blur">
              <Hand className="h-3 w-3" /> {TOOLS.find((t) => t.id === tool)?.hint} · <kbd className="rounded bg-white/10 px-1">Shift</kbd> reverses
            </div>
          </div>

          {/* right rail */}
          <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto border-l border-border/70 bg-panel/50 p-2.5">
            <p className="px-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Result mode</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setMode('remove')} className={cn('rounded-lg border p-1.5 text-left transition-colors', mode === 'remove' ? 'border-rose-400/45 bg-rose-500/12' : 'border-border/60 hover:bg-white/5')}>
                <span className="block text-[10px] font-medium">Remove</span>
                <span className="block text-[8.5px] text-muted-foreground">Painted = transparent</span>
              </button>
              <button onClick={() => setMode('keep')} className={cn('rounded-lg border p-1.5 text-left transition-colors', mode === 'keep' ? 'border-cyan-400/45 bg-cyan-500/12' : 'border-border/60 hover:bg-white/5')}>
                <span className="block text-[10px] font-medium">Keep only</span>
                <span className="block text-[8.5px] text-muted-foreground">Painted = visible</span>
              </button>
            </div>

            <button onClick={() => setShowMask((v) => !v)} className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition-colors', showMask ? 'border-violet-400/45 bg-violet-500/12 text-violet-200' : 'border-border/60 text-muted-foreground hover:text-foreground')}>
              <Grid2X2 className="h-3.5 w-3.5" /> Show mask overlay
            </button>

            <div className="rounded-lg border border-border/60 bg-background/40 p-2">
              <div className="flex items-center gap-1.5">
                <Pipette className="h-3 w-3 text-muted-foreground" />
                <span className="text-[9.5px] font-medium">Colour key</span>
                <span className="ml-auto font-mono text-[9px] text-muted-foreground">{picked ?? '—'}</span>
                <span className="h-3.5 w-3.5 rounded ring-1 ring-white/20" style={{ background: picked ?? 'transparent' }} />
              </div>
              <p className="mt-1 text-[8.5px] leading-snug text-muted-foreground">Click the photo with the colour tool, or pick a dominant swatch — every similar pixel is separated.</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {swatches.map((c) => (
                  <button
                    key={c}
                    title={`Key out ${c}`}
                    onClick={() => {
                      setPicked(c);
                      snapshot();
                      const base = baseRef.current, mask = maskRef.current;
                      if (!base || !mask) return;
                      const src = base.getContext('2d')!.getImageData(0, 0, base.width, base.height);
                      const k = keyColourMask(src, c, tolerance);
                      const tmp = makeMask(base.width, base.height);
                      tmp.getContext('2d')!.putImageData(k, 0, 0);
                      const ctx = mask.getContext('2d')!;
                      ctx.save();
                      ctx.globalCompositeOperation = tool === 'restore' ? 'destination-out' : 'source-over';
                      ctx.drawImage(tmp, 0, 0);
                      ctx.restore();
                      render();
                    }}
                    className="h-4 w-4 rounded ring-1 ring-white/15 transition-transform hover:scale-110"
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/40 p-2">
              <div className="flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-cyan-300" /><span className="text-[9.5px] font-medium">Tips</span></div>
              <ul className="mt-1 space-y-1 text-[8.5px] leading-snug text-muted-foreground">
                <li>· Zoom in for hair and soft edges, then shrink the brush.</li>
                <li>· Magic wand is best on flat studio backdrops.</li>
                <li>· Feather 2–6 px keeps edges from looking cut.</li>
                <li>· <strong className="text-foreground/80">Cut out</strong> bakes a transparent PNG layer; <strong className="text-foreground/80">Apply</strong> keeps it live and editable.</li>
              </ul>
            </div>

            <div className="mt-auto rounded-lg border border-border/60 bg-background/40 p-2 text-[8.5px] leading-snug text-muted-foreground">
              Nothing leaves your device — the mask is computed locally with the Canvas API and stored with the project.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
