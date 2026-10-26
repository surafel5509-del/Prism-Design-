import type { AnimatableProp, Easing, Keyframe, Layer } from './types';
import { uid } from '@/lib/utils';

const kf = (time: number, value: number | [number, number], easing?: Easing): Keyframe => ({ id: uid('kf'), time, value, easing: easing ?? { type: 'easeInOut' } });
const out: Easing = { type: 'easeOut' };
const expo: Easing = { type: 'bezier', bezier: [0.16, 1, 0.3, 1] };
const spring: Easing = { type: 'spring', stiffness: 170, damping: 14 };
const bounce: Easing = { type: 'bounce' };
const elastic: Easing = { type: 'elastic' };
const easeOut: Easing = out;
const bounceEase: Easing = bounce;

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
  { id: 'flip-in', name: 'Flip in', group: 'In', icon: '⇋', description: '3D card flip', apply: () => ({ scaleX: [kf(0, 0.02), kf(0.7, 1, spring)], opacity: [kf(0, 0), kf(0.2, 1)] }) },
  { id: 'wipe-in', name: 'Wipe in', group: 'In', icon: '⇥', description: 'Reveal from the left', apply: (l) => ({ x: [kf(0, l.x - 260), kf(0.8, l.x, expo)], opacity: [kf(0, 0), kf(0.35, 1)] }) },
  { id: 'drop-in', name: 'Drop in', group: 'In', icon: '↓', description: 'Gravity drop with bounce', apply: (l) => ({ y: [kf(0, l.y - 420), kf(0.62, l.y, bounceEase)], scaleY: [kf(0, 0.86), kf(0.62, 1, spring)] }) },
  { id: 'unfold', name: 'Unfold', group: 'In', icon: '⊞', description: 'Height unfold', apply: () => ({ scaleY: [kf(0, 0.05), kf(0.85, 1, spring)], opacity: [kf(0, 0), kf(0.3, 1)] }) },
  { id: 'zoom-blur', name: 'Zoom blur', group: 'In', icon: '⊚', description: 'Rush in with motion blur', apply: () => ({ scaleX: [kf(0, 1.6), kf(0.9, 1, expo)], scaleY: [kf(0, 1.6), kf(0.9, 1, expo)], blur: [kf(0, 26), kf(0.8, 0)], opacity: [kf(0, 0), kf(0.25, 1)] }) },
  { id: 'squeeze-out', name: 'Squeeze out', group: 'Out', icon: '⇥', description: 'Collapse sideways', apply: (l, d) => ({ scaleX: [kf(Math.max(0, d - 0.6), 1), kf(d, 0.02, out)], opacity: [kf(Math.max(0, d - 0.3), 1), kf(d, 0)] }) },
  { id: 'lift-out', name: 'Lift out', group: 'Out', icon: '⇧', description: 'Float up and fade', apply: (l, d) => ({ y: [kf(Math.max(0, d - 0.8), l.y), kf(d, l.y - 140, out)], opacity: [kf(Math.max(0, d - 0.5), 1), kf(d, 0)] }) },
  { id: 'blur-out', name: 'Blur out', group: 'Out', icon: '❊', description: 'Defocus exit', apply: (_l, d) => ({ blur: [kf(Math.max(0, d - 0.6), 0), kf(d, 30)], opacity: [kf(Math.max(0, d - 0.4), 1), kf(d, 0)] }) },
  { id: 'orbit', name: 'Orbit', group: 'Loop', icon: '◌', description: 'Circular drift', apply: (l) => ({ x: [kf(0, l.x), kf(1.5, l.x + 70), kf(3, l.x), kf(4.5, l.x - 70), kf(6, l.x)], y: [kf(0, l.y), kf(1.5, l.y - 50), kf(3, l.y - 100), kf(4.5, l.y - 50), kf(6, l.y)] }) },
  { id: 'breathe', name: 'Breathe', group: 'Loop', icon: '◍', description: 'Slow opacity breath', apply: () => ({ opacity: [kf(0, 1), kf(1.8, 0.45), kf(3.6, 1)], scaleX: [kf(0, 1), kf(1.8, 1.03), kf(3.6, 1)], scaleY: [kf(0, 1), kf(1.8, 1.03), kf(3.6, 1)] }) },
  { id: 'marquee', name: 'Marquee', group: 'Loop', icon: '⇠', description: 'Endless horizontal scroll', apply: (l) => ({ x: [kf(0, l.x), kf(4, l.x - 320, { type: 'linear' })] }) },
  { id: 'shimmer', name: 'Shimmer', group: 'Emphasis', icon: '✦', description: 'Light sweep highlight', apply: () => ({ brightness: [kf(0, 100), kf(0.5, 160), kf(1, 100)], opacity: [kf(0, 1), kf(0.5, 0.92), kf(1, 1)] }) },
  { id: 'rubber', name: 'Rubber band', group: 'Emphasis', icon: '∿', description: 'Elastic squash', apply: () => ({ scaleX: [kf(0, 1), kf(0.25, 1.14), kf(0.5, 0.92), kf(0.75, 1.05), kf(1, 1, elastic)], scaleY: [kf(0, 1), kf(0.25, 0.9), kf(0.5, 1.08), kf(0.75, 0.97), kf(1, 1, elastic)] }) },
  { id: 'heartbeat', name: 'Heartbeat', group: 'Emphasis', icon: '♥', description: 'Double thump', apply: () => ({ scaleX: [kf(0, 1), kf(0.12, 1.16), kf(0.24, 1), kf(0.36, 1.1), kf(0.54, 1)], scaleY: [kf(0, 1), kf(0.12, 1.16), kf(0.24, 1), kf(0.36, 1.1), kf(0.54, 1)] }) },
  { id: 'whip', name: 'Whip pan', group: 'Emphasis', icon: '⇢', description: 'Fast blur pan', apply: (l) => ({ x: [kf(0, l.x), kf(0.22, l.x + 34), kf(0.5, l.x)], blur: [kf(0, 0), kf(0.15, 18), kf(0.45, 0)] }) },
  { id: 'counter-spin', name: 'Counter spin', group: 'Emphasis', icon: '↺', description: 'Spin and settle back', apply: (l) => ({ rotation: [kf(0, l.rotation), kf(0.7, l.rotation - 180, spring), kf(1.2, l.rotation, spring)] }) },
  { id: 'glitch-slam', name: 'Glitch slam', group: 'Emphasis', icon: '⚡', description: 'Hard cut impact', apply: (l) => ({ x: [kf(0, l.x), kf(0.05, l.x + 18), kf(0.1, l.x - 12), kf(0.16, l.x)], scaleX: [kf(0, 1.3), kf(0.14, 1, expo)], scaleY: [kf(0, 1.3), kf(0.14, 1, expo)], hue: [kf(0, 0), kf(0.08, 60), kf(0.2, 0)] }) },
  { id: 'build-up', name: 'Build up', group: 'In', icon: '▲', description: 'Stack up from below', apply: (l) => ({ y: [kf(0, l.y + 120), kf(0.9, l.y, expo)], scaleY: [kf(0, 0.6), kf(0.9, 1, spring)], opacity: [kf(0, 0), kf(0.4, 1)] }) },
  { id: 'tilt-in', name: 'Tilt in', group: 'In', icon: '◣', description: 'Angled settle', apply: (l) => ({ rotation: [kf(0, l.rotation - 8), kf(0.9, l.rotation, spring)], x: [kf(0, l.x - 90), kf(0.9, l.x, expo)], opacity: [kf(0, 0), kf(0.5, 1)] }) },

  { id: 'pop-in', name: 'Pop in', group: 'In', icon: '◍', description: 'Overshoot scale entrance', apply: () => ({ scaleX: [kf(0, 0.72), kf(0.35, 1.08, out), kf(0.6, 1, spring)], scaleY: [kf(0, 0.72), kf(0.35, 1.08, out), kf(0.6, 1, spring)], opacity: [kf(0, 0), kf(0.2, 1)] }) },
  { id: 'tumble-in', name: 'Tumble in', group: 'In', icon: '↯', description: 'Fall and rotate into place', apply: (l) => ({ y: [kf(0, l.y - 220), kf(0.8, l.y, expo)], rotation: [kf(0, l.rotation - 90), kf(0.9, l.rotation, spring)], opacity: [kf(0, 0), kf(0.3, 1)] }) },
  { id: 'slide-down-in', name: 'Slide down', group: 'In', icon: '↓', description: 'Descend into frame', apply: (l) => ({ y: [kf(0, l.y - 90), kf(0.7, l.y, expo)], opacity: [kf(0, 0), kf(0.4, 1)] }) },
  { id: 'iris-in', name: 'Iris in', group: 'In', icon: '◎', description: 'Focus-pull scale reveal', apply: () => ({ scaleX: [kf(0, 1.3), kf(0.8, 1, expo)], scaleY: [kf(0, 1.3), kf(0.8, 1, expo)], blur: [kf(0, 18), kf(0.7, 0)], opacity: [kf(0, 0), kf(0.3, 1)] }) },
  { id: 'flicker-in', name: 'Flicker in', group: 'In', icon: '⚡', description: 'Neon stutter entrance', apply: () => ({ opacity: [kf(0, 0), kf(0.12, 1), kf(0.2, 0.15), kf(0.32, 1), kf(0.4, 0.4), kf(0.56, 1)] }) },
  { id: 'drop-out', name: 'Drop out', group: 'Out', icon: '⇩', description: 'Gravity exit', apply: (l, d) => ({ y: [kf(Math.max(0, d - 0.6), l.y), kf(d, l.y + 240, `linear` as unknown as Easing)], opacity: [kf(Math.max(0, d - 0.35), 1), kf(d, 0)], rotation: [kf(Math.max(0, d - 0.6), l.rotation), kf(d, l.rotation + 9)] }) },
  { id: 'zoom-out', name: 'Zoom out', group: 'Out', icon: '⊖', description: 'Rush past camera', apply: (_l, d) => ({ scaleX: [kf(Math.max(0, d - 0.7), 1), kf(d, 1.8, expo)], scaleY: [kf(Math.max(0, d - 0.7), 1), kf(d, 1.8, expo)], opacity: [kf(Math.max(0, d - 0.5), 1), kf(d, 0)] }) },
  { id: 'spin-out', name: 'Spin out', group: 'Out', icon: '⟲', description: 'Rotate away', apply: (l, d) => ({ rotation: [kf(Math.max(0, d - 0.7), l.rotation), kf(d, l.rotation - 140)], scaleX: [kf(Math.max(0, d - 0.7), 1), kf(d, 0.4)], scaleY: [kf(Math.max(0, d - 0.7), 1), kf(d, 0.4)], opacity: [kf(Math.max(0, d - 0.5), 1), kf(d, 0)] }) },
  { id: 'wipe-out', name: 'Wipe out', group: 'Out', icon: '⇤', description: 'Slide away left', apply: (l, d) => ({ x: [kf(Math.max(0, d - 0.7), l.x), kf(d, l.x - 260, expo)], opacity: [kf(Math.max(0, d - 0.5), 1), kf(d, 0)] }) },
  { id: 'bob', name: 'Bob', group: 'Loop', icon: '〜', description: 'Buoyant vertical loop', apply: (l) => ({ y: [kf(0, l.y), kf(0.9, l.y - 26, { type: 'easeInOut' }), kf(1.8, l.y, { type: 'easeInOut' })] }) },
  { id: 'floatrotate', name: 'Float + rotate', group: 'Loop', icon: '◌', description: 'Slow orbital tilt', apply: (l) => ({ y: [kf(0, l.y), kf(2.4, l.y - 30), kf(4.8, l.y)], rotation: [kf(0, l.rotation - 4), kf(2.4, l.rotation + 4), kf(4.8, l.rotation - 4)] }) },
  { id: 'hue-cycle', name: 'Hue cycle', group: 'Loop', icon: '🌈', description: 'Endless colour drift', apply: () => ({ hue: [kf(0, 0), kf(6, 360, { type: 'linear' })] }) },
  { id: 'breathe-deep', name: 'Deep breathe', group: 'Loop', icon: '◍', description: 'Slow 4s inhale', apply: () => ({ scaleX: [kf(0, 0.97), kf(2, 1.04), kf(4, 0.97)], scaleY: [kf(0, 0.97), kf(2, 1.04), kf(4, 0.97)] }) },
  { id: 'punch', name: 'Punch', group: 'Emphasis', icon: '◉', description: 'Snap scale hit', apply: () => ({ scaleX: [kf(0, 1), kf(0.1, 0.86), kf(0.22, 1.1), kf(0.36, 1)], scaleY: [kf(0, 1), kf(0.1, 0.86), kf(0.22, 1.1), kf(0.36, 1)] }) },
  { id: 'flash', name: 'Flash', group: 'Emphasis', icon: '✦', description: 'Brightness stinger', apply: () => ({ brightness: [kf(0, 100), kf(0.08, 210), kf(0.3, 100)], opacity: [kf(0, 1), kf(0.08, 0.9), kf(0.3, 1)] }) },
  { id: 'swing', name: 'Swing', group: 'Emphasis', icon: '↭', description: 'Pendulum settle', apply: (l) => ({ rotation: [kf(0, l.rotation), kf(0.3, l.rotation + 14), kf(0.6, l.rotation - 9), kf(0.9, l.rotation + 5), kf(1.2, l.rotation)] }) },
  { id: 'vibrate', name: 'Vibrate', group: 'Emphasis', icon: '↯', description: 'High-frequency shake', apply: (l) => ({ x: [kf(0, l.x), kf(0.04, l.x - 4), kf(0.08, l.x + 4), kf(0.12, l.x - 3), kf(0.16, l.x + 3), kf(0.2, l.x)], rotation: [kf(0, l.rotation), kf(0.05, l.rotation - 1.4), kf(0.1, l.rotation + 1.4), kf(0.2, l.rotation)] }) },
  { id: 'letter-spin', name: 'Letter spin', group: 'Emphasis', icon: '⟳', description: 'Three-quarter twist', apply: (l) => ({ rotation: [kf(0, l.rotation), kf(0.75, l.rotation + 270, expo), kf(1.05, l.rotation + 360)] }) },

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
