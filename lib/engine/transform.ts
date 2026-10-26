import type { Layer, Project } from './types';
import { invert, layerQuad, localMatrix, mul, resolveLayer, transformPoint, worldMatrix, type Mat } from './animation';
import { clamp } from '@/lib/utils';

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rotate';
export interface Pt { x: number; y: number }

export function parentMatrix(layer: Layer, all: Layer[], time: number): Mat {
  const byId = new Map(all.map((l) => [l.id, l]));
  const chain: Layer[] = [];
  let cur = layer.parentId ? byId.get(layer.parentId) : undefined;
  let guard = 0;
  while (cur && guard++ < 16) { chain.unshift(cur); cur = cur.parentId ? byId.get(cur.parentId) : undefined; }
  let m: Mat = [1, 0, 0, 1, 0, 0];
  for (const l of chain) m = mul(m, localMatrix({ ...l, anchorX: 0, anchorY: 0 }, time));
  return m;
}

export function toParentSpace(layer: Layer, all: Layer[], time: number, world: Pt): Pt {
  const pm = parentMatrix(layer, all, time);
  const [x, y] = transformPoint(invert(pm), world.x, world.y);
  return { x, y };
}

export function sceneToScreen(x: number, y: number, view: { zoom: number; panX: number; panY: number }): Pt {
  return { x: x * view.zoom + view.panX, y: y * view.zoom + view.panY };
}
export function screenToScene(x: number, y: number, view: { zoom: number; panX: number; panY: number }): Pt {
  return { x: (x - view.panX) / view.zoom, y: (y - view.panY) / view.zoom };
}

export function handlePositions(layer: Layer, all: Layer[], time: number): Record<Handle, Pt> {
  const r = resolveLayer(layer, time);
  const wm = worldMatrix(layer, all, time);
  const p = (lx: number, ly: number) => { const [x, y] = transformPoint(wm, lx, ly); return { x, y }; };
  return {
    nw: p(0, 0), n: p(r.w / 2, 0), ne: p(r.w, 0), e: p(r.w, r.h / 2),
    se: p(r.w, r.h), s: p(r.w / 2, r.h), sw: p(0, r.h), w: p(0, r.h / 2),
    rotate: p(r.w / 2, -28 / Math.max(0.001, 1)),
  };
}

export interface ResizeResult { x: number; y: number; w: number; h: number; rotation: number; scaleX: number; scaleY: number }

/** Resize a layer by dragging a handle. Keeps the opposite corner pinned in world space. */
export function resizeLayer(layer: Layer, all: Layer[], time: number, handle: Handle, pointerWorld: Pt, opts: { keepRatio?: boolean; fromCenter?: boolean } = {}): ResizeResult {
  const r = resolveLayer(layer, time);
  const wm = worldMatrix(layer, all, time);
  const [lx, ly] = transformPoint(invert(wm), pointerWorld.x, pointerWorld.y);
  let x0 = 0, y0 = 0, x1 = r.w, y1 = r.h;
  const west = handle.includes('w'), east = handle.includes('e'), north = handle.includes('n'), south = handle.includes('s');

  if (opts.fromCenter) {
    const dx = Math.abs(lx - r.w / 2), dy = Math.abs(ly - r.h / 2);
    if (east || west) { x0 = r.w / 2 - dx; x1 = r.w / 2 + dx; }
    if (north || south) { y0 = r.h / 2 - dy; y1 = r.h / 2 + dy; }
    if (handle === 'e' || handle === 'w') { y0 = 0; y1 = r.h; }
    if (handle === 'n' || handle === 's') { x0 = 0; x1 = r.w; }
  } else {
    if (east) x1 = lx;
    if (west) x0 = lx;
    if (south) y1 = ly;
    if (north) y0 = ly;
  }

  let newW = Math.max(4, Math.abs(x1 - x0));
  let newH = Math.max(4, Math.abs(y1 - y0));
  if (opts.keepRatio && r.h !== 0) {
    const ratio = r.w / r.h;
    if (Math.abs(newW / newH) > ratio) newW = newH * ratio; else newH = newW / ratio;
  }
  const anchorX = layer.anchorX ?? 0, anchorY = layer.anchorY ?? 0;
  const fx = west ? newW : 0;
  const fy = north ? newH : 0;

  const origFixed: Pt = opts.fromCenter
    ? { x: layer.x + anchorX * r.w, y: layer.y + anchorY * r.h }
    : { x: 0, y: 0 };
  let parentTarget: Pt;
  if (opts.fromCenter) {
    parentTarget = origFixed;
  } else {
    const px = west ? 0 : r.w;
    const py = north ? 0 : r.h;
    const [wx, wy] = transformPoint(wm, px, py);
    const [wxp, wyp] = transformPoint(invert(parentMatrix(layer, all, time)), wx, wy);
    parentTarget = { x: wxp, y: wyp };
  }

  const temp = localMatrix({ ...layer, w: newW, h: newH, x: 0, y: 0 }, time);
  const offx = temp[0] * fx + temp[2] * fy;
  const offy = temp[1] * fx + temp[3] * fy;
  const nx = opts.fromCenter ? layer.x : parentTarget.x - offx;
  const ny = opts.fromCenter ? layer.y : parentTarget.y - offy;

  return { x: nx, y: ny, w: newW, h: newH, rotation: layer.rotation, scaleX: layer.scaleX, scaleY: layer.scaleY };
}

