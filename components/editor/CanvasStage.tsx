'use client';
import * as React from 'react';
import { useEditor } from '@/lib/store/editor';
import { drawScene, drawOverlay, preloadImage } from '@/lib/engine/renderer';
import { hitTest, layerQuad, resolveLayer } from '@/lib/engine/animation';
import {
  computeSnap, handlePositions, isQuadHit, resizeLayer, rotationFromPointer, screenToScene,
  type Handle, type Pt,
} from '@/lib/engine/transform';
import { createShape, createText, createLayer } from '@/lib/engine/factory';
import { PALETTE_LIST } from '@/lib/store/editor';
import type { Layer, ShapeKind } from '@/lib/engine/types';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { cn, clamp, fileToDataUrl, uid } from '@/lib/utils';
import { toast } from 'sonner';
import { Copy, Scissors, Group, Ungroup, ArrowUpToLine, Lock, EyeOff, Plus, CopyPlus, Sparkles, MoveRight } from 'lucide-react';
import { Kbd } from '@/components/ui/misc';

type Drag =
  | { mode: 'none' }
  | { mode: 'move'; start: Pt; originals: Record<string, { x: number; y: number }>; moved: boolean; additive: boolean }
  | { mode: 'resize'; handle: Handle; layerId: string; original: Layer }
  | { mode: 'rotate'; layerId: string; start: Pt; startRotation: number; original: Layer }
  | { mode: 'pan'; startClient: Pt; startPan: { panX: number; panY: number } }
  | { mode: 'marquee'; start: Pt; current: Pt }
  | { mode: 'create'; kind: ShapeKind; start: Pt; current: Pt; layerId: string }
  | { mode: 'draw'; points: Pt[]; layerId: string };

