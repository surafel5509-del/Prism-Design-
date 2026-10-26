import type { Aspect, Gradient, Keyframe, Layer, TemplateDef } from '@/lib/engine/types';
import type { Easing, ShapeKind, TextProps } from '@/lib/engine/types';
import { PALETTES, createLayer, createShape, createText, gradient } from '@/lib/engine/factory';
import { uid } from '@/lib/utils';
import { getMotionTemplates } from './motion-templates';
import { getDesignTemplates } from './design-templates';

// ── helpers ──────────────────────────────────────────────────────────────
type Box = [number, number, number, number];
const kf = (time: number, value: number | [number, number], easing?: Easing): Keyframe => ({ id: uid('kf'), time, value, easing: easing ?? { type: 'easeInOut' } });
const ease = (type: Easing['type']): Easing => ({ type });

const T = (content: string, [x, y, w, h]: Box, tp: Partial<TextProps> = {}, lp: Partial<Layer> = {}): Layer =>
  createText(content, { x, y, w, h, endTime: 6, ...lp }, tp);

const S = (kind: ShapeKind, [x, y, w, h]: Box, lp: Partial<Layer> = {}): Layer =>
  createShape(kind, { x, y, w, h, endTime: 6, ...lp });

function blend(hex: string, t: number, target = '#ffffff') {
  const parse = (h: string) => { const s = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)); };
  const a = parse(hex), b = parse(target);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export interface FamilyCtx { w: number; h: number; p: string[]; font: string; dur: number; aspect: Aspect }
export interface FamilyResult { layers: Layer[]; background: string; backgroundGradient?: Gradient | null }

interface Family {
  id: string; name: string; category: TemplateDef['category']; tags: string[]; aspects: Aspect[]; duration: number;
  render: (c: FamilyCtx) => FamilyResult;
}

const ASPECT_DIMS: Record<Aspect, [number, number]> = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };

