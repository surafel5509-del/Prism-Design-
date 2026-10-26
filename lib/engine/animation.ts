import type { Keyframe, Layer, Project, AnimatableProp, PropValue } from './types';
import { evalEasing } from './easing';

export interface SampleValue { num: number; pair?: [number, number] }

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

/** Sample one keyframed channel at `time` (seconds), holding before/after the range. */
export interface Sampled { value: number; pair?: [number, number]; color?: string }

/** Sample one keyframed channel at `time` (seconds), holding before/after the range. */
export function sampleChannel(kfs: Keyframe[] | undefined, time: number, fallback: number): Sampled {
  if (!kfs || kfs.length === 0) return { value: fallback };
  const sorted = kfs;
  const valueOf = (v: PropValue): Sampled => {
    if (Array.isArray(v)) return { value: v[1], pair: [v[0], v[1]] };
    if (typeof v === 'string') return { value: fallback, color: v };
    return { value: v };
  };
  if (time <= sorted[0].time) return valueOf(sorted[0].value);
  const last = sorted[sorted.length - 1];
  if (time >= last.time) return valueOf(last.value);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time || 1e-6;
      const raw = (time - a.time) / span;
      const t = evalEasing(a.easing, raw);
      const av = a.value;
      const bv = b.value;
      if (Array.isArray(av) && Array.isArray(bv)) {
        return { value: lerp(av[1], bv[1], t), pair: [lerp(av[0], bv[0], t), lerp(av[1], bv[1], t)] };
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        const ca = parseHex(av), cb = parseHex(bv);
        if (ca && cb) {
          const r = Math.round(lerp(ca[0], cb[0], t));
          const g = Math.round(lerp(ca[1], cb[1], t));
          const bl = Math.round(lerp(ca[2], cb[2], t));
          const hex = '#' + [r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('');
          return { value: fallback, color: hex };
        }
        return { value: fallback };
      }
      return { value: lerp(Number(av), Number(bv), t) };
    }
  }
  return valueOf(last.value);
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

export interface ResolvedLayer {
  x: number; y: number; w: number; h: number;
  rotation: number; scaleX: number; scaleY: number; skewX: number; skewY: number;
  opacity: number; cornerRadius: number; fontSize: number; letterSpacing: number; strokeWidth: number;
  blur: number; brightness: number; saturate: number; hue: number;
  visible: boolean;
}

const DEFAULT_PROPS: Omit<ResolvedLayer, 'x' | 'y' | 'w' | 'h' | 'rotation' | 'scaleX' | 'scaleY' | 'skewX' | 'skewY' | 'opacity' | 'visible'> = {
  cornerRadius: 0, fontSize: 48, letterSpacing: 0, strokeWidth: 0, blur: 0, brightness: 100, saturate: 100, hue: 0,
};

export function isLayerActiveAt(layer: Layer, time: number): boolean {
  const start = layer.startTime ?? 0;
  const end = layer.endTime ?? Infinity;
  return time >= start - 1e-4 && time <= end + 1e-4;
}

/** Full resolved (animated) state of a layer at a given time. */
export function resolveLayer(layer: Layer, time: number): ResolvedLayer {
  const k = layer.keyframes ?? {};
  const x = sampleChannel(k.x, time, layer.x);
  const y = sampleChannel(k.y, time, layer.y);
  const w = sampleChannel(k.w, time, layer.w);
  const h = sampleChannel(k.h, time, layer.h);
  const rot = sampleChannel(k.rotation, time, layer.rotation);
  const sx = sampleChannel(k.scaleX, time, layer.scaleX ?? 1);
  const sy = sampleChannel(k.scaleY, time, layer.scaleY ?? 1);
  const op = sampleChannel(k.opacity, time, layer.opacity);
  let px = x.pair ? x.pair[0] : x.value;
  let py = y.pair ? y.pair[1] : y.value;
  let rotation = rot.value;

  if (layer.motionPath?.points?.length) {
    const mp = layer.motionPath.points;
    const t = Math.max(0, Math.min(1, mp.length === 1 ? 0 : layer.motionPath.progress ?? 0));
    const seg = (mp.length - 1) * t;
    const i = Math.min(Math.floor(seg), mp.length - 2);
    const f = seg - i;
    const p0 = mp[Math.max(0, i)];
    const p1 = mp[Math.min(mp.length - 1, i + 1)];
    if (p0 && p1) {
      px = lerp(p0[0], p1[0], f);
      py = lerp(p0[1], p1[1], f);
      if (layer.motionPath.orient) rotation += (Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180) / Math.PI;
    }
  }

  return {
    ...DEFAULT_PROPS,
    x: px, y: py, w: Math.max(0, w.value), h: Math.max(0, h.value),
    rotation, scaleX: sx.value, scaleY: sy.value,
    skewX: layer.skewX ?? 0, skewY: layer.skewY ?? 0,
    opacity: Math.max(0, Math.min(1, op.value)),
    cornerRadius: sampleChannel(k.cornerRadius, time, layer.radius ?? DEFAULT_PROPS.cornerRadius).value,
    fontSize: sampleChannel(k.fontSize, time, layer.text?.fontSize ?? DEFAULT_PROPS.fontSize).value,
    letterSpacing: sampleChannel(k.letterSpacing, time, layer.text?.letterSpacing ?? 0).value,
    strokeWidth: sampleChannel(k.strokeWidth, time, layer.strokeWidth ?? 0).value,
    blur: sampleChannel(k.blur, time, 0).value,
    brightness: sampleChannel(k.brightness, time, 100).value,
    saturate: sampleChannel(k.saturate, time, 100).value,
    hue: sampleChannel(k.hue, time, 0).value,
    visible: layer.visible && isLayerActiveAt(layer, time),
  };
}

