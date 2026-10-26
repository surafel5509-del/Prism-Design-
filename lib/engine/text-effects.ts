import type { Effect, Layer, TextProps } from './types';
import { gradient } from './factory';
import { uid } from '@/lib/utils';

/** Typographic treatments. Each one is a real, editable patch: gradients, strokes,
 *  effects and opacity — never a flattened image. */
export interface TextEffectDef {
  id: string;
  name: string;
  description: string;
  group: 'Fill' | 'Depth' | 'Glow' | 'Print' | 'Motion';
  apply: (layer: Layer, accent?: string) => Partial<Layer>;
}

const fx = (type: Effect['type'], amount: number, extras: Partial<Effect> = {}): Effect => ({ id: uid('fx'), type, enabled: true, amount, ...extras });

const baseText = (layer: Layer): TextProps => layer.text ?? {
  content: 'Type', fontFamily: 'Inter', fontSize: 72, fontWeight: 700, fontStyle: 'normal', lineHeight: 1.05,
  letterSpacing: -1, align: 'left', color: '#ffffff', gradient: null, uppercase: false, strokeWidth: 0, padding: 0, animator: null,
};

export const TEXT_EFFECTS: TextEffectDef[] = [
  {
    id: 'chrome', name: 'Liquid chrome', group: 'Fill', description: 'Polished silver gradient with a cool edge',
    apply: (l) => ({
      text: { ...baseText(l), color: '#e8e8f0', gradient: gradient(['#f8fafc', '#cbd5e1', '#64748b', '#f1f5f9', '#94a3b8'], 100), strokeWidth: 1.5 },
      stroke: '#ffffff', effects: [fx('dropShadow', 55, { y: 8, blur: 22 }), fx('contrast', 12)],
    }),
  },
  {
    id: 'sunset', name: 'Sunset gradient', group: 'Fill', description: 'Warm coral → amber → fuchsia',
    apply: (l) => ({ text: { ...baseText(l), gradient: gradient(['#fda4af', '#fb923c', '#fbbf24'], 90), color: '#ffffff' } }),
  },
  {
    id: 'ocean', name: 'Ocean glass', group: 'Fill', description: 'Cool cyan glass with inner light',
    apply: (l) => ({ text: { ...baseText(l), gradient: gradient(['#67e8f9', '#22d3ee', '#6366f1'], 120), color: '#ffffff' }, effects: [fx('glow', 26, { color: '#22d3ee' })] }),
  },
  {
    id: 'neon', name: 'Neon tube', group: 'Glow', description: 'Violet core with a hot bloom',
    apply: (l, accent) => ({
      text: { ...baseText(l), color: accent ?? '#c4b5fd' },
      effects: [fx('glow', 80, { color: accent ?? '#8b5cf6' }), fx('glow', 40, { color: '#e879f9' })],
    }),
  },
  {
    id: 'holo', name: 'Holographic', group: 'Glow', description: 'Iridescent sweep with chromatic fringe',
    apply: (l) => ({ text: { ...baseText(l), gradient: gradient(['#a78bfa', '#22d3ee', '#e879f9', '#fde68a'], 60), color: '#ffffff' }, effects: [fx('chromatic', 8), fx('glow', 30, { color: '#22d3ee' })] }),
  },
  {
    id: 'outline', name: 'Outline only', group: 'Print', description: 'Hollow type, perfect over photography',
    apply: (l) => ({ text: { ...baseText(l), color: 'transparent', strokeWidth: 2.4 }, stroke: '#ffffff', fill: 'transparent' }),
  },
  {
    id: 'sticker', name: 'Sticker cut', group: 'Print', description: 'Thick white keyline + soft drop',
    apply: (l) => ({ text: { ...baseText(l), strokeWidth: 9, color: '#ffffff' }, stroke: '#ffffff', effects: [fx('dropShadow', 45, { y: 6, blur: 16 })] }),
  },
  {
    id: 'extrude', name: '3D extrude', group: 'Depth', description: 'Stacked offset for chunky depth',
    apply: (l) => ({ text: { ...baseText(l), color: '#ffffff' }, effects: [fx('dropShadow', 90, { x: 0, y: 0, blur: 0 }), fx('dropShadow', 60, { x: 12, y: 14, blur: 0 }), fx('dropShadow', 45, { x: 24, y: 28, blur: 2 })] }),
  },
  {
    id: 'long-shadow', name: 'Long shadow', group: 'Depth', description: 'Graphic diagonal shadow',
    apply: (l) => ({ text: { ...baseText(l), color: '#ffffff' }, effects: [fx('dropShadow', 85, { x: 26, y: 26, blur: 0 }), fx('dropShadow', 55, { x: 52, y: 52, blur: 0 })] }),
  },
  {
    id: 'emboss', name: 'Soft emboss', group: 'Depth', description: 'Pressed-in type with light and shade',
    apply: (l) => ({ text: { ...baseText(l), color: '#d8d8e2' }, effects: [fx('dropShadow', 70, { x: -3, y: -3, blur: 6, color: '#ffffff' }), fx('dropShadow', 60, { x: 5, y: 5, blur: 10, color: '#000000' })] }),
  },
  {
    id: 'print-registration', name: 'Print offset', group: 'Print', description: 'Risograph mis-registration',
    apply: (l) => ({ text: { ...baseText(l), color: '#111114' }, effects: [fx('chromatic', 22), fx('grain', 18)] }),
  },
  {
    id: 'halftone', name: 'Halftone press', group: 'Print', description: 'Ink texture with scanlines',
    apply: (l) => ({ text: { ...baseText(l), color: '#f4f4f5' }, effects: [fx('scanlines', 42), fx('grain', 24)] }),
  },
  {
    id: 'blur-glass', name: 'Frosted glass', group: 'Glow', description: 'Soft focus lettering',
    apply: (l) => ({ text: { ...baseText(l), color: 'rgba(255,255,255,0.82)' }, effects: [fx('blur', 1.6, { blur: 2.4 }), fx('glow', 34, { color: '#a5f3fc' })] }),
  },
  {
    id: 'inferno', name: 'Inferno', group: 'Glow', description: 'Ember gradient with heat bloom',
    apply: (l) => ({ text: { ...baseText(l), gradient: gradient(['#fef08a', '#fb923c', '#dc2626'], 90), color: '#fef3c7' }, effects: [fx('glow', 60, { color: '#f97316' }), fx('bloom', 35)] }),
  },
  {
    id: 'pixel', name: 'Pixel crush', group: 'Motion', description: '8-bit blocky poster type',
    apply: (l) => ({ text: { ...baseText(l), color: '#ffffff', letterSpacing: 4 }, effects: [fx('pixelate', 18), fx('scanlines', 25)] }),
  },
  {
    id: 'glitch-type', name: 'Glitch split', group: 'Motion', description: 'Digital tear with RGB fringe',
    apply: (l) => ({ text: { ...baseText(l), color: '#ffffff' }, effects: [fx('chromatic', 30), fx('scanlines', 35), fx('noise', 12)] }),
  },
  {
    id: 'editorial', name: 'Editorial serif', group: 'Fill', description: 'High-contrast ink with a fine rule',
    apply: (l) => ({ text: { ...baseText(l), fontFamily: 'Playfair Display', fontWeight: 400, letterSpacing: -0.5, color: '#111114' }, fill: '#ffffff' }),
  },
  {
    id: 'marker', name: 'Marker swash', group: 'Print', description: 'Hand-drawn weight with a marker swipe',
    apply: (l) => ({ text: { ...baseText(l), fontFamily: 'Permanent Marker', fontWeight: 400, color: '#111114' }, effects: [fx('dropShadow', 30, { x: 3, y: 4, blur: 2 })] }),
  },
];

export function applyTextEffect(layer: Layer, effectId: string, accent?: string): Partial<Layer> {
  const def = TEXT_EFFECTS.find((e) => e.id === effectId);
  if (!def) return {};
  const patch = def.apply(layer, accent);
  return { ...patch, name: layer.name };
}