export function CanvasStage() {
  const project = useEditor((s) => s.project);
  const time = useEditor((s) => s.time);
  const view = useEditor((s) => s.view);
  const viewport = useEditor((s) => s.viewport);
  const selection = useEditor((s) => s.selection);
  const tool = useEditor((s) => s.tool);
  const shapeKind = useEditor((s) => s.shapeKind);
  const playing = useEditor((s) => s.playing);
  const speed = useEditor((s) => s.speed);
  const showGrid = useEditor((s) => s.showGrid);
  const showSafe = useEditor((s) => s.showSafe);
  const showGuides = useEditor((s) => s.showGuides);
  const showRulers = useEditor((s) => s.showRulers);
  const snapEnabled = useEditor((s) => s.snap);
  const loopMode = useEditor((s) => s.loopMode);
  const setViewport = useEditor((s) => s.setViewport);
  const fitView = useEditor((s) => s.fitView);
  const setTool = useEditor((s) => s.setTool);
  const setView = useEditor((s) => s.setView);
  const zoomAt = useEditor((s) => s.zoomAt);
  const select = useEditor((s) => s.select);
  const toggleSelect = useEditor((s) => s.toggleSelect);
  const setHover = useEditor((s) => s.setHover);
  const addLayer = useEditor((s) => s.addLayer);
  const updateLayer = useEditor((s) => s.updateLayer);
  const pushHistory = useEditor((s) => s.pushHistory);
  const setTime = useEditor((s) => s.setTime);
  const addAsset = useEditor((s) => s.addAsset);
  const setLeftTab = useEditor((s) => s.setLeftTab);

  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const sceneRef = React.useRef<HTMLCanvasElement | null>(null);
  const overlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const dragRef = React.useRef<Drag>({ mode: 'none' });
  const [hover, setHoverState] = React.useState<string | null>(null);
  const [marquee, setMarquee] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [snapLines, setSnapLines] = React.useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [spaceDown, setSpaceDown] = React.useState(false);
  const [editing, setEditing] = React.useState<{ id: string; value: string; rect: { left: number; top: number; width: number; height: number }; fontSize: number; align: string; color: string; font: string; weight: number } | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  const [fps, setFps] = React.useState(60);
  const hoverRaf = React.useRef(0);
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;

  // viewport tracking
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const prev = useEditor.getState().viewport;
      setViewport(width, height);
      if (Math.abs(prev.w - width) > 2 || Math.abs(prev.h - height) > 2) {
        if (!useEditor.getState().hydrated || !useEditor.getState().past.length) fitView();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewport, fitView]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !inputFocused()) {
        setSpaceDown(e.type === 'keydown');
        if (e.type === 'keydown') e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); };
  }, []);

  const drawSceneAt = React.useCallback((t: number) => {
    const canvas = sceneRef.current;
    const el = wrapRef.current;
    if (!canvas || !el) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const p = useEditor.getState().project;
    const v = useEditor.getState().view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // artboard drop shadow
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = '#000';
    ctx.fillRect(v.panX, v.panY, p.width * v.zoom, p.height * v.zoom);
    ctx.restore();
    ctx.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * v.panX, dpr * v.panY);
    drawScene(ctx, p, t, { quality: useEditor.getState().playing ? 0.85 : 1 });
  }, [dpr]);

  const drawOverlayNow = React.useCallback(() => {
    const canvas = overlayRef.current;
    const el = wrapRef.current;
    if (!canvas || !el) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = useEditor.getState();
    const p = s.project;
    const v = s.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // grid
    if (s.showGrid) {
      ctx.save();
      const step = 48 * v.zoom;
      const startX = ((v.panX % step) + step) % step;
      const startY = ((v.panY % step) + step) % step;
      ctx.strokeStyle = 'rgba(147,147,180,0.13)';
      ctx.lineWidth = 1;
      for (let x = startX; x < w; x += step) { ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); ctx.stroke(); }
      for (let y = startY; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); ctx.stroke(); }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(v.panX, v.panY);
    ctx.scale(v.zoom, v.zoom);

    // safe areas
    if (s.showSafe) {
      ctx.strokeStyle = 'rgba(34,211,238,0.5)';
      ctx.setLineDash([8 / v.zoom, 8 / v.zoom]);
      ctx.lineWidth = 1 / v.zoom;
      const m = 0.05;
      ctx.strokeRect(p.width * m, p.height * m, p.width * (1 - m * 2), p.height * (1 - m * 2));
      const t = 0.1;
      ctx.strokeStyle = 'rgba(232,121,249,0.45)';
      ctx.strokeRect(p.width * t, p.height * t, p.width * (1 - t * 2), p.height * (1 - t * 2));
      ctx.setLineDash([]);
    }

    // centre guides
    if (s.showGuides) {
      ctx.strokeStyle = 'rgba(232,121,249,0.28)';
      ctx.lineWidth = 1 / v.zoom;
      ctx.setLineDash([6 / v.zoom, 6 / v.zoom]);
      ctx.beginPath(); ctx.moveTo(p.width / 2, 0); ctx.lineTo(p.width / 2, p.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p.height / 2); ctx.lineTo(p.width, p.height / 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    drawOverlay(ctx, p, s.time, {
      selectedIds: s.selection,
      hoverId: hover,
      project: p,
      view: v,
      width: w,
      height: h,
      snapLines: s.snap ? snapLines : {},
    });

    // marquee
    if (marquee) {
      ctx.save();
      ctx.fillStyle = 'rgba(139,92,246,0.12)';
      ctx.strokeStyle = 'rgba(167,139,250,0.9)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
      ctx.strokeRect(marquee.x + 0.5, marquee.y + 0.5, marquee.w, marquee.h);
      ctx.restore();
    }

    // create preview
    const d = dragRef.current;
    if (d.mode === 'create' || d.mode === 'draw') {
      ctx.save();
      ctx.strokeStyle = 'rgba(34,211,238,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      if (d.mode === 'create') {
        const a = { x: d.start.x * v.zoom + v.panX, y: d.start.y * v.zoom + v.panY };
        const b = { x: d.current.x * v.zoom + v.panX, y: d.current.y * v.zoom + v.panY };
        ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      } else if (d.mode === 'draw' && d.points.length > 1) {
        ctx.beginPath();
        d.points.forEach((pt, i) => { const x = pt.x * v.zoom + v.panX, y = pt.y * v.zoom + v.panY; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.strokeStyle = 'rgba(232,121,249,0.9)';
        ctx.stroke();
      }
      ctx.restore();
    }

    // rulers
    if (s.showRulers && w > 380) {
      const R = 18;
      ctx.save();
      ctx.fillStyle = 'rgba(12,12,18,0.88)';
      if (document.documentElement.classList.contains('dark') === false) ctx.fillStyle = 'rgba(248,248,252,0.92)';
      ctx.fillRect(0, 0, w, R);
      ctx.fillRect(0, 0, R, h);
      ctx.font = '9px ui-monospace, monospace';
      ctx.fillStyle = document.documentElement.classList.contains('dark') ? 'rgba(190,190,215,0.65)' : 'rgba(60,60,80,0.7)';
      ctx.strokeStyle = document.documentElement.classList.contains('dark') ? 'rgba(190,190,215,0.28)' : 'rgba(60,60,80,0.3)';
      const candidates = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
      const step = candidates.find((c) => c * v.zoom >= 56) ?? 2000;
      ctx.lineWidth = 1;
      const start = Math.floor(-v.panX / v.zoom / step) * step;
      for (let sx = start; sx * v.zoom + v.panX < w; sx += step) {
        const x = sx * v.zoom + v.panX;
        if (x < R) continue;
        ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, R - 5); ctx.lineTo(Math.round(x) + 0.5, R); ctx.stroke();
        ctx.fillText(String(Math.round(sx)), x + 3, 10);
      }
      const startY = Math.floor(-v.panY / v.zoom / step) * step;
      for (let sy = startY; sy * v.zoom + v.panY < h; sy += step) {
        const y = sy * v.zoom + v.panY;
        if (y < R) continue;
        ctx.beginPath(); ctx.moveTo(R - 5, Math.round(y) + 0.5); ctx.lineTo(R, Math.round(y) + 0.5); ctx.stroke();
        ctx.save(); ctx.translate(9, y + 3); ctx.rotate(-Math.PI / 2); ctx.fillText(String(Math.round(sy)), 0, 0); ctx.restore();
      }
      ctx.fillStyle = document.documentElement.classList.contains('dark') ? 'rgba(12,12,18,0.95)' : 'rgba(248,248,252,0.95)';
      ctx.fillRect(0, 0, R, R);
      ctx.restore();
    }
  }, [dpr, hover, marquee, snapLines]);

  // draw on state change
  React.useEffect(() => { drawSceneAt(time); }, [drawSceneAt, time, project, view, showGrid]);
  React.useEffect(() => { drawOverlayNow(); }, [drawOverlayNow, project, view, selection, hover, marquee, snapLines, showGrid, showSafe, showGuides, showRulers]);

  // preload media
  React.useEffect(() => {
    project.layers.forEach((l) => {
      if (l.media?.src) preloadImage(l.media.src);
      if (l.cutout?.src) preloadImage(l.cutout.src, () => drawSceneAt(time));
    });
  }, [project.layers]);

  // playback
  React.useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const startTime = useEditor.getState().time;
    const started = performance.now();
    let lastSync = 0;
    let frames = 0, fpsStart = started;
    let dir = 1;
    const loop = (now: number) => {
      const s = useEditor.getState();
      let t = startTime + ((now - started) / 1000) * s.speed * dir;
      if (t >= s.project.duration) {
        if (s.loopMode === 'loop') t = t % s.project.duration;
        else if (s.loopMode === 'pingpong') { dir = -1; t = s.project.duration - (t - s.project.duration) % s.project.duration; }
        else { s.setTime(s.project.duration); s.setPlaying(false); return; }
      }
      if (t < 0) { if (s.loopMode === 'pingpong') { dir = 1; t = -t; } else t = 0; }
      drawSceneAtFor(t);
      if (now - lastSync > 90) { s.setTime(t); lastSync = now; }
      frames++;
      if (now - fpsStart > 700) { setFps(Math.round((frames * 1000) / (now - fpsStart))); frames = 0; fpsStart = now; }
      raf = requestAnimationFrame(loop);
    };
    const drawSceneAtFor = (t: number) => {
      const canvas = sceneRef.current; const el = wrapRef.current;
      if (!canvas || !el) return;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      const p = useEditor.getState().project; const v = useEditor.getState().view;
      ctx.setTransform(dpr * v.zoom, 0, 0, dpr * v.zoom, dpr * v.panX, dpr * v.panY);
      drawScene(ctx, p, t, { quality: 0.85 });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, drawSceneAt, dpr]);

  const localPoint = (e: { clientX: number; clientY: number }): Pt => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const scenePoint = (e: { clientX: number; clientY: number }): Pt => {
    const lp = localPoint(e);
    return screenToScene(lp.x, lp.y, useEditor.getState().view);
  };

  const selectedLayers = React.useMemo(() => project.layers.filter((l) => selection.includes(l.id)), [project.layers, selection]);

  const hitHandle = (screen: Pt): { handle: Handle; layer: Layer } | null => {
    if (selection.length !== 1 || selectedLayers.length !== 1) return null;
    const layer = selectedLayers[0];
    if (layer.locked) return null;
    const v = useEditor.getState().view;
    const hp = handlePositions(layer, project.layers, time);
    const entries = Object.entries(hp) as [Handle, Pt][];
    for (const [handle, pt] of entries) {
      const sx = pt.x * v.zoom + v.panX, sy = pt.y * v.zoom + v.panY;
      if (Math.hypot(sx - screen.x, sy - screen.y) <= 9) return { handle, layer };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || spaceDown || tool === 'hand') {
      dragRef.current = { mode: 'pan', startClient: { x: e.clientX, y: e.clientY }, startPan: { ...useEditor.getState().view } };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button === 2) return;
    const rect = wrapRef.current!.getBoundingClientRect();
    if (showRulers && rect && (e.clientY - rect.top < 18 || e.clientX - rect.left < 18)) return;
    const screen = localPoint(e);
    const scene = screenToScene(screen.x, screen.y, view);

    if (tool === 'zoom') {
      zoomAt(e.altKey ? 0.8 : 1.25, screen.x, screen.y);
      return;
    }

    if (tool === 'shape') {
      pushHistory();
      const colors = PALETTE_LIST[0].colors;
      const layer = createShape(shapeKind, {
        x: scene.x, y: scene.y, w: 1, h: 1, fill: colors[1], endTime: project.duration,
      });
      layer.name = shapeKind === 'ellipse' ? 'Ellipse' : shapeKind === 'star' ? 'Star' : 'Rectangle';
      addLayer(layer, { select: true, history: false });
      dragRef.current = { mode: 'create', kind: shapeKind, start: scene, current: scene, layerId: layer.id };
      return;
    }

    if (tool === 'text') {
      const layer = createText('Your headline', {
        x: scene.x, y: scene.y - 30, w: Math.min(project.width * 0.7, 900), h: project.width * 0.09,
        endTime: project.duration,
      }, { fontSize: Math.round(project.width / 18), fontWeight: 700, color: '#ffffff' });
      addLayer(layer);
      setTool('select');
      setTime(time);
      requestAnimationFrame(() => startEditing(layer));
      return;
    }

    if (tool === 'pen') {
      pushHistory();
      const layer = createLayer({
        type: 'path', name: 'Freehand path', x: 0, y: 0, w: project.width, h: project.height,
        fill: 'transparent', stroke: '#22d3ee', strokeWidth: 6, endTime: project.duration, path: 'M 0 0',
      });
      addLayer(layer, { select: true, history: false });
      dragRef.current = { mode: 'draw', points: [scene], layerId: layer.id };
      return;
    }

    if (tool === 'image') { fileRef.current?.click(); return; }

    const handleHit = hitHandle(screen);
    if (handleHit) {
      pushHistory();
      if (handleHit.handle === 'rotate') dragRef.current = { mode: 'rotate', layerId: handleHit.layer.id, start: scene, startRotation: handleHit.layer.rotation, original: { ...handleHit.layer } };
      else dragRef.current = { mode: 'resize', handle: handleHit.handle, layerId: handleHit.layer.id, original: { ...handleHit.layer } };
      return;
    }

    const hit = hitTest(project, time, scene.x, scene.y);
    if (hit) {
      if (e.shiftKey) toggleSelect(hit.id, true);
      else if (!selection.includes(hit.id)) select([hit.id]);
      else if (e.metaKey || e.ctrlKey) toggleSelect(hit.id, true);
      const ids = useEditor.getState().selection;
      const originals: Record<string, { x: number; y: number }> = {};
      for (const id of ids) { const l = project.layers.find((x) => x.id === id); if (l) originals[id] = { x: l.x, y: l.y }; }
      dragRef.current = { mode: 'move', start: scene, originals, moved: false, additive: e.shiftKey };
      pushHistory();
    } else {
      if (!e.shiftKey) select([]);
      dragRef.current = { mode: 'marquee', start: screen, current: screen };
      setMarquee({ x: screen.x, y: screen.y, w: 0, h: 0 });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const screen = localPoint(e);
    if (drag.mode === 'pan') {
      const dx = e.clientX - drag.startClient.x;
      const dy = e.clientY - drag.startClient.y;
      setView({ panX: drag.startPan.panX + dx, panY: drag.startPan.panY + dy });
      return;
    }
    const scene = screenToScene(screen.x, screen.y, view);

    if (drag.mode === 'none') {
      if (hoverRaf.current) return;
      hoverRaf.current = requestAnimationFrame(() => {
        hoverRaf.current = 0;
        const hit = hitTest(project, time, scene.x, scene.y);
        const id = hit?.id ?? null;
        if (id !== hover) { setHoverState(id); setHover(id); }
      });
      return;
    }

    if (drag.mode === 'marquee') {
      drag.current = scene;
      const r = { x: Math.min(drag.start.x, screen.x), y: Math.min(drag.start.y, screen.y), w: Math.abs(screen.x - drag.start.x), h: Math.abs(screen.y - drag.start.y) };
      setMarquee(r);
      const a = screenToScene(r.x, r.y, view), b = screenToScene(r.x + r.w, r.y + r.h, view);
      const ids = project.layers.filter((l) => {
        if (!l.visible || l.locked || l.type === 'group') return false;
        const quad = layerQuad(l, project.layers, time);
        const xs = quad.map((q) => q[0]), ys = quad.map((q) => q[1]);
        const lx = Math.min(...xs), ly = Math.min(...ys), lx2 = Math.max(...xs), ly2 = Math.max(...ys);
        return lx < b.x && lx2 > a.x && ly < b.y && ly2 > a.y;
      }).map((l) => l.id);
      if (ids.length) select(ids);
      return;
    }

    if (drag.mode === 'move') {
      let dx = scene.x - drag.start.x;
      let dy = scene.y - drag.start.y;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      let lines: { x: number | null; y: number | null } = { x: null, y: null };
      if (snapEnabled && !e.metaKey) {
        const moving = selectedLayers;
        if (moving.length === 1) {
          const r = resolveLayer(moving[0], time);
          const snap = computeSnap(project, selection, { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }, 7 / view.zoom);
          dx += snap.dx; dy += snap.dy; lines = { x: snap.x, y: snap.y };
        }
      }
      drag.moved = drag.moved || Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
      setSnapLines(lines);
      for (const id of selection) {
        const orig = drag.originals[id];
        if (!orig) continue;
        const l = project.layers.find((x) => x.id === id);
        if (l?.locked) continue;
        updateLayer(id, { x: Math.round((orig.x + dx) * 100) / 100, y: Math.round((orig.y + dy) * 100) / 100 }, { history: false });
      }
      return;
    }

    if (drag.mode === 'resize') {
      const original = drag.original;
      const res = resizeLayer(original, project.layers, time, drag.handle, scene, { keepRatio: e.shiftKey, fromCenter: e.altKey });
      const patch: Partial<Layer> = { x: Math.round(res.x), y: Math.round(res.y) };
      if (drag.handle !== 'rotate') {
        patch.w = Math.round(res.w); patch.h = Math.round(res.h);
        if (original.text) patch.text = { ...original.text, fontSize: Math.round(original.text.fontSize * (res.h / Math.max(1, resolveLayer(original, time).h))) };
      }
      updateLayer(drag.layerId, patch, { history: false });
      return;
    }

    if (drag.mode === 'rotate') {
      const rotation = rotationFromPointer(drag.original, project.layers, time, scene, { pointer: drag.start, rotation: drag.startRotation });
      updateLayer(drag.layerId, { rotation: e.shiftKey ? Math.round(rotation / 15) * 15 : rotation }, { history: false });
      return;
    }

    if (drag.mode === 'create') {
      drag.current = scene;
      const x = Math.min(drag.start.x, scene.x), y = Math.min(drag.start.y, scene.y);
      let w = Math.abs(scene.x - drag.start.x), h = Math.abs(scene.y - drag.start.y);
      if (e.shiftKey) { const m = Math.max(w, h); w = m; h = m; }
      updateLayer(drag.layerId, { x, y, w: Math.max(2, w), h: Math.max(2, h) }, { history: false });
      return;
    }

    if (drag.mode === 'draw') {
      drag.points.push(scene);
      const pts = drag.points;
      const d = pts.map((p, i) => `${i ? 'L' : 'M'} ${(p.x - pts[0].x).toFixed(1)} ${(p.y - pts[0].y).toFixed(1)}`).join(' ');
      updateLayer(drag.layerId, { x: pts[0].x, y: pts[0].y, w: Math.max(1, Math.max(...pts.map((p) => p.x)) - pts[0].x), h: Math.max(1, Math.max(...pts.map((p) => p.y)) - pts[0].y), path: d }, { history: false });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (drag.mode === 'pan') {
      // noop
    } else if (drag.mode === 'marquee') {
      dragRef.current = { mode: 'none' };
      setMarquee(null);
      return;
    } else if (drag.mode === 'rotate') {
      dragRef.current = { mode: 'none' };
      return;
    } else if (drag.mode === 'create') {
      const d = drag;
      if (Math.abs(d.current.x - d.start.x) < 3 && Math.abs(d.current.y - d.start.y) < 3) {
        const l = useEditor.getState().project.layers.find((x) => x.id === d.layerId);
        if (l) updateLayer(l.id, { w: 220, h: 220, x: d.start.x - 110, y: d.start.y - 110 }, { history: false });
      }
      setTool('select');
    } else if (drag.mode === 'draw') {
      setTool('select');
    }
    dragRef.current = { mode: 'none' };
    setSnapLines({ x: null, y: null });
    void e;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    if (e.ctrlKey || e.metaKey) zoomAt(Math.pow(0.999, e.deltaY * 2), x, y);
    else if (e.shiftKey) setView({ panX: view.panX - e.deltaY, panY: view.panY });
    else setView({ panX: view.panX - e.deltaX, panY: view.panY - e.deltaY });
  };

  const startEditing = (layer: Layer) => {
    if (layer.type !== 'text' || !layer.text) return;
    const v = useEditor.getState().view;
    const quad = layerQuad(layer, useEditor.getState().project.layers, time);
    const xs = quad.map((q) => q[0]), ys = quad.map((q) => q[1]);
    const r = resolveLayer(layer, time);
    setEditing({
      id: layer.id, value: layer.text.content,
      rect: { left: Math.min(...xs) * v.zoom + v.panX, top: Math.min(...ys) * v.zoom + v.panY, width: r.w * v.zoom, height: r.h * v.zoom },
      fontSize: r.fontSize * v.zoom, align: layer.text.align, color: layer.text.color, font: layer.text.fontFamily, weight: layer.text.fontWeight,
    });
  };

  const commitEditing = () => {
    if (!editing) return;
    const layer = useEditor.getState().project.layers.find((l) => l.id === editing.id);
    if (layer && layer.text && editing.value !== layer.text.content) updateLayer(editing.id, { text: { ...layer.text, content: editing.value } });
    setEditing(null);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 10);
    for (const file of arr) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isAudio = file.type.startsWith('audio/');
      if (!isImage && !isVideo && !isAudio && !file.name.endsWith('.svg') && !file.name.endsWith('.json')) {
        toast.error(`Unsupported file: ${file.name}`);
        continue;
      }
      const dataUrl = await fileToDataUrl(file);
      const id = uid('as');
      addAsset({ id, name: file.name, type: isVideo ? 'video' : isAudio ? 'audio' : file.name.endsWith('.json') ? 'lottie' : 'image', src: dataUrl, createdAt: Date.now(), size: file.size });
      if (isAudio) {
        addLayer(createLayer({ type: 'audio', name: file.name, x: 0, y: project.height - 60, w: project.width, h: 60, fill: 'transparent', media: { src: dataUrl, fit: 'fill' }, endTime: project.duration }));
        continue;
      }
      if (isImage || file.name.endsWith('.svg')) {
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });
        const maxW = project.width * 0.6;
        const scale = img.width ? Math.min(1, maxW / img.width) : 0.5;
        const w = img.width ? img.width * scale : project.width * 0.4;
        const h = img.height ? img.height * scale : project.height * 0.4;
        addLayer(createLayer({
          type: 'image', name: file.name, x: (project.width - w) / 2, y: (project.height - h) / 2, w, h,
          fill: 'transparent', media: { src: dataUrl, fit: 'cover' }, endTime: project.duration,
        }));
      }
    }
    toast.success(`${arr.length} file${arr.length > 1 ? 's' : ''} added`);
    setLeftTab('assets');
  };

  const cursor = dragRef.current.mode === 'move' ? 'grabbing'
    : dragRef.current.mode === 'pan' ? 'grabbing'
    : spaceDown || tool === 'hand' ? 'grab'
    : tool === 'zoom' ? 'zoom-in'
    : tool === 'text' ? 'text'
    : tool === 'shape' || tool === 'pen' ? 'crosshair'
    : hover ? 'move' : 'default';

  const contextLayer = hitTest(project, time, 0, 0); // replaced dynamically below
  void contextLayer;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={wrapRef}
          className="relative h-full w-full overflow-hidden bg-[#08080e] outline-none"
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onDoubleClick={(e) => {
            const hit = hitTest(project, time, ...(() => { const s = scenePoint(e); return [s.x, s.y] as const; })());
            if (hit?.type === 'text') { select([hit.id]); startEditing(hit); }
          }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) { void uploadFiles(e.dataTransfer.files); return; }
            const raw = e.dataTransfer.getData('application/x-prism-library');
            if (raw) {
              try {
                const item = JSON.parse(raw) as { src: string; name: string; type: string; w?: number; h?: number };
                if (item.src) {
                  const scene = scenePoint(e);
                  const w = item.w ?? project.width * 0.35;
                  const h = item.h ?? w;
                  addLayer(createLayer({ type: 'image', name: item.name, x: scene.x - w / 2, y: scene.y - h / 2, w, h, fill: 'transparent', media: { src: item.src, fit: 'contain' }, endTime: project.duration }));
                }
              } catch { /* ignore */ }
            }
          }}
          tabIndex={0}
          role="application"
          aria-label="Design canvas"
        >
          <canvas ref={sceneRef} className="absolute inset-0 h-full w-full" />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />

          {editing && (
            <textarea
              autoFocus
              value={editing.value}
              onChange={(ev) => setEditing({ ...editing, value: ev.target.value })}
              onBlur={commitEditing}
              onKeyDown={(ev) => {
                if (ev.key === 'Escape') setEditing(null);
                if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); commitEditing(); }
              }}
              style={{
                position: 'absolute', left: editing.rect.left, top: editing.rect.top, width: editing.rect.width, height: editing.rect.height,
                fontSize: editing.fontSize, fontFamily: `'${editing.font}', Inter, sans-serif`, fontWeight: editing.weight,
                color: editing.color, textAlign: editing.align as 'left' | 'center' | 'right', lineHeight: 1.15,
                background: 'rgba(10,10,18,0.35)', border: '1px dashed rgba(167,139,250,0.8)', borderRadius: 2, resize: 'none', padding: 2, outline: 'none', overflow: 'hidden',
              }}
              aria-label="Edit text"
            />
          )}

          {tool !== 'select' && tool !== 'move' && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[10px] text-muted-foreground backdrop-blur">
              {tool === 'shape' ? `Drag to draw · ${shapeKind}` : tool === 'pen' ? 'Draw freehand · release to finish' : tool === 'text' ? 'Click to place text' : tool === 'image' ? 'Click to upload an image' : tool === 'zoom' ? 'Click to zoom · Alt-click to zoom out' : `${tool} tool`}
            </div>
          )}

          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md border border-border/60 bg-background/70 px-2 py-1 font-mono text-[9.5px] text-muted-foreground backdrop-blur">
            <span className={cn('h-1.5 w-1.5 rounded-full', playing ? 'bg-emerald-400' : 'bg-muted-foreground/40')} />
            {Math.round(view.zoom * 100)}% · {fps}fps
          </div>

          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files) void uploadFiles(e.target.files); e.target.value = ''; }} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>Canvas</ContextMenuLabel>
        <ContextMenuItem onClick={() => { const l = createShape('rect', { x: project.width / 2 - 150, y: project.height / 2 - 100, fill: PALETTE_LIST[0].colors[0], endTime: project.duration }); addLayer(l); }}>
          <Plus className="h-3.5 w-3.5" /> Add rectangle <span className="ml-auto"><Kbd>R</Kbd></span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => { const l = createText('New text', { x: project.width / 2 - 300, y: project.height / 2 - 60, w: 600, h: 120, endTime: project.duration }, { fontSize: 96, fontWeight: 700 }); addLayer(l); }}>
          <Plus className="h-3.5 w-3.5" /> Add text <span className="ml-auto"><Kbd>T</Kbd></span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuLabel>Selection</ContextMenuLabel>
        <ContextMenuItem disabled={!selection.length} onClick={() => useEditor.getState().copySelection()}><Copy className="h-3.5 w-3.5" /> Copy <span className="ml-auto"><Kbd>⌘C</Kbd></span></ContextMenuItem>
        <ContextMenuItem disabled={!selection.length} onClick={() => useEditor.getState().duplicateLayers()}><CopyPlus className="h-3.5 w-3.5" /> Duplicate <span className="ml-auto"><Kbd>⌘D</Kbd></span></ContextMenuItem>
        <ContextMenuItem disabled={selection.length < 2} onClick={() => useEditor.getState().groupSelected()}><Group className="h-3.5 w-3.5" /> Group <span className="ml-auto"><Kbd>⌘G</Kbd></span></ContextMenuItem>
        <ContextMenuItem disabled={!selection.length} onClick={() => useEditor.getState().ungroup()}><Ungroup className="h-3.5 w-3.5" /> Ungroup <span className="ml-auto"><Kbd>⇧⌘G</Kbd></span></ContextMenuItem>
        <ContextMenuItem
          disabled={!selection.length}
          onClick={() => selection.forEach((id) => {
            const idx = project.layers.findIndex((l) => l.id === id);
            useEditor.getState().reorderLayer(id, Math.min(project.layers.length - 1, idx + 1));
          })}
        ><ArrowUpToLine className="h-3.5 w-3.5" /> Bring forward</ContextMenuItem>
        <ContextMenuItem disabled={!selection.length} onClick={() => useEditor.getState().alignSelected('hcenter')}><MoveRight className="h-3.5 w-3.5" /> Centre horizontally</ContextMenuItem>
        <ContextMenuItem disabled={!selection.length} onClick={() => selection.forEach((id) => updateLayer(id, { locked: true }))}><Lock className="h-3.5 w-3.5" /> Lock</ContextMenuItem>
        <ContextMenuItem disabled={!selection.length} onClick={() => selection.forEach((id) => updateLayer(id, { visible: false }))}><EyeOff className="h-3.5 w-3.5" /> Hide</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!selection.length} onClick={() => selection.forEach((id) => useEditor.getState().keyframeProp(id, 'opacity'))}><Sparkles className="h-3.5 w-3.5" /> Keyframe opacity</ContextMenuItem>
        <ContextMenuItem disabled={!selection.length} onClick={() => useEditor.getState().deleteLayers()} className="text-red-400 focus:bg-red-500/10 focus:text-red-300"><Scissors className="h-3.5 w-3.5" /> Delete <span className="ml-auto"><Kbd>⌫</Kbd></span></ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function inputFocused() {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement)?.isContentEditable;
}

export { inputFocused };