const FAMILIES: Family[] = [
  // 1 ─ Bold Statement
  {
    id: 'bold-statement', name: 'Bold Statement', category: 'Poster', tags: ['poster', 'type', 'bold', 'gradient'], aspects: ['4:5', '1:1', '9:16', '16:9'], duration: 6,
    render: (c) => {
      const [a, b, d, dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: dark,
        backgroundGradient: gradient([dark, a, d], 145),
        layers: [
          S('ellipse', [c.w * 0.55, -c.h * 0.18, c.h * 0.9, c.h * 0.9], { fill: b, opacity: 0.5, blendMode: 'screen', endTime: c.dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 90 }] }),
          T('MAKE IT\nUNMISSABLE', [c.w * 0.08, c.h * 0.4, c.w * 0.8, c.h * 0.42], { fontFamily: c.font, fontSize: f(118), fontWeight: 800, lineHeight: 0.94, letterSpacing: -3, color: light, uppercase: true, animator: { type: 'slideUp', duration: 0.8, stagger: 0.08, delay: 0.1 } }, { endTime: c.dur }),
          S('rect', [c.w * 0.08, c.h * 0.8, c.w * 0.16, Math.max(4, f(8))], { fill: b, radius: 4, endTime: c.dur }),
          T('PRISM STUDIO — VOL. 04', [c.w * 0.08, c.h * 0.86, c.w * 0.6, f(30)], { fontFamily: 'JetBrains Mono', fontSize: f(17), fontWeight: 500, letterSpacing: 3, color: light, uppercase: true }, { opacity: 0.75, endTime: c.dur }),
          T('2026', [c.w * 0.08, c.h * 0.03, f(160), f(30)], { fontFamily: 'JetBrains Mono', fontSize: f(15), fontWeight: 600, letterSpacing: 2, color: light }, { opacity: 0.6, endTime: c.dur }),
        ],
      };
    },
  },
  // 2 ─ Split Editorial
  {
    id: 'split-editorial', name: 'Split Editorial', category: 'Social', tags: ['editorial', 'serif', 'layout'], aspects: ['1:1', '4:5', '16:9'], duration: 5,
    render: (c) => {
      const [a, b, d, dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      const split = c.w * 0.42;
      return {
        background: light,
        layers: [
          S('rect', [0, 0, split, c.h], { fill: a, endTime: c.dur }),
          S('ellipse', [split * 0.16, c.h * 0.58, split * 0.64, split * 0.64], { fillGradient: gradient([b, a], 150), fill: 'transparent', endTime: c.dur }),
          T('A\nNEW\nSPECIES', [split * 0.1, c.h * 0.07, split * 0.82, c.h * 0.48], { fontFamily: 'Playfair Display', fontSize: f(c.aspect === '16:9' ? 104 : 92), fontWeight: 700, lineHeight: 0.94, letterSpacing: -1, color: '#ffffff', animator: { type: 'charRise', duration: 0.8, stagger: 0.04, delay: 0.2 } }, { endTime: c.dur }),
          T('of visual identity', [split + c.w * 0.05, c.h * 0.15, c.w * 0.48, c.h * 0.24], { fontFamily: 'Playfair Display', fontSize: f(44), fontWeight: 500, fontStyle: 'italic', lineHeight: 1.1, color: dark }, { endTime: c.dur }),
          T('The Prism studio crafts identities that move. Editorial rigour, kinetic energy, and a palette that refuses to whisper.', [split + c.w * 0.05, c.h * 0.54, c.w * 0.46, c.h * 0.26], { fontFamily: c.font, fontSize: f(17), fontWeight: 400, lineHeight: 1.6, color: dark, letterSpacing: 0 }, { opacity: 0.75, endTime: c.dur }),
          S('rect', [split + c.w * 0.05, c.h * 0.86, c.w * 0.07, 3], { fill: d, endTime: c.dur }),
          T('ISSUE Nº 12', [split + c.w * 0.14, c.h * 0.855, c.w * 0.3, f(26)], { fontFamily: 'JetBrains Mono', fontSize: f(13), fontWeight: 500, letterSpacing: 2, color: dark, uppercase: true }, { opacity: 0.7, endTime: c.dur }),
        ],
      };
    },
  },
  // 3 ─ Glass Card
  {
    id: 'glass-card', name: 'Glass Card', category: 'Social', tags: ['glass', 'gradient', 'modern'], aspects: ['1:1', '4:5', '9:16', '16:9'], duration: 6,
    render: (c) => {
      const [a, b, d, dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      const cardW = c.w * 0.78, cardH = c.h * 0.58;
      const cx = (c.w - cardW) / 2, cy = (c.h - cardH) / 2;
      return {
        background: dark,
        backgroundGradient: gradient([a, b, dark], 130),
        layers: [
          S('ellipse', [c.w * 0.6, c.h * 0.03, c.w * 0.5, c.w * 0.5], { fill: d, opacity: 0.5, blendMode: 'screen', endTime: c.dur }),
          S('roundedRect', [cx, cy, cardW, cardH], { fill: '#ffffff', opacity: 0.1, radius: 36, stroke: '#ffffff', strokeWidth: 1.5, endTime: c.dur }),
          T('Design that\nmoves you', [cx + cardW * 0.08, cy + cardH * 0.14, cardW * 0.84, cardH * 0.42], { fontFamily: c.font, fontSize: f(72), fontWeight: 700, lineHeight: 1.02, letterSpacing: -2, color: light, animator: { type: 'blurIn', duration: 0.8, stagger: 0, delay: 0.2 } }, { endTime: c.dur }),
          T('MOTION · DESIGN · BRAND', [cx + cardW * 0.08, cy + cardH * 0.64, cardW * 0.84, f(30)], { fontFamily: 'JetBrains Mono', fontSize: f(15), letterSpacing: 3, color: light, uppercase: true }, { opacity: 0.8, endTime: c.dur }),
          S('roundedRect', [cx + cardW * 0.08, cy + cardH * 0.78, f(190), f(50)], { fill: b, radius: 25, endTime: c.dur, keyframes: { scaleX: [kf(0.4, 0), kf(1, 1, ease('spring'))], scaleY: [kf(0.4, 0), kf(1, 1, ease('spring'))] } }),
          T('Get started', [cx + cardW * 0.08 + f(40), cy + cardH * 0.78 + f(13), f(150), f(24)], { fontFamily: c.font, fontSize: f(17), fontWeight: 600, color: '#0b0b12' }, { endTime: c.dur }),
        ],
      };
    },
  },
  // 4 ─ Kinetic Title
  {
    id: 'kinetic-title', name: 'Kinetic Title', category: 'Motion', tags: ['motion', 'kinetic', 'type', 'intro'], aspects: ['16:9'], duration: 6,
    render: (c) => {
      const [a, b, d, dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: dark,
        backgroundGradient: gradient([dark, '#05050a'], 90),
        layers: [
          S('rect', [0, c.h * 0.5 - 3, 0, 6], { fill: b, endTime: c.dur, keyframes: { w: [kf(0.1, 0), kf(1.1, c.w, ease('easeInOut'))] } }),
          T('THE NEXT WAVE', [c.w * 0.1, c.h * 0.32, c.w * 0.8, c.h * 0.2], { fontFamily: c.font, fontSize: f(104), fontWeight: 800, letterSpacing: -3, color: light, uppercase: true, animator: { type: 'charRise', duration: 0.9, stagger: 0.04, delay: 0.3 } }, { endTime: c.dur }),
          T('of motion design', [c.w * 0.1, c.h * 0.58, c.w * 0.8, c.h * 0.12], { fontFamily: 'JetBrains Mono', fontSize: f(22), letterSpacing: 6, color: b, uppercase: true, animator: { type: 'wordReveal', duration: 0.7, stagger: 0.1, delay: 0.9 } }, { endTime: c.dur }),
          S('ellipse', [c.w * 0.84, c.h * 0.18, f(90), f(90)], { fill: a, endTime: c.dur, keyframes: { scaleX: [kf(0, 0), kf(0.8, 1.1), kf(1.2, 1)], scaleY: [kf(0, 0), kf(0.8, 1.1), kf(1.2, 1)], y: [kf(0, c.h * 0.18), kf(c.dur, c.h * 0.1)] } }),
          createLayer({ type: 'particles', name: 'Dust', x: 0, y: 0, w: c.w, h: c.h, fill: 'transparent', endTime: c.dur, particles: { count: 90, shape: 'circle', color: b, size: 5, speed: 0.35, spread: 30, gravity: -0.15, seed: 7 } }),
        ],
      };
    },
  },
  // 5 ─ Logo Reveal
  {
    id: 'logo-reveal', name: 'Logo Reveal', category: 'Logo', tags: ['logo', 'reveal', 'brand'], aspects: ['1:1', '16:9', '9:16'], duration: 5,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      const cx = c.w / 2, cy = c.h * 0.42, s = f(150);
      return {
        background: dark,
        backgroundGradient: gradient([dark, a], 160),
        layers: [
          S('roundedRect', [cx - s / 2, cy - s / 2, s, s], { fill: b, radius: 32, rotation: 45, endTime: c.dur, keyframes: { rotation: [kf(0, 135), kf(1.2, 45, ease('spring'))], scaleX: [kf(0, 0.2), kf(1.2, 1, ease('easeOut'))], scaleY: [kf(0, 0.2), kf(1.2, 1, ease('easeOut'))] } }),
          S('ellipse', [cx - s / 4, cy - s / 4, s / 2, s / 2], { fill: dark, endTime: c.dur, keyframes: { scaleX: [kf(0.6, 0), kf(1.5, 1, ease('spring'))], scaleY: [kf(0.6, 0), kf(1.5, 1, ease('spring'))] } }),
          T('PRISM', [cx - c.w * 0.4, cy + s * 0.72, c.w * 0.8, f(70)], { fontFamily: c.font, fontSize: f(58), fontWeight: 700, letterSpacing: 16, color: light, align: 'center', animator: { type: 'wordReveal', duration: 0.8, stagger: 0.1, delay: 0.9 } }, { endTime: c.dur }),
          T('MOTION STUDIO', [cx - c.w * 0.3, cy + s * 0.72 + f(66), c.w * 0.6, f(24)], { fontFamily: 'JetBrains Mono', fontSize: f(13), letterSpacing: 8, color: b, align: 'center', uppercase: true, animator: { type: 'blurIn', duration: 0.8, stagger: 0.05, delay: 1.4 } }, { endTime: c.dur }),
          S('ellipse', [c.w / 2 - c.w * 0.4, c.h / 2 - c.w * 0.4 + c.h * 0.12, c.w * 0.8, c.w * 0.8], { fill: 'transparent', stroke: b, strokeWidth: 1, opacity: 0.18, endTime: c.dur, keyframes: { scaleX: [kf(0, 0.6), kf(c.dur, 1.3)], scaleY: [kf(0, 0.6), kf(c.dur, 1.3)] } }),
        ],
      };
    },
  },
  // 6 ─ Lower Third
  {
    id: 'lower-third', name: 'Broadcast Lower Third', category: 'Lower Third', tags: ['broadcast', 'name', 'title', 'overlay'], aspects: ['16:9'], duration: 6,
    render: (c) => {
      const [a, b, , , ] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      const y = c.h * 0.72;
      return {
        background: 'transparent',
        layers: [
          S('rect', [c.w * 0.07, y, f(620), f(84)], { fill: a, endTime: c.dur, keyframes: { x: [kf(0, -700), kf(0.7, c.w * 0.07, ease('easeOut'))], w: [kf(0, 0), kf(0.7, f(620), ease('easeOut'))] } }),
          S('rect', [c.w * 0.07, y + f(84), f(360), f(4)], { fill: b, endTime: c.dur, keyframes: { w: [kf(0, 0), kf(1.1, f(360), ease('easeOut'))] } }),
          T('SURAFEL BEKELE', [c.w * 0.07 + f(22), y + f(14), f(560), f(38)], { fontFamily: c.font, fontSize: f(28), fontWeight: 700, letterSpacing: 1, color: '#ffffff', uppercase: true, animator: { type: 'slideUp', duration: 0.5, stagger: 0, delay: 0.45 } }, { endTime: c.dur }),
          T('Director of Photography', [c.w * 0.07 + f(22), y + f(50), f(560), f(26)], { fontFamily: c.font, fontSize: f(15), fontWeight: 400, letterSpacing: 0.5, color: '#ffffff' }, { opacity: 0.9, endTime: c.dur }),
          T('LIVE · ADDIS ABABA', [c.w * 0.07 + f(640), y + f(1), f(240), f(20)], { fontFamily: 'JetBrains Mono', fontSize: f(11), letterSpacing: 2, color: b, uppercase: true }, { opacity: 0.8, endTime: c.dur }),
        ],
      };
    },
  },
  // 7 ─ Quote Card
  {
    id: 'quote-card', name: 'Quote Card', category: 'Social', tags: ['quote', 'minimal', 'serif'], aspects: ['1:1', '4:5', '9:16'], duration: 5,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: light,
        layers: [
          S('rect', [0, 0, c.w, f(12)], { fill: a, endTime: c.dur }),
          T('“', [c.w * 0.07, c.h * 0.06, f(200), f(210)], { fontFamily: 'Playfair Display', fontSize: f(220), fontWeight: 700, color: b }, { endTime: c.dur }),
          T('Creativity is intelligence having fun.', [c.w * 0.1, c.h * 0.3, c.w * 0.8, c.h * 0.34], { fontFamily: 'Playfair Display', fontSize: f(60), fontWeight: 500, fontStyle: 'italic', lineHeight: 1.16, letterSpacing: -0.5, color: dark, align: 'center', animator: { type: 'wordReveal', duration: 1.1, stagger: 0.08, delay: 0.2 } }, { endTime: c.dur }),
          S('rect', [c.w * 0.45, c.h * 0.72, c.w * 0.1, 3], { fill: a, endTime: c.dur }),
          T('ALBERT EINSTEIN', [c.w * 0.2, c.h * 0.76, c.w * 0.6, f(28)], { fontFamily: 'JetBrains Mono', fontSize: f(14), fontWeight: 500, letterSpacing: 4, color: dark, align: 'center', uppercase: true }, { opacity: 0.7, endTime: c.dur }),
        ],
      };
    },
  },
  // 8 ─ Event Flyer
  {
    id: 'event-flyer', name: 'Event Flyer', category: 'Poster', tags: ['event', 'flyer', 'geometric'], aspects: ['4:5', '9:16', '1:1'], duration: 5,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      const band = c.h * 0.42;
      return {
        background: dark,
        layers: [
          S('rect', [0, band, c.w, c.h - band], { fill: a, endTime: c.dur }),
          S('rect', [0, band - f(10), c.w, f(10)], { fill: b, endTime: c.dur }),
          T('NIGHT\nSIGNAL', [c.w * 0.07, c.h * 0.07, c.w * 0.62, band * 0.62], { fontFamily: c.font, fontSize: f(96), fontWeight: 800, lineHeight: 0.92, letterSpacing: -3, color: light, uppercase: true, animator: { type: 'charRise', duration: 0.8, stagger: 0.03, delay: 0.1 } }, { endTime: c.dur }),
          S('ellipse', [c.w * 0.7, c.h * 0.13, c.w * 0.26, c.w * 0.26], { fill: b, endTime: c.dur }),
          S('ellipse', [c.w * 0.66, c.h * 0.19, c.w * 0.18, c.w * 0.18], { fill: dark, opacity: 0.85, endTime: c.dur }),
          T('24 — 26 OCT 2026', [c.w * 0.07, band + c.h * 0.06, c.w * 0.72, f(32)], { fontFamily: 'JetBrains Mono', fontSize: f(20), fontWeight: 600, letterSpacing: 3, color: light, uppercase: true }, { endTime: c.dur }),
          T('Addis Ababa · Skylight Hotel\nDoors 19:00 · 3 nights of sound', [c.w * 0.07, band + c.h * 0.13, c.w * 0.62, c.h * 0.14], { fontFamily: c.font, fontSize: f(19), fontWeight: 400, lineHeight: 1.55, color: light, letterSpacing: 0 }, { opacity: 0.9, endTime: c.dur }),
          S('roundedRect', [c.w * 0.07, band + c.h * 0.3, f(230), f(56)], { fill: light, radius: 28, endTime: c.dur }),
          T('GET TICKETS', [c.w * 0.07 + f(30), band + c.h * 0.3 + f(18), f(200), f(24)], { fontFamily: c.font, fontSize: f(14), fontWeight: 600, letterSpacing: 2, color: dark, uppercase: true }, { endTime: c.dur }),
          T('prismsound.live', [c.w * 0.62, band + c.h * 0.31, c.w * 0.32, f(24)], { fontFamily: 'JetBrains Mono', fontSize: f(13), letterSpacing: 1, color: light, align: 'right' }, { opacity: 0.8, endTime: c.dur }),
        ],
      };
    },
  },
  // 9 ─ Product Promo
  {
    id: 'product-promo', name: 'Product Promo', category: 'Ad', tags: ['product', 'ad', 'cta'], aspects: ['1:1', '16:9', '4:5'], duration: 6,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      const r = c.h * 0.56;
      return {
        background: light,
        layers: [
          S('rect', [0, 0, c.w * 0.5, c.h], { fill: blend(a, 0.86, light), endTime: c.dur }),
          S('ellipse', [c.w * 0.55, (c.h - r) / 2, r, r], { fill: b, endTime: c.dur, keyframes: { scaleX: [kf(0, 0.85), kf(c.dur, 1)], scaleY: [kf(0, 0.85), kf(c.dur, 1)] } }),
          S('ellipse', [c.w * 0.62, (c.h - r * 0.7) / 2, r * 0.7, r * 0.7], { fill: a, opacity: 0.85, endTime: c.dur }),
          T('NEW\nDROP', [c.w * 0.08, c.h * 0.12, c.w * 0.44, c.h * 0.32], { fontFamily: c.font, fontSize: f(82), fontWeight: 800, lineHeight: 0.92, letterSpacing: -2, color: dark, uppercase: true }, { endTime: c.dur }),
          T('Aurora Headphones', [c.w * 0.08, c.h * 0.47, c.w * 0.42, f(38)], { fontFamily: c.font, fontSize: f(28), fontWeight: 600, color: dark }, { endTime: c.dur }),
          T('Studio-grade sound in a featherweight frame.', [c.w * 0.08, c.h * 0.56, c.w * 0.38, c.h * 0.12], { fontFamily: c.font, fontSize: f(17), lineHeight: 1.55, color: dark, letterSpacing: 0 }, { opacity: 0.7, endTime: c.dur }),
          S('roundedRect', [c.w * 0.08, c.h * 0.73, f(240), f(58)], { fill: dark, radius: 29, endTime: c.dur }),
          T('SHOP NOW — $249', [c.w * 0.08 + f(26), c.h * 0.73 + f(18), f(220), f(24)], { fontFamily: c.font, fontSize: f(14), fontWeight: 600, letterSpacing: 1.5, color: light, uppercase: true }, { endTime: c.dur }),
          T('01', [c.w * 0.88, c.h * 0.05, f(60), f(24)], { fontFamily: 'JetBrains Mono', fontSize: f(13), color: dark }, { opacity: 0.6, endTime: c.dur }),
        ],
      };
    },
  },
  // 10 ─ Data Story
  {
    id: 'data-story', name: 'Data Story', category: 'Social', tags: ['stats', 'data', 'infographic'], aspects: ['1:1', '4:5', '16:9'], duration: 5,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      void a;
      return {
        background: dark,
        backgroundGradient: gradient([dark, blend(dark, 0.08)], 180),
        layers: [
          T('BY THE NUMBERS', [c.w * 0.08, c.h * 0.07, c.w * 0.7, f(26)], { fontFamily: 'JetBrains Mono', fontSize: f(15), letterSpacing: 4, color: b, uppercase: true }, { endTime: c.dur }),
          T('3.4×', [c.w * 0.08, c.h * 0.16, c.w * 0.5, c.h * 0.26], { fontFamily: c.font, fontSize: f(148), fontWeight: 800, color: light, letterSpacing: -4 }, { endTime: c.dur }),
          T('faster delivery from idea to final render.', [c.w * 0.08, c.h * 0.43, c.w * 0.52, c.h * 0.12], { fontFamily: c.font, fontSize: f(19), lineHeight: 1.45, color: light, letterSpacing: 0 }, { opacity: 0.7, endTime: c.dur }),
          S('rect', [c.w * 0.08, c.h * 0.59, c.w * 0.84, 1], { fill: light, opacity: 0.18, endTime: c.dur }),
          ...[{ n: '12k', l: 'TEAMS' }, { n: '98%', l: 'RETENTION' }, { n: '4.9', l: 'RATING' }].flatMap((s, i) => [
            T(s.n, [c.w * 0.08 + i * c.w * 0.29, c.h * 0.63, c.w * 0.24, c.h * 0.08], { fontFamily: c.font, fontSize: f(52), fontWeight: 700, color: i === 1 ? b : light }, { endTime: c.dur, keyframes: { opacity: [kf(0.3 + i * 0.15, 0), kf(0.9 + i * 0.15, 1, ease('easeOut'))] } }),
            T(s.l, [c.w * 0.08 + i * c.w * 0.29, c.h * 0.71, c.w * 0.24, f(22)], { fontFamily: 'JetBrains Mono', fontSize: f(13), letterSpacing: 2, color: light, uppercase: true }, { opacity: 0.55, endTime: c.dur }),
          ]),
          T('Source · Prism internal benchmark, 2026', [c.w * 0.08, c.h * 0.9, c.w * 0.8, f(22)], { fontFamily: 'JetBrains Mono', fontSize: f(11), letterSpacing: 1, color: light }, { opacity: 0.4, endTime: c.dur }),
        ],
      };
    },
  },
  // 11 ─ Thumbnail Punch
  {
    id: 'thumbnail-punch', name: 'Thumbnail Punch', category: 'YouTube', tags: ['thumbnail', 'youtube', 'bold'], aspects: ['16:9'], duration: 4,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: dark,
        backgroundGradient: gradient([dark, a], 120),
        layers: [
          S('rect', [c.w * 0.55, 0, c.w * 0.45, c.h], { fill: b, opacity: 0.16, endTime: c.dur }),
          T('I BUILT\nPRISM\nIN 30 DAYS', [c.w * 0.06, c.h * 0.11, c.w * 0.64, c.h * 0.7], { fontFamily: c.font, fontSize: f(100), fontWeight: 900, lineHeight: 0.88, letterSpacing: -3, color: light, uppercase: true }, { endTime: c.dur }),
          S('roundedRect', [c.w * 0.06, c.h * 0.84, f(300), f(60)], { fill: '#ff2d55', radius: 12, endTime: c.dur }),
          T('WATCH NOW', [c.w * 0.06 + f(34), c.h * 0.84 + f(19), f(260), f(26)], { fontFamily: c.font, fontSize: f(19), fontWeight: 800, letterSpacing: 2, color: '#ffffff', uppercase: true }, { endTime: c.dur }),
          S('ellipse', [c.w * 0.72, c.h * 0.28, c.h * 0.44, c.h * 0.44], { fill: light, opacity: 0.1, endTime: c.dur }),
          S('triangle', [c.w * 0.77, c.h * 0.36, c.h * 0.16, c.h * 0.2], { fill: light, opacity: 0.85, rotation: 90, endTime: c.dur }),
          T('NEW', [c.w * 0.85, c.h * 0.08, f(120), f(26)], { fontFamily: 'JetBrains Mono', fontSize: f(15), fontWeight: 700, letterSpacing: 3, color: light }, { endTime: c.dur }),
        ],
      };
    },
  },
  // 12 ─ Deck Cover
  {
    id: 'deck-cover', name: 'Deck Cover', category: 'Presentation', tags: ['deck', 'business', 'cover'], aspects: ['16:9'], duration: 4,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: dark,
        backgroundGradient: gradient([dark, blend(dark, 0.07)], 200),
        layers: [
          S('rect', [0, 0, f(10), c.h], { fill: a, endTime: c.dur }),
          S('ellipse', [c.w * 0.68, c.h * 0.06, c.h * 0.8, c.h * 0.8], { fill: a, opacity: 0.13, endTime: c.dur }),
          T('Q4 STRATEGY', [c.w * 0.09, c.h * 0.15, c.w * 0.5, f(26)], { fontFamily: 'JetBrains Mono', fontSize: f(15), letterSpacing: 5, color: b, uppercase: true }, { endTime: c.dur }),
          T('Designing the\nnext decade', [c.w * 0.09, c.h * 0.26, c.w * 0.72, c.h * 0.4], { fontFamily: c.font, fontSize: f(80), fontWeight: 700, lineHeight: 1.02, letterSpacing: -2.5, color: light }, { endTime: c.dur }),
          S('rect', [c.w * 0.09, c.h * 0.78, c.w * 0.16, 2], { fill: b, endTime: c.dur }),
          T('Prism Studio · October 2026', [c.w * 0.09, c.h * 0.82, c.w * 0.6, f(24)], { fontFamily: c.font, fontSize: f(15), color: light }, { opacity: 0.6, endTime: c.dur }),
          T('01', [c.w * 0.88, c.h * 0.82, f(80), f(24)], { fontFamily: 'JetBrains Mono', fontSize: f(13), color: light }, { opacity: 0.5, endTime: c.dur }),
        ],
      };
    },
  },
  // 13 ─ Testimonial
  {
    id: 'testimonial', name: 'Testimonial', category: 'Social', tags: ['testimonial', 'profile', 'social'], aspects: ['1:1', '4:5'], duration: 5,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: light,
        layers: [
          S('rect', [0, 0, c.w, c.h * 0.32], { fill: a, endTime: c.dur }),
          S('ellipse', [c.w * 0.1, c.h * 0.17, f(170), f(170)], { fillGradient: gradient([b, a], 140), fill: 'transparent', stroke: light, strokeWidth: 5, endTime: c.dur }),
          T('★★★★★', [c.w * 0.1, c.h * 0.35, c.w * 0.8, f(36)], { fontFamily: 'Inter', fontSize: f(24), color: b }, { endTime: c.dur }),
          T('“Prism cut our\nproduction cycle in half.”', [c.w * 0.1, c.h * 0.43, c.w * 0.8, c.h * 0.27], { fontFamily: c.font, fontSize: f(44), fontWeight: 700, lineHeight: 1.14, letterSpacing: -1, color: dark }, { endTime: c.dur }),
          T('Hanna Tesfaye', [c.w * 0.1, c.h * 0.74, c.w * 0.6, f(30)], { fontFamily: c.font, fontSize: f(21), fontWeight: 600, color: dark }, { endTime: c.dur }),
          T('Creative Director, NEB Studio', [c.w * 0.1, c.h * 0.79, c.w * 0.6, f(26)], { fontFamily: c.font, fontSize: f(15), color: dark }, { opacity: 0.6, endTime: c.dur }),
          S('roundedRect', [c.w * 0.7, c.h * 0.78, f(170), f(44)], { fill: dark, radius: 22, endTime: c.dur }),
          T('NEB®', [c.w * 0.7 + f(46), c.h * 0.78 + f(13), f(120), f(22)], { fontFamily: c.font, fontSize: f(13), fontWeight: 700, letterSpacing: 3, color: light, uppercase: true }, { endTime: c.dur }),
        ],
      };
    },
  },
  // 14 ─ Sale Banner
  {
    id: 'sale-banner', name: 'Sale Banner', category: 'Ad', tags: ['sale', 'promo', 'banner'], aspects: ['16:9', '1:1'], duration: 4,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: a,
        backgroundGradient: gradient([a, b], 110),
        layers: [
          S('roundedRect', [c.w * 0.55, -c.h * 0.25, c.w * 0.7, c.h * 1.5], { fill: dark, opacity: 0.16, radius: 80, rotation: -18, endTime: c.dur }),
          T('MEGA\nSALE', [c.w * 0.06, c.h * 0.14, c.w * 0.46, c.h * 0.5], { fontFamily: c.font, fontSize: f(108), fontWeight: 900, lineHeight: 0.88, letterSpacing: -4, color: light, uppercase: true }, { endTime: c.dur }),
          T('50% OFF', [c.w * 0.06, c.h * 0.67, f(420), f(70)], { fontFamily: c.font, fontSize: f(50), fontWeight: 800, letterSpacing: 2, color: dark, uppercase: true }, { endTime: c.dur }),
          S('ellipse', [c.w * 0.62, c.h * 0.18, c.h * 0.64, c.h * 0.64], { fill: light, opacity: 0.95, endTime: c.dur }),
          T('50%', [c.w * 0.62, c.h * 0.33, c.h * 0.64, c.h * 0.2], { fontFamily: c.font, fontSize: f(88), fontWeight: 900, color: a, align: 'center', letterSpacing: -2 }, { endTime: c.dur }),
          T('OFF EVERYTHING · ENDS SUNDAY', [c.w * 0.06, c.h * 0.88, c.w * 0.6, f(24)], { fontFamily: 'JetBrains Mono', fontSize: f(13), letterSpacing: 3, color: light, uppercase: true }, { endTime: c.dur }),
        ],
      };
    },
  },
  // 15 ─ Podcast Cover
  {
    id: 'podcast-cover', name: 'Podcast Cover', category: 'Poster', tags: ['podcast', 'cover', 'audio'], aspects: ['1:1', '4:5'], duration: 5,
    render: (c) => {
      const [a, b, d, dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: dark,
        backgroundGradient: gradient([d, dark], 160),
        layers: [
          ...[0.92, 0.72, 0.52].map((fr, i) => S('ellipse', [(c.w - c.w * fr) / 2, c.h * 0.5 - c.w * fr / 2, c.w * fr, c.w * fr], { fill: 'transparent', stroke: i === 0 ? b : a, strokeWidth: 2, opacity: 0.5 - i * 0.12, endTime: c.dur })),
          S('roundedRect', [c.w * 0.41, c.h * 0.22, c.w * 0.18, c.h * 0.32], { fill: a, radius: 90, rotation: -12, endTime: c.dur }),
          S('rect', [c.w * 0.46, c.h * 0.48, c.w * 0.08, c.h * 0.1], { fill: a, endTime: c.dur }),
          S('ellipse', [c.w * 0.42, c.h * 0.58, c.w * 0.16, c.w * 0.05], { fill: a, endTime: c.dur }),
          T('THE PRISM\nSIGNAL', [c.w * 0.06, c.h * 0.76, c.w * 0.88, c.h * 0.16], { fontFamily: c.font, fontSize: f(40), fontWeight: 800, lineHeight: 0.95, letterSpacing: 1, color: light, align: 'center', uppercase: true }, { endTime: c.dur }),
          T('EP. 42 · THE FUTURE OF AI DESIGN', [c.w * 0.06, c.h * 0.93, c.w * 0.88, f(20)], { fontFamily: 'JetBrains Mono', fontSize: f(10), letterSpacing: 2, color: b, align: 'center', uppercase: true }, { endTime: c.dur }),
        ],
      };
    },
  },
  // 16 ─ Minimal Type
  {
    id: 'minimal-type', name: 'Minimal Type', category: 'Poster', tags: ['minimal', 'type', 'swiss'], aspects: ['4:5', '1:1', '16:9'], duration: 4,
    render: (c) => {
      const [, , , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: light,
        layers: [
          ...Array.from({ length: 6 }, (_, i) => S('rect', [c.w * 0.08, c.h * 0.1 + i * (c.h * 0.13), c.w * 0.84, 1], { fill: dark, opacity: 0.14, endTime: c.dur })),
          T('FORM', [c.w * 0.08, c.h * 0.13, c.w * 0.84, c.h * 0.22], { fontFamily: c.font, fontSize: f(112), fontWeight: 700, letterSpacing: -4, color: dark }, { endTime: c.dur }),
          T('FOLLOWS', [c.w * 0.08, c.h * 0.35, c.w * 0.84, c.h * 0.22], { fontFamily: c.font, fontSize: f(112), fontWeight: 700, letterSpacing: -4, color: dark }, { opacity: 0.35, endTime: c.dur }),
          T('FUNCTION', [c.w * 0.08, c.h * 0.57, c.w * 0.84, c.h * 0.22], { fontFamily: c.font, fontSize: f(112), fontWeight: 700, letterSpacing: -4, color: c.p[0] }, { endTime: c.dur }),
          T('A study in reduction — Prism Type Series 07', [c.w * 0.08, c.h * 0.87, c.w * 0.84, f(24)], { fontFamily: 'JetBrains Mono', fontSize: f(11), letterSpacing: 2, color: dark, uppercase: true }, { opacity: 0.55, endTime: c.dur }),
        ],
      };
    },
  },
  // 17 ─ Reel Intro
  {
    id: 'reel-intro', name: 'Reel Intro', category: 'TikTok', tags: ['reel', 'tiktok', 'intro', 'vertical'], aspects: ['9:16'], duration: 5,
    render: (c) => {
      const [a, b, d, dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: dark,
        backgroundGradient: gradient([dark, d, a], 170),
        layers: [
          S('roundedRect', [c.w * 0.06, c.h * 0.1, c.w * 0.88, c.h * 0.5], { fill: light, opacity: 0.07, radius: 44, endTime: c.dur }),
          T('WATCH\nTHIS', [c.w * 0.1, c.h * 0.15, c.w * 0.8, c.h * 0.3], { fontFamily: c.font, fontSize: f(128), fontWeight: 900, lineHeight: 0.86, letterSpacing: -4, color: light, uppercase: true, animator: { type: 'scaleIn', duration: 0.6, stagger: 0.05, delay: 0.1 } }, { endTime: c.dur }),
          S('roundedRect', [c.w * 0.1, c.h * 0.52, f(240), f(54)], { fill: b, radius: 27, endTime: c.dur }),
          T('SAVE + SHARE', [c.w * 0.1 + f(24), c.h * 0.52 + f(17), f(210), f(22)], { fontFamily: c.font, fontSize: f(12), fontWeight: 700, letterSpacing: 2, color: '#0b0b12', uppercase: true }, { endTime: c.dur }),
          T('3 TIPS\nNOBODY\nTELLS YOU', [c.w * 0.1, c.h * 0.62, c.w * 0.8, c.h * 0.26], { fontFamily: c.font, fontSize: f(46), fontWeight: 600, lineHeight: 1.05, letterSpacing: -1, color: light }, { endTime: c.dur }),
          S('ellipse', [c.w * 0.7, c.h * 0.04, c.w * 0.35, c.w * 0.35], { fill: a, opacity: 0.7, blendMode: 'screen', endTime: c.dur }),
          T('@prism.studio', [c.w * 0.1, c.h * 0.93, c.w * 0.8, f(24)], { fontFamily: 'JetBrains Mono', fontSize: f(12), letterSpacing: 1, color: light }, { opacity: 0.6, endTime: c.dur }),
        ],
      };
    },
  },
  // 18 ─ Magazine Cover
  {
    id: 'magazine-cover', name: 'Magazine Cover', category: 'Poster', tags: ['magazine', 'cover', 'editorial'], aspects: ['4:5', '9:16'], duration: 5,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: light,
        layers: [
          S('rect', [0, 0, c.w, c.h * 0.6], { fill: a, endTime: c.dur }),
          S('ellipse', [c.w * 0.24, c.h * 0.06, c.w * 0.62, c.w * 0.62], { fill: b, opacity: 0.9, endTime: c.dur }),
          S('ellipse', [c.w * 0.34, c.h * 0.14, c.w * 0.42, c.w * 0.42], { fill: light, opacity: 0.22, endTime: c.dur }),
          T('PRISM', [c.w * 0.05, c.h * 0.02, c.w * 0.9, c.h * 0.11], { fontFamily: 'Playfair Display', fontSize: f(80), fontWeight: 700, letterSpacing: 12, color: light, align: 'center' }, { endTime: c.dur }),
          T('THE MOTION ISSUE', [c.w * 0.05, c.h * 0.545, c.w * 0.9, f(26)], { fontFamily: 'JetBrains Mono', fontSize: f(13), letterSpacing: 6, color: light, align: 'center', uppercase: true }, { endTime: c.dur }),
          T('Inside the studios\nshaping 2026', [c.w * 0.07, c.h * 0.65, c.w * 0.6, c.h * 0.18], { fontFamily: 'Playfair Display', fontSize: f(38), fontWeight: 600, lineHeight: 1.12, color: dark }, { endTime: c.dur }),
          T('Vol. 07', [c.w * 0.7, c.h * 0.66, c.w * 0.24, f(26)], { fontFamily: 'JetBrains Mono', fontSize: f(14), letterSpacing: 2, color: dark, align: 'right' }, { endTime: c.dur }),
          S('rect', [c.w * 0.07, c.h * 0.88, c.w * 0.86, 1], { fill: dark, opacity: 0.25, endTime: c.dur }),
          T('Interview · Portfolio · Case studies', [c.w * 0.07, c.h * 0.91, c.w * 0.86, f(24)], { fontFamily: c.font, fontSize: f(13), color: dark }, { opacity: 0.6, endTime: c.dur }),
        ],
      };
    },
  },
  // 19 ─ Album Art
  {
    id: 'album-art', name: 'Album Art', category: 'Social', tags: ['album', 'music', 'abstract'], aspects: ['1:1'], duration: 5,
    render: (c) => {
      const [a, b, d, dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: dark,
        layers: [
          S('ellipse', [c.w * 0.1, c.h * 0.06, c.w * 0.8, c.w * 0.8], { fill: a, opacity: 0.85, endTime: c.dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 40 }], keyframes: { rotation: [kf(0, 0), kf(5, 90)], scaleX: [kf(0, 1), kf(2.5, 1.15), kf(5, 1)], scaleY: [kf(0, 1), kf(2.5, 1.15), kf(5, 1)] } }),
          S('ellipse', [c.w * 0.26, c.h * 0.22, c.w * 0.5, c.w * 0.5], { fill: b, opacity: 0.8, endTime: c.dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 30 }], keyframes: { rotation: [kf(0, 30), kf(5, -40)], x: [kf(0, c.w * 0.26), kf(2.5, c.w * 0.32), kf(5, c.w * 0.26)], y: [kf(0, c.h * 0.22), kf(2.5, c.h * 0.18), kf(5, c.h * 0.22)] } }),
          S('ellipse', [c.w * 0.4, c.h * 0.36, c.w * 0.32, c.w * 0.32], { fill: d, opacity: 0.75, endTime: c.dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 24 }] }),
          S('rect', [0, 0, c.w, c.h], { fill: 'transparent', endTime: c.dur, effects: [{ id: uid('fx'), type: 'grain', enabled: true, amount: 20 }] }),
          T('THIRD\nLIGHT', [c.w * 0.07, c.h * 0.66, c.w * 0.6, c.h * 0.18], { fontFamily: c.font, fontSize: f(52), fontWeight: 800, lineHeight: 0.94, letterSpacing: -1, color: light, uppercase: true }, { endTime: c.dur }),
          T('KAL — 2026', [c.w * 0.07, c.h * 0.87, c.w * 0.5, f(22)], { fontFamily: 'JetBrains Mono', fontSize: f(12), letterSpacing: 3, color: light, uppercase: true }, { opacity: 0.7, endTime: c.dur }),
          S('ellipse', [c.w * 0.78, c.h * 0.81, c.w * 0.12, c.w * 0.12], { fill: light, opacity: 0.9, endTime: c.dur }),
        ],
      };
    },
  },
  // 20 ─ Grid Gallery
  {
    id: 'grid-gallery', name: 'Grid Gallery', category: 'Social', tags: ['gallery', 'grid', 'portfolio'], aspects: ['1:1', '4:5', '16:9'], duration: 5,
    render: (c) => {
      const [a, b, d, dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      const cols = 3, gap = c.w * 0.02;
      const cellW = (c.w * 0.86 - gap * (cols - 1)) / cols;
      const cellH = cellW * 0.72;
      return {
        background: dark,
        layers: [
          T('SELECTED WORK', [c.w * 0.07, c.h * 0.06, c.w * 0.7, f(26)], { fontFamily: 'JetBrains Mono', fontSize: f(14), letterSpacing: 4, color: b, uppercase: true }, { endTime: c.dur }),
          ...Array.from({ length: 6 }, (_, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            return S('roundedRect', [c.w * 0.07 + col * (cellW + gap), c.h * 0.15 + row * (cellH + gap), cellW, cellH], {
              fill: [a, b, d, blend(a, 0.5, b), blend(b, 0.4, light), blend(a, 0.4, dark)][i],
              radius: 14, opacity: 0,
              endTime: c.dur,
              keyframes: { opacity: [kf(0.15 + i * 0.1, 0), kf(0.65 + i * 0.1, 1, ease('easeOut'))], scaleX: [kf(0.15 + i * 0.1, 0.9), kf(0.75 + i * 0.1, 1, ease('easeOut'))], scaleY: [kf(0.15 + i * 0.1, 0.9), kf(0.75 + i * 0.1, 1, ease('easeOut'))] },
            });
          }),
          T('01 — 06', [c.w * 0.7, c.h * 0.89, c.w * 0.23, f(24)], { fontFamily: 'JetBrains Mono', fontSize: f(12), letterSpacing: 2, color: light, align: 'right' }, { opacity: 0.6, endTime: c.dur }),
        ],
      };
    },
  },
  // 21 ─ CTA Story
  {
    id: 'cta-story', name: 'CTA Story', category: 'Story', tags: ['story', 'cta', 'instagram'], aspects: ['9:16'], duration: 6,
    render: (c) => {
      const [a, b, , dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: dark,
        backgroundGradient: gradient([a, dark, dark], 155),
        layers: [
          S('ellipse', [-c.w * 0.2, -c.h * 0.08, c.w * 0.9, c.w * 0.9], { fill: b, opacity: 0.25, endTime: c.dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 60 }] }),
          T('LIMITED\nSPOTS', [c.w * 0.1, c.h * 0.17, c.w * 0.8, c.h * 0.24], { fontFamily: c.font, fontSize: f(86), fontWeight: 800, lineHeight: 0.9, letterSpacing: -3, color: light, uppercase: true, animator: { type: 'slideUp', duration: 0.7, stagger: 0, delay: 0.1 } }, { endTime: c.dur }),
          T('Join the Prism Motion Lab — a 4-week live intensive on kinetic design, taught by studio leads.', [c.w * 0.1, c.h * 0.44, c.w * 0.8, c.h * 0.16], { fontFamily: c.font, fontSize: f(24), lineHeight: 1.5, color: light, letterSpacing: 0 }, { opacity: 0.85, endTime: c.dur }),
          S('roundedRect', [c.w * 0.1, c.h * 0.67, c.w * 0.8, f(92)], { fill: light, radius: 46, endTime: c.dur, keyframes: { scaleX: [kf(0.5, 0.9), kf(0.9, 1, ease('spring'))], scaleY: [kf(0.5, 0.9), kf(0.9, 1, ease('spring'))], opacity: [kf(0.5, 0), kf(0.8, 1)] } }),
          T('APPLY NOW →', [c.w * 0.1, c.h * 0.67 + f(32), c.w * 0.8, f(28)], { fontFamily: c.font, fontSize: f(21), fontWeight: 700, letterSpacing: 3, color: dark, align: 'center', uppercase: true }, { endTime: c.dur }),
          T('prism.studio/lab', [c.w * 0.1, c.h * 0.84, c.w * 0.8, f(26)], { fontFamily: 'JetBrains Mono', fontSize: f(14), letterSpacing: 1, color: light, align: 'center' }, { opacity: 0.7, endTime: c.dur }),
          T('SWIPE UP', [c.w * 0.1, c.h * 0.92, c.w * 0.8, f(22)], { fontFamily: 'JetBrains Mono', fontSize: f(11), letterSpacing: 4, color: light, align: 'center', uppercase: true }, { opacity: 0.45, endTime: c.dur }),
        ],
      };
    },
  },
  // 22 ─ Case Study
  {
    id: 'case-study', name: 'Case Study', category: 'Presentation', tags: ['case', 'portfolio', 'clean'], aspects: ['16:9', '4:5'], duration: 4,
    render: (c) => {
      const [, b, d, dark, light] = c.p;
      const f = (n: number) => Math.round(n * Math.min(c.w / 1080, c.h / 1080));
      return {
        background: light,
        layers: [
          S('rect', [0, c.h * 0.86, c.w, c.h * 0.14], { fill: dark, endTime: c.dur }),
          T('CASE STUDY', [c.w * 0.07, c.h * 0.07, c.w * 0.5, f(24)], { fontFamily: 'JetBrains Mono', fontSize: f(13), letterSpacing: 4, color: d, uppercase: true }, { endTime: c.dur }),
          T('Rebranding a\nlegacy institution', [c.w * 0.07, c.h * 0.17, c.w * 0.55, c.h * 0.26], { fontFamily: c.font, fontSize: f(52), fontWeight: 700, lineHeight: 1.06, letterSpacing: -1.5, color: dark }, { endTime: c.dur }),
          S('roundedRect', [c.w * 0.66, c.h * 0.11, c.w * 0.27, c.h * 0.52], { fillGradient: gradient([b, d], 140), fill: 'transparent', radius: 18, endTime: c.dur }),
          S('ellipse', [c.w * 0.72, c.h * 0.19, c.w * 0.15, c.w * 0.15], { fill: light, opacity: 0.4, endTime: c.dur }),
          T('Client · Addis Heritage\nScope · Identity, motion, web\nYear · 2026', [c.w * 0.07, c.h * 0.51, c.w * 0.5, c.h * 0.22], { fontFamily: 'JetBrains Mono', fontSize: f(13), lineHeight: 1.9, color: dark, letterSpacing: 0 }, { opacity: 0.7, endTime: c.dur }),
          T('PRISM', [c.w * 0.07, c.h * 0.88, c.w * 0.3, f(24)], { fontFamily: c.font, fontSize: f(15), fontWeight: 700, letterSpacing: 4, color: light }, { endTime: c.dur }),
          T('01 / 08', [c.w * 0.8, c.h * 0.88, c.w * 0.13, f(24)], { fontFamily: 'JetBrains Mono', fontSize: f(12), color: light, align: 'right' }, { opacity: 0.6, endTime: c.dur }),
        ],
      };
    },
  },
];

