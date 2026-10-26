import type { Easing } from './types';

/** Cubic-bezier solver (Newton–Raphson + bisection fallback), same maths as CSS. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveX = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleX(t) - x;
      if (Math.abs(dx) < 1e-6) return t;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= dx / d;
    }
    let lo = 0, hi = 1;
    t = x;
    while (lo < hi) {
      const v = sampleX(t);
      if (Math.abs(v - x) < 1e-6) return t;
      if (v > x) hi = t; else lo = t;
      t = (lo + hi) / 2;
      if (hi - lo < 1e-7) break;
    }
    return t;
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveX(x)));
}

const BEZIER_PRESETS: Record<string, [number, number, number, number]> = {
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  standard: [0.4, 0, 0.2, 1],
};

/** Evaluates an easing curve for a normalized progress t ∈ [0,1]. */
export function evalEasing(easing: Easing | undefined, t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const type = easing?.type ?? 'easeInOut';
  switch (type) {
    case 'linear': return t;
    case 'hold': case 'stepStart': return 0;
    case 'stepEnd': return t >= 1 ? 1 : 0;
    case 'easeIn': return cubicBezier(...BEZIER_PRESETS.easeIn)(t);
    case 'easeOut': return cubicBezier(...BEZIER_PRESETS.easeOut)(t);
    case 'easeInOut': return cubicBezier(...BEZIER_PRESETS.easeInOut)(t);
    case 'bezier': {
      const b = easing?.bezier ?? BEZIER_PRESETS.standard;
      return cubicBezier(b[0], b[1], b[2], b[3])(t);
    }
    case 'bounce': {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
    case 'elastic': {
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    case 'spring': {
      const stiffness = easing?.stiffness ?? 170;
      const damping = easing?.damping ?? 14;
      const w0 = Math.sqrt(stiffness) / 4;
      const zeta = damping / (2 * Math.sqrt(stiffness));
      if (zeta < 1) {
        const wd = w0 * Math.sqrt(1 - zeta * zeta);
        return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
      }
      return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    }
    default: return t;
  }
}

export const EASING_PRESETS: { id: string; label: string; easing: Easing; curve: [number, number, number, number] }[] = [
  { id: 'linear', label: 'Linear', easing: { type: 'linear' }, curve: [0, 0, 1, 1] },
  { id: 'easeInOut', label: 'Ease In Out', easing: { type: 'easeInOut' }, curve: [0.42, 0, 0.58, 1] },
  { id: 'easeOut', label: 'Ease Out', easing: { type: 'easeOut' }, curve: [0, 0, 0.58, 1] },
  { id: 'easeIn', label: 'Ease In', easing: { type: 'easeIn' }, curve: [0.42, 0, 1, 1] },
  { id: 'expoOut', label: 'Expo Out', easing: { type: 'bezier', bezier: [0.16, 1, 0.3, 1] }, curve: [0.16, 1, 0.3, 1] },
  { id: 'backOut', label: 'Back Out', easing: { type: 'bezier', bezier: [0.34, 1.56, 0.64, 1] }, curve: [0.34, 1.56, 0.64, 1] },
  { id: 'spring', label: 'Spring', easing: { type: 'spring', stiffness: 170, damping: 14 }, curve: [0.34, 1.2, 0.64, 1] },
  { id: 'bounce', label: 'Bounce', easing: { type: 'bounce' }, curve: [0.34, 1.3, 0.64, 1] },
  { id: 'elastic', label: 'Elastic', easing: { type: 'elastic' }, curve: [0.5, 1.4, 0.7, 1] },
  { id: 'hold', label: 'Hold', easing: { type: 'hold' }, curve: [0, 0, 0, 1] },
];

export const EASING_LABELS: Record<string, string> = Object.fromEntries(EASING_PRESETS.map((p) => [p.id, p.label]));