export function rotationFromPointer(layer: Layer, all: Layer[], time: number, pointerWorld: Pt, start: { pointer: Pt; rotation: number }): number {
  const r = resolveLayer(layer, time);
  const px = layer.x + (layer.anchorX ?? 0) * r.w;
  const py = layer.y + (layer.anchorY ?? 0) * r.h;
  const a0 = Math.atan2(start.pointer.y - py, start.pointer.x - px);
  const a1 = Math.atan2(pointerWorld.y - py, pointerWorld.x - px);
  let deg = start.rotation + ((a1 - a0) * 180) / Math.PI;
  deg = ((deg + 180) % 360 + 360) % 360 - 180;
  return Math.round(deg * 10) / 10;
}

export interface SnapResult { dx: number; dy: number; x: number | null; y: number | null }

/** Edge/center snapping against the artboard and other layers. */
export function computeSnap(project: Project, movingIds: string[], box: { x: number; y: number; w: number; h: number }, threshold: number): SnapResult {
  const targets: { x: number[]; y: number[] } = { x: [0, project.width / 2, project.width], y: [0, project.height / 2, project.height] };
  for (const l of project.layers) {
    if (movingIds.includes(l.id) || !l.visible) continue;
    if (l.parentId && movingIds.includes(l.parentId)) continue;
    const r = resolveLayer(l, 0);
    targets.x.push(r.x, r.x + r.w / 2, r.x + r.w);
    targets.y.push(r.y, r.y + r.h / 2, r.y + r.h);
  }
  const movX = [box.x, box.x + box.w / 2, box.x + box.w];
  const movY = [box.y, box.y + box.h / 2, box.y + box.h];
  let bestX: { delta: number; line: number } | null = null;
  let bestY: { delta: number; line: number } | null = null;
  for (const t of targets.x) for (const m of movX) {
    const d = t - m;
    if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.delta))) bestX = { delta: d, line: t };
  }
  for (const t of targets.y) for (const m of movY) {
    const d = t - m;
    if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.delta))) bestY = { delta: d, line: t };
  }
  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0, x: bestX?.line ?? null, y: bestY?.line ?? null };
}

export function unionBox(layers: Layer[], time: number) {
  const boxes = layers.map((l) => resolveLayer(l, time));
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const x2 = Math.max(...boxes.map((b) => b.x + b.w));
  const y2 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: x2 - x, h: y2 - y };
}

export function isQuadHit(quad: [number, number][], p: Pt) {
  let inside = false;
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const [xi, yi] = quad[i], [xj, yj] = quad[j];
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  return inside;
}

export function snapAngle(deg: number, step = 15, enabled = true) {
  return enabled ? Math.round(deg / step) * step : deg;
}

export function nudge(layer: Layer, dx: number, dy: number): Partial<Layer> {
  return { x: layer.x + dx, y: layer.y + dy };
}

export function clampBox(v: number) { return clamp(v, -100000, 100000); }
