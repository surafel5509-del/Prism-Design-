import type { EasingName, EvaluatedLayer, Keyframe, Layer } from "./types";

const c1 = 1.70158;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;

export const EASINGS: Record<EasingName, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutBack: (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  easeOutElastic: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1,
  easeOutBounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  spring: (t) => 1 - Math.exp(-6 * t) * Math.cos(10 * t),
};

export const EASING_NAMES = Object.keys(EASINGS) as EasingName[];

/** Cubic-bezier solver (for the easing editor / custom curves). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return (x: number) => {
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24; i++) {
      const u = 1 - t;
      const cx = 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
      if (Math.abs(cx - x) < 1e-5) break;
      if (cx < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    const u = 1 - t;
    return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
  };
}

function valueAt(keyframes: Keyframe[], property: Keyframe["property"], base: number, time: number): number {
  const kfs = keyframes.filter((k) => k.property === property).sort((a, b) => a.time - b.time);
  if (kfs.length === 0) return base;
  if (time <= kfs[0].time) return kfs[0].value;
  const last = kfs[kfs.length - 1];
  if (time >= last.time) return last.value;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time;
      const local = span === 0 ? 1 : (time - a.time) / span;
      const eased = (EASINGS[b.easing] ?? EASINGS.linear)(local);
      return a.value + (b.value - a.value) * eased;
    }
  }
  return last.value;
}

/** Evaluate a layer's animated transform/opacity at composition time `t` (seconds). */
export function evaluateLayer(layer: Layer, t: number): EvaluatedLayer {
  const active = layer.visible && t >= layer.startTime - 1e-6 && t <= layer.startTime + layer.duration + 1e-6;
  return {
    ...layer,
    _active: active,
    _x: valueAt(layer.keyframes, "x", layer.x, t),
    _y: valueAt(layer.keyframes, "y", layer.y, t),
    _scale: valueAt(layer.keyframes, "scale", layer.scale, t),
    _scaleX: valueAt(layer.keyframes, "scaleX", 1, t),
    _scaleY: valueAt(layer.keyframes, "scaleY", 1, t),
    _rotation: valueAt(layer.keyframes, "rotation", layer.rotation, t),
    _opacity: Math.max(0, Math.min(1, valueAt(layer.keyframes, "opacity", layer.opacity, t))),
  };
}

export function gradientCss(g: { kind: string; angle?: number; stops: { offset: number; color: string }[] }): string {
  const stops = g.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ");
  if (g.kind === "radial") return `radial-gradient(circle at 50% 40%, ${stops})`;
  if (g.kind === "conic") return `conic-gradient(from ${g.angle ?? 0}deg, ${stops})`;
  return `linear-gradient(${g.angle ?? 135}deg, ${stops})`;
}
