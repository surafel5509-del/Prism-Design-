import type { Aspect, Easing, Gradient, Keyframe, Layer, TemplateDef, TextProps } from '@/lib/engine/types';
import type { ShapeKind } from '@/lib/engine/types';
import { createShape, createText, gradient } from '@/lib/engine/factory';
import { uid } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
//  Shared primitives for the long-form motion template library.
//  Everything here produces real, editable layers with real keyframes.
// ─────────────────────────────────────────────────────────────────────────────

export interface MotionCtx { w: number; h: number; c: string[]; font: string; dur: number; aspect: Aspect }
export interface MotionFamily {
  id: string; name: string; style: string; category: TemplateDef['category'];
  tags: string[]; aspects: Aspect[]; duration: number; colorways: string[][]; fonts: string[];
  render: (x: MotionCtx) => { layers: Layer[]; background: string; backgroundGradient?: Gradient | null };
}

export const DIMS: Record<Aspect, [number, number]> = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };
export const EASE: Easing = { type: 'bezier', bezier: [0.16, 1, 0.3, 1] };
export const EASE_IO: Easing = { type: 'easeInOut' };
export const LINEAR: Easing = { type: 'linear' };
export const kf = (time: number, value: number | [number, number], easing: Easing = EASE): Keyframe => ({ id: uid('kf'), time, value, easing });

export type Enter = 'fade' | 'up' | 'down' | 'left' | 'right' | 'scale' | 'rise' | 'none';
export type Exit = 'fade' | 'up' | 'down' | 'scale' | 'none';

export const SH = (kind: ShapeKind, [x, y, w, h]: number[], lp: Partial<Layer> = {}) =>
  createShape(kind, { x, y, w, h, endTime: 30, ...lp });
export const TX = (content: string, [x, y, w, h]: number[], tp: Partial<TextProps> = {}, lp: Partial<Layer> = {}) =>
  createText(content, { x, y, w, h, endTime: 30, ...lp }, tp);

export function mergeKeys(l: Layer, prop: keyof Layer['keyframes'], add: Keyframe[]): Layer {
  const existing = l.keyframes[prop] ?? [];
  return { ...l, keyframes: { ...l.keyframes, [prop]: [...existing, ...add].sort((a, b) => a.time - b.time) } };
}

/** Enter a layer at `t0` with real keyframes (never CSS-only tricks). */
export function enter(l: Layer, t0: number, style: Enter = 'up', dur = 0.6): Layer {
  let out: Layer = { ...l, startTime: t0 };
  const end = t0 + dur;
  if (style !== 'none') out = mergeKeys(out, 'opacity', [kf(t0, 0), kf(end, l.opacity, EASE)]);
  if (style === 'up') out = mergeKeys(out, 'y', [kf(t0, l.y + 64), kf(end, l.y)]);
  if (style === 'down') out = mergeKeys(out, 'y', [kf(t0, l.y - 64), kf(end, l.y)]);
  if (style === 'rise') out = mergeKeys(out, 'y', [kf(t0, l.y + 190), kf(end, l.y)]);
  if (style === 'left') out = mergeKeys(out, 'x', [kf(t0, l.x - 90), kf(end, l.x)]);
  if (style === 'right') out = mergeKeys(out, 'x', [kf(t0, l.x + 90), kf(end, l.x)]);
  if (style === 'scale') {
    out = mergeKeys(out, 'scaleX', [kf(t0, 0.55), kf(end, l.scaleX)]);
    out = mergeKeys(out, 'scaleY', [kf(t0, 0.55), kf(end, l.scaleY)]);
  }
  return out;
}

/** Leave at `t1`; the layer's own endTime is clamped so the timeline stays clean. */
export function leave(l: Layer, t1: number, style: Exit = 'fade', dur = 0.45): Layer {
  let out: Layer = { ...l, endTime: t1 };
  const start = Math.max(l.startTime, t1 - dur);
  if (style === 'fade') out = mergeKeys(out, 'opacity', [kf(start, l.opacity), kf(t1, 0, EASE_IO)]);
  if (style === 'up') {
    out = mergeKeys(out, 'opacity', [kf(start, l.opacity), kf(t1, 0, EASE_IO)]);
    out = mergeKeys(out, 'y', [kf(start, l.y), kf(t1, l.y - 50)]);
  }
  if (style === 'down') {
    out = mergeKeys(out, 'opacity', [kf(start, l.opacity), kf(t1, 0, EASE_IO)]);
    out = mergeKeys(out, 'y', [kf(start, l.y), kf(t1, l.y + 50)]);
  }
  if (style === 'scale') {
    out = mergeKeys(out, 'opacity', [kf(start, l.opacity), kf(t1, 0, EASE_IO)]);
    out = mergeKeys(out, 'scaleX', [kf(start, 1), kf(t1, 1.12)]);
    out = mergeKeys(out, 'scaleY', [kf(start, 1), kf(t1, 1.12)]);
  }
  return out;
}

export const scene = (l: Layer, t0: number, t1: number, e: Enter = 'up', x: Exit = 'fade', dur = 0.6) =>
  leave(enter(l, t0, e, dur), t1, x, dur * 0.75);

/** Slow, continuous drift that gives stills a cinematic feel. */
export function drift(l: Layer, from: number, to: number, dx: number, dy: number): Layer {
  let out = mergeKeys(l, 'x', [kf(from, l.x), kf(to, l.x + dx, LINEAR)]);
  out = mergeKeys(out, 'y', [kf(from, l.y), kf(to, l.y + dy, LINEAR)]);
  return out;
}

export const typeScale = (ctx: Pick<MotionCtx, 'w' | 'h'>) => Math.min(ctx.w / 1080, ctx.h / 1080);

export function mix(hex: string, other: string, t: number): string {
  const p = (h: string) => h.replace('#', '').padEnd(6, 'f').slice(0, 6).match(/.{2}/g)!.map((v) => parseInt(v, 16));
  const a = p(hex), b = p(other);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export const alpha = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
};

export const MONO = 'JetBrains Mono';
export { gradient };