const FONT_BY_PALETTE: Record<string, string> = {
  Prism: 'Sora', 'Midnight Bloom': 'Outfit', 'Cyber Lime': 'Unbounded', 'Sunset Studio': 'Syne',
  Editorial: 'Playfair Display', 'Ocean Depth': 'Sora', 'Neo Candy': 'Syne', 'Mono Graphite': 'Space Grotesk',
  'Golden Hour': 'Fraunces', 'Forest Signal': 'DM Sans', 'Rose Quartz': 'Outfit', 'Electric Violet': 'Space Grotesk',
};

let cache: TemplateDef[] | null = null;

export function getTemplates(): TemplateDef[] {
  if (cache) return cache;
  const out: TemplateDef[] = [];
  for (const fam of FAMILIES) {
    for (let pi = 0; pi < PALETTES.length; pi++) {
      const pal = PALETTES[pi];
      const font = FONT_BY_PALETTE[pal.name] ?? 'Sora';
      for (const aspect of fam.aspects) {
        const [w, h] = ASPECT_DIMS[aspect];
        const dur = fam.duration;
        out.push({
          id: `${fam.id}--${pal.name.toLowerCase().replace(/\s+/g, '-')}--${aspect.replace(':', 'x')}`,
          name: fam.name,
          category: fam.category,
          tags: [...fam.tags, pal.name.toLowerCase(), aspect],
          aspect, duration: dur, palette: pal.colors, font, pro: pi > 7,
          render: () => {
            const res = fam.render({ w, h, p: pal.colors, font, dur, aspect });
            return { layers: res.layers.map((l) => ({ ...l, endTime: Math.min(l.endTime || dur, dur) })), width: w, height: h, background: res.background, backgroundGradient: res.backgroundGradient ?? null };
          },
        });
      }
    }
  }
  out.push(...getDesignTemplates());
  out.push(...getMotionTemplates());
  cache = out;
  return out;
}

export function getTemplate(id: string) { return getTemplates().find((t) => t.id === id); }
export const TEMPLATE_CATEGORIES = Array.from(new Set(FAMILIES.map((f) => f.category)));
export const TEMPLATE_FAMILY_COUNT = FAMILIES.length;