/** Kinetic-typography progress for a text layer: [0..1] reveal + per-glyph stagger. */
export function textAnimatorState(layer: Layer, time: number): { progress: number; type: string } | null {
  const anim = layer.text?.animator;
  if (!anim) return null;
  const elapsed = Math.max(0, time - layer.startTime - (anim.delay ?? 0));
  const dur = Math.max(0.001, anim.duration || 0.6);
  return { progress: Math.min(1, elapsed / dur), type: anim.type };
}

// ── Affine matrices (a,b,c,d,e,f) — used for hit-testing and overlay handles ──
export type Mat = [number, number, number, number, number, number];
export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

export function mul(m1: Mat, m2: Mat): Mat {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export function transformPoint(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-9;
  return [
    m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
    (m[2] * m[5] - m[3] * m[4]) / det,
    (m[1] * m[4] - m[0] * m[5]) / det,
  ];
}

export function localMatrix(layer: Layer, time: number): Mat {
  const r = resolveLayer(layer, time);
  const a = (r.rotation * Math.PI) / 180;
  const sx = r.scaleX === 0 ? 1e-6 : r.scaleX;
  const sy = r.scaleY === 0 ? 1e-6 : r.scaleY;
  const skx = ((r.skewX ?? 0) * Math.PI) / 180;
  const sky = ((r.skewY ?? 0) * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  // T(x + anchorX*w, y + anchorY*h) · R · Skew · S · T(-anchorX*w, -anchorY*h)
  const m: Mat = [
    cos * sx, sin * sx,
    -sin * sy + Math.tan(skx) * cos * sy, cos * sy + Math.tan(sky) * sin * sx,
    0, 0,
  ];
  const ax = (layer.anchorX ?? 0) * r.w;
  const ay = (layer.anchorY ?? 0) * r.h;
  const e = r.x + ax - (m[0] * ax + m[2] * ay);
  const f = r.y + ay - (m[1] * ax + m[3] * ay);
  return [m[0], m[1], m[2], m[3], e, f];
}

/** World matrix = composition of ancestor group transforms. */
export function worldMatrix(layer: Layer, all: Layer[], time: number): Mat {
  const byId = new Map(all.map((l) => [l.id, l]));
  const chain: Layer[] = [];
  let cur: Layer | undefined = layer;
  let guard = 0;
  while (cur && guard++ < 24) {
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  let m: Mat = IDENTITY;
  for (const l of chain) {
    // Groups only contribute translation/rotation/scale, not their size anchor.
    m = mul(m, localMatrix(l.type === 'group' ? { ...l, anchorX: 0, anchorY: 0 } : l, time));
  }
  return m;
}

export function layerQuad(layer: Layer, all: Layer[], time: number): [number, number][] {
  const r = resolveLayer(layer, time);
  const m = worldMatrix(layer, all, time);
  return [
    transformPoint(m, 0, 0),
    transformPoint(m, r.w, 0),
    transformPoint(m, r.w, r.h),
    transformPoint(m, 0, r.h),
  ];
}

export function hitTest(project: Project, time: number, x: number, y: number): Layer | null {
  const roots = project.layers.filter((l) => !l.parentId);
  const ordered = [...project.layers].reverse();
  for (const layer of ordered) {
    if (!layer.visible || layer.locked || layer.type === 'group' || layer.type === 'audio') continue;
    const r = resolveLayer(layer, time);
    if (!r.visible) continue;
    const m = worldMatrix(layer, project.layers, time);
    const [lx, ly] = transformPoint(invert(m), x, y);
    if (lx >= 0 && ly >= 0 && lx <= r.w && ly <= r.h) return layer;
  }
  void roots;
  return null;
}

export function getPropertyValue(layer: Layer, prop: AnimatableProp): PropValue {
  if (prop === 'x' || prop === 'y') return layer[prop];
  if (prop === 'w' || prop === 'h') return layer[prop];
  if (prop === 'rotation') return layer.rotation;
  if (prop === 'scaleX') return layer.scaleX;
  if (prop === 'scaleY') return layer.scaleY;
  if (prop === 'opacity') return layer.opacity;
  if (prop === 'cornerRadius') return layer.radius ?? 0;
  if (prop === 'fontSize') return layer.text?.fontSize ?? 48;
  if (prop === 'letterSpacing') return layer.text?.letterSpacing ?? 0;
  if (prop === 'strokeWidth') return layer.strokeWidth ?? 0;
  return 0;
}

export function zoneProgress(start: number, end: number, time: number) {
  return Math.max(0, Math.min(1, (time - start) / Math.max(1e-6, end - start)));
}
