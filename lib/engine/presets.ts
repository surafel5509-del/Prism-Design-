import type { AnimatableProp, Easing, Keyframe, Layer } from './types';
import { uid } from '@/lib/utils';

const kf = (time: number, value: number | [number, number], easing?: Easing): Keyframe => ({ id: uid('kf'), time, value, easing: easing ?? { type: 'easeInOut' } });
const out: Easing = { type: 'easeOut' };
const expo: Easing = { type: 'bezier', bezier: [0.16, 1, 0.3, 1] };
const spring: Easing = { type: 'spring', stiffness: 170, damping: 14 };

export interface AnimationPreset {
  id: string;
  name: string;
  group: 'In' | 'Out' | 'Loop' | 'Emphasis';
  icon: string;
  description: string;
  apply: (layer: Layer, duration: number) => Partial<Record<AnimatableProp, Keyframe[]>> | { textAnimator: 'typewriter' | 'wordReveal' | 'charRise' | 'slideUp' | 'blurIn' | 'scaleIn' };
}

export const ANIMATION_PRESETS: AnimationPreset[] = [
  { id: 'fade-in', name: 'Fade in', group: 'In', icon: '◐', description: 'Opacity 0 → 1', apply: () => ({ opacity: [kf(0, 0), kf(0.6, 1, out)] }) },
  { id: 'slide-up', name: 'Slide up', group: 'In', icon: '↑', description: 'Rise into place', apply: (l) => ({ y: [kf(0, l.y + 90), kf(0.7, l.y, expo)], opacity: [kf(0, 0), kf(0.5, 1)] }) },
  { id: 'slide-left', name: 'Slide left', group: 'In', icon: '←', description: 'Enter from the right', apply: (l) => ({ x: [kf(0, l.x + 140), kf(0.7, l.x, expo)], opacity: [kf(0, 0), kf(0.45, 1)] }) },
  { id: 'scale-pop', name: 'Scale pop', group: 'In', icon: '◉', description: 'Spring scale in', apply: () => ({ scaleX: [kf(0, 0.4), kf(0.75, 1, spring)], scaleY: [kf(0, 0.4), kf(0.75, 1, spring)], opacity: [kf(0, 0), kf(0.25, 1)] }) },
  { id: 'rotate-in', name: 'Rotate in', group: 'In', icon: '↻', description: 'Spin + settle', apply: (l) => ({ rotation: [kf(0, l.rotation - 35), kf(0.85, l.rotation, spring)], scaleX: [kf(0, 0.85), kf(0.85, 1)], scaleY: [kf(0, 0.85), kf(0.85, 1)] }) },
  { id: 'blur-in', name: 'Blur in', group: 'In', icon: '❋', description: 'Focus pull reveal', apply: () => ({ blur: [kf(0, 24), kf(0.8, 0, out)], opacity: [kf(0, 0), kf(0.4, 1)] }) },
  { id: 'typewriter', name: 'Typewriter', group: 'In', icon: 'T', description: 'Per-glyph typing', apply: () => ({ textAnimator: 'typewriter' }) },
  { id: 'char-rise', name: 'Char rise', group: 'In', icon: '⋀', description: 'Staggered letters', apply: () => ({ textAnimator: 'charRise' }) },
  { id: 'word-reveal', name: 'Word reveal', group: 'In', icon: '▤', description: 'Word-by-word mask', apply: () => ({ textAnimator: 'wordReveal' }) },
  { id: 'fade-out', name: 'Fade out', group: 'Out', icon: '◑', description: 'Exit with opacity', apply: (_l, d) => ({ opacity: [kf(Math.max(0, d - 0.7), 1), kf(d, 0, `linear` as unknown as Easing)] }) },
  { id: 'slide-out', name: 'Slide out', group: 'Out', icon: '↗', description: 'Rise and vanish', apply: (l, d) => ({ y: [kf(Math.max(0, d - 0.7), l.y), kf(d, l.y - 80, expo)], opacity: [kf(Math.max(0, d - 0.7), 1), kf(d, 0)] }) },
  { id: 'float', name: 'Float', group: 'Loop', icon: '〜', description: 'Gentle vertical drift', apply: (l) => ({ y: [kf(0, l.y), kf(2, l.y - 22), kf(4, l.y, { type: 'easeInOut' })] }) },
  { id: 'pulse', name: 'Pulse', group: 'Loop', icon: '◎', description: 'Breathing scale', apply: () => ({ scaleX: [kf(0, 1), kf(1.2, 1.06), kf(2.4, 1)], scaleY: [kf(0, 1), kf(1.2, 1.06), kf(2.4, 1)] }) },
  { id: 'sway', name: 'Sway', group: 'Loop', icon: '∿', description: 'Slow rotation', apply: (l) => ({ rotation: [kf(0, l.rotation - 3), kf(2, l.rotation + 3), kf(4, l.rotation - 3)] }) },
  { id: 'ken-burns', name: 'Ken Burns', group: 'Loop', icon: '▣', description: 'Slow image push', apply: () => ({ scaleX: [kf(0, 1), kf(8, 1.12)], scaleY: [kf(0, 1), kf(8, 1.12)] }) },
  { id: 'glitch', name: 'Glitch', group: 'Emphasis', icon: '⚡', description: 'Rapid jitter', apply: (l) => ({ x: [kf(0.0, l.x), kf(0.08, l.x - 8), kf(0.16, l.x + 6), kf(0.24, l.x - 3), kf(0.32, l.x)], hue: [kf(0, 0), kf(0.1, 40), kf(0.2, -30), kf(0.35, 0)] }) },
  { id: 'shake', name: 'Shake', group: 'Emphasis', icon: '↯', description: 'Impact shake', apply: (l) => ({ x: [kf(0, l.x), kf(0.06, l.x - 10), kf(0.12, l.x + 9), kf(0.18, l.x - 5), kf(0.26, l.x)] }) },
  { id: 'spin', name: 'Spin', group: 'Emphasis', icon: '⟳', description: 'Full rotation', apply: (l) => ({ rotation: [kf(0, l.rotation), kf(1.2, l.rotation + 360, { type: 'bezier', bezier: [0.16, 1, 0.3, 1] })] }) },
];

export function applyPresetToLayer(layer: Layer, presetId: string, duration: number): { keyframes: Layer['keyframes']; text?: Layer['text'] } {
  const preset = ANIMATION_PRESETS.find((p) => p.id === presetId);
  if (!preset) return { keyframes: layer.keyframes };
  const result = preset.apply(layer, duration);
  if ('textAnimator' in result && result.textAnimator) {
    return {
      keyframes: layer.keyframes,
      text: layer.text ? { ...layer.text, animator: { type: result.textAnimator, duration: 0.9, stagger: 0.04, delay: 0.1 } } : layer.text,
    };
  }
  return { keyframes: { ...layer.keyframes, ...(result as Partial<Record<AnimatableProp, Keyframe[]>>) } };
}
