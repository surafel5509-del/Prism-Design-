import type { Layer } from '@/lib/engine/types';
import { gradient } from '@/lib/engine/factory';
import { uid } from '@/lib/utils';
import {
  MONO, SH, TX, alpha, drift, enter, kf, mergeKeys, mix, scene, typeScale,
  EASE, LINEAR, type MotionFamily,
} from './shared';

// 7 more long-form families: luxury, isometric, festival, sports, documentary, gradient product, brutalist.

export const SET_B: MotionFamily[] = [
  // 8 ── Luxury editorial ────────────────────────────────────────────────────
  {
    id: 'mg-luxury-editorial', name: 'Maison Editorial', style: 'Luxury fashion house', category: 'Story',
    tags: ['luxury', 'fashion', 'editorial', 'serif', 'elegant'], aspects: ['9:16', '4:5', '16:9'], duration: 28,
    colorways: [['#0c0c0d', '#e9e2d0', '#c9a35f', '#6b6257'], ['#f5f1e8', '#151412', '#a67c52', '#8c8579'], ['#101418', '#eef2f4', '#b7c3cb', '#5d6a73']],
    fonts: ['Playfair Display', 'Cormorant Garamond', 'Fraunces'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, ivory, gold, muted] = c;
      const dark = bg;
      const L: Layer[] = [];
      L.push(SH('rect', [0, 0, w, h], { fill: dark, endTime: dur }));
      L.push(scene(SH('rect', [w * 0.06, h * 0.05, w * 0.88, h * 0.9], { fill: 'transparent', stroke: alpha(ivory, 0.22), strokeWidth: 1, endTime: dur }), 0.3, dur, 'scale', 'fade', 0.9));
      L.push(scene(TX('MAISON', [w * 0.08, h * 0.065, w * 0.5, 20 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 5 * f, color: alpha(ivory, 0.55) }, { endTime: dur }), 0.4, dur, 'fade', 'none', 0.5));
      L.push(scene(TX('N° 04', [w * 0.68, h * 0.065, w * 0.22, 20 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 3 * f, color: alpha(gold, 0.9), align: 'right' }, { endTime: dur }), 0.5, dur, 'fade', 'none', 0.5));
      const px = w * 0.14, py = h * 0.15, pw = w * 0.72, ph = h * 0.46;
      L.push(scene(SH('rect', [px, py, pw, ph], { fillGradient: gradient([mix(gold, dark, 0.55), mix(muted, dark, 0.35), dark], 160), fill: 'transparent', endTime: dur }), 0.5, dur, 'scale', 'fade', 1));
      L.push(drift(SH('ellipse', [px + pw * 0.22, py + ph * 0.18, pw * 0.56, pw * 0.56], { fill: alpha(ivory, 0.09), blendMode: 'screen', endTime: dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 60 }] }), 1, dur, 20 * f, -12 * f));
      L.push(scene(TX('THE ART OF\nSTILLNESS', [px + pw * 0.08, py + ph * 0.3, pw * 0.8, ph * 0.4], { fontFamily: font, fontSize: h * 0.07, fontWeight: 400, lineHeight: 1.05, letterSpacing: 1 * f, color: ivory, align: 'center' }, { endTime: dur }), 1, dur, 'fade', 'none', 1.1));
      L.push(scene(SH('rect', [px + pw * 0.42, py + ph * 0.72, pw * 0.16, 1 * f], { fill: alpha(gold, 0.8), endTime: dur }), 1.6, dur, 'scale', 'none', 0.5));
      L.push(scene(TX('Autumn / Winter 2026', [w * 0.08, h * 0.64, w * 0.6, 24 * f], { fontFamily: font, fontSize: 17 * f, color: ivory, letterSpacing: 0.4 * f }, { endTime: dur }), 1.6, dur, 'up', 'none', 0.7));
      L.push(scene(TX('A study in restraint. Forty-two looks, one palette, no noise — shot over three days in the highlands and cut to a single, unhurried rhythm.', [w * 0.08, h * 0.685, w * 0.62, h * 0.09], { fontFamily: font, fontSize: 11.5 * f, lineHeight: 1.7, color: alpha(ivory, 0.62) }, { endTime: dur }), 1.9, dur, 'up', 'none', 0.8));
      L.push(scene(TX('DISCOVER THE COLLECTION', [w * 0.08, h * 0.83, w * 0.6, 22 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 4 * f, color: gold }, { endTime: dur }), 2.2, dur, 'fade', 'none', 0.6));
      L.push(scene(SH('rect', [w * 0.08, h * 0.86, w * 0.28, 1 * f], { fill: alpha(gold, 0.6), endTime: dur }), 2.3, dur, 'scale', 'none', 0.6));
      L.push(scene(TX('PARIS · MILAN · ADDIS', [w * 0.36, h * 0.92, w * 0.56, 18 * f], { fontFamily: MONO, fontSize: 8 * f, letterSpacing: 2 * f, color: alpha(ivory, 0.4), align: 'right' }, { endTime: dur }), 2.4, dur, 'fade', 'none', 0.5));
      const sweep = SH('rect', [-w * 0.2, 0, w * 0.25, h], { fillGradient: gradient([alpha(ivory, 0), alpha(ivory, 0.1), alpha(ivory, 0)], 90), fill: 'transparent', blendMode: 'screen', endTime: dur });
      L.push({ ...sweep, keyframes: { x: [kf(2, -w * 0.3, LINEAR), kf(dur, w * 1.1, LINEAR)] } });
      return { background: bg, layers: L };
    },
  },

  // 9 ── Isometric tech ─────────────────────────────────────────────────────
  {
    id: 'mg-isometric-tech', name: 'Isometric Stack', style: 'Isometric product architecture', category: 'Motion',
    tags: ['isometric', '3d', 'tech', 'architecture', 'diagram'], aspects: ['16:9', '1:1'], duration: 24,
    colorways: [['#0b1220', '#6366f1', '#22d3ee', '#a3e635'], ['#101014', '#f97316', '#38bdf8', '#fde047'], ['#0d1412', '#10b981', '#a3e635', '#f0abfc']],
    fonts: ['Space Grotesk', 'Sora', 'Outfit'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, ind, cy, lime] = c;
      const L: Layer[] = [];
      for (let i = 0; i < 7; i++) {
        L.push(SH('rect', [w * 0.05 + i * w * 0.14, h * 0.1, 1 * f, h * 0.8], { fill: alpha(ind, 0.08), endTime: dur }));
        L.push(SH('rect', [w * 0.05, h * 0.1 + i * h * 0.13, w * 0.92, 1 * f], { fill: alpha(ind, 0.08), endTime: dur }));
      }
      L.push(scene(TX('ARCHITECTURE', [w * 0.06, h * 0.07, w * 0.4, 22 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 4 * f, color: alpha(cy, 0.85) }, { endTime: dur }), 0.2, dur, 'fade', 'none', 0.5));
      L.push(scene(TX('A stack that scales', [w * 0.06, h * 0.1, w * 0.5, h * 0.09], { fontFamily: font, fontSize: h * 0.066, fontWeight: 600, letterSpacing: -1.6 * f, color: '#fff' }, { endTime: dur }), 0.4, dur - 1.2, 'up', 'none', 0.7));
      L.push(scene(TX('Every layer observable. Every call reversible.', [w * 0.06, h * 0.2, w * 0.4, 40 * f], { fontFamily: font, fontSize: 13 * f, color: alpha('#ffffff', 0.55) }, { endTime: dur }), 0.8, dur - 1.2, 'left', 'none', 0.7));
      const cx = w * 0.62, cyy = h * 0.42;
      const slabs = [
        { label: 'INTERFACE', colour: cy, dy: 0, wd: w * 0.3 },
        { label: 'AGENT', colour: ind, dy: h * 0.12, wd: w * 0.26 },
        { label: 'ENGINE', colour: lime, dy: h * 0.24, wd: w * 0.22 },
      ];
      slabs.forEach((s, i) => {
        const baseY = cyy + s.dy;
        L.push(scene(SH('parallelogram', [cx - s.wd / 2, baseY, s.wd, h * 0.07], { fill: alpha(s.colour, 0.32), stroke: alpha(s.colour, 0.8), strokeWidth: 1.4, endTime: dur }), 1 + i * 0.28, dur - 1, 'up', 'fade', 0.7));
        L.push(scene(SH('trapezoid', [cx - s.wd / 2, baseY + h * 0.07, s.wd, h * 0.05], { fill: alpha(s.colour, 0.16), stroke: alpha(s.colour, 0.5), strokeWidth: 1.2, endTime: dur }), 1.1 + i * 0.28, dur - 1, 'up', 'fade', 0.7));
        L.push(scene(TX(s.label, [cx - s.wd / 2 + 16 * f, baseY + h * 0.022, s.wd * 0.8, 22 * f], { fontFamily: MONO, fontSize: 9.5 * f, letterSpacing: 3 * f, color: '#fff' }, { endTime: dur }), 1.3 + i * 0.28, dur - 1, 'fade', 'fade', 0.6));
        if (i < slabs.length - 1) {
          L.push(scene(SH('rect', [cx - 1 * f, baseY + h * 0.12, 2 * f, h * 0.02], { fill: alpha(s.colour, 0.5), endTime: dur }), 1.4 + i * 0.28, dur - 1, 'fade', 'fade', 0.5));
        }
      });
      [[ 'schema', w * 0.32, h * 0.3 ], ['events', w * 0.78, h * 0.26], ['renders', w * 0.74, h * 0.63]].forEach(([label, x, y], i) => {
        const tx = Number(x), ty = Number(y), text = String(label);
        const tw = (text.length * 7.4 + 26) * f;
        L.push(scene(SH('roundedRect', [tx, ty, tw, 24 * f], { fill: alpha('#ffffff', 0.07), stroke: alpha('#ffffff', 0.16), strokeWidth: 1, radius: 12 * f, endTime: dur }), 2 + i * 0.25, dur - 1, 'scale', 'fade', 0.5));
        L.push(scene(TX(text, [tx + 12 * f, ty + 5 * f, tw - 20 * f, 16 * f], { fontFamily: MONO, fontSize: 9 * f, color: alpha('#ffffff', 0.8) }, { endTime: dur }), 2.05 + i * 0.25, dur - 1, 'fade', 'fade', 0.5));
      });
      L.push(scene(TX('PRISM ENGINE / V4', [w * 0.06, h * 0.92, w * 0.4, 18 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 2 * f, color: alpha('#ffffff', 0.35) }, { endTime: dur }), 0.4, dur, 'fade', 'fade', 0.5));
      return { background: bg, backgroundGradient: gradient([mix(bg, ind, 0.12), bg, mix(bg, '#000000', 0.4)], 150), layers: L };
    },
  },

  // 10 ── Festival / event ──────────────────────────────────────────────────
  {
    id: 'mg-festival', name: 'Festival Lineup', style: 'Music festival promo', category: 'TikTok',
    tags: ['festival', 'music', 'event', 'lineup', 'bold'], aspects: ['9:16', '16:9', '1:1'], duration: 20,
    colorways: [['#12040f', '#f43f5e', '#a3e635', '#fbbf24'], ['#040d1a', '#22d3ee', '#e879f9', '#fde047'], ['#0f0a04', '#fb923c', '#84cc16', '#f472b6']],
    fonts: ['Anton', 'Bebas Neue', 'Archivo Black'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, hot, lime, gold] = c;
      const L: Layer[] = [];
      L.push(SH('rect', [0, 0, w, h], { fill: bg, endTime: dur }));
      for (let i = 0; i < 4; i++) {
        L.push(scene(SH('burst', [w * (0.1 + i * 0.24) - h * 0.01, h * (0.18 + (i % 2) * 0.12), h * 0.12, h * 0.12], { fill: alpha(i % 2 ? lime : gold, 0.75), points: 18, innerRadius: 0.6, endTime: dur }), 0.2 + i * 0.12, dur, 'scale', 'none', 0.6));
      }
      L.push(scene(TX('LIVE / ONE NIGHT', [w * 0.08, h * 0.07, w * 0.84, 26 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 4 * f, color: alpha('#ffffff', 0.7) }, { endTime: dur }), 0.2, dur, 'fade', 'none', 0.5));
      L.push(scene(TX('NOISE\nFLOOR', [w * 0.06, h * 0.14, w * 0.9, h * 0.2], { fontFamily: font, fontSize: h * 0.15, fontWeight: 700, lineHeight: 0.88, letterSpacing: -h * 0.006, color: '#fff', uppercase: true, animator: { type: 'charRise', duration: 0.9, stagger: 0.05, delay: 0 } }, { endTime: dur }), 0.3, dur - 1, 'scale', 'none', 0.35));
      L.push(scene(SH('rect', [w * 0.06, h * 0.42, w * 0.4, 8 * f], { fill: hot, endTime: dur }), 0.9, dur - 1, 'left', 'none', 0.5));
      [['AURORA DRIFT', '22:00 · MAIN'], ['NEON PULSE', '23:15 · DOME'], ['LAUNCH SEQ', '00:30 · MAIN'], ['QUIET ENGINE', '01:45 · GARDEN'], ['NIGHT DRIVE', '03:00 · DOME']].forEach(([name, meta], i) => {
        const y = h * 0.48 + i * h * 0.075;
        L.push(scene(TX(name, [w * 0.06, y, w * 0.62, 34 * f], { fontFamily: font, fontSize: 22 * f, fontWeight: 600, letterSpacing: 0.4 * f, color: i % 2 ? lime : '#fff', uppercase: true }, { endTime: dur }), 1.1 + i * 0.14, dur - 0.8, 'left', 'fade', 0.5));
        L.push(scene(TX(meta, [w * 0.62, y + 6 * f, w * 0.3, 20 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 1.5 * f, color: alpha('#ffffff', 0.55), align: 'right' }, { endTime: dur }), 1.15 + i * 0.14, dur - 0.8, 'fade', 'fade', 0.5));
        L.push(scene(SH('rect', [w * 0.06, y + 34 * f, w * 0.86, 1 * f], { fill: alpha('#ffffff', 0.12), endTime: dur }), 1.2 + i * 0.14, dur - 0.8, 'none', 'fade', 0.4));
      });
      L.push(scene(SH('rect', [0, h * 0.9, w, h * 0.1], { fill: hot, endTime: dur }), 2, dur, 'up', 'none', 0.6));
      L.push(scene(TX('SAT 14 NOV · DOCKSIDE · 18+', [w * 0.06, h * 0.925, w * 0.6, 24 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 2 * f, color: '#12040f', fontWeight: 600 }, { endTime: dur }), 2.1, dur, 'fade', 'none', 0.5));
      L.push(scene(TX('TICKETS', [w * 0.7, h * 0.925, w * 0.24, 24 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 2 * f, color: '#12040f', align: 'right', fontWeight: 700 }, { endTime: dur }), 2.2, dur, 'fade', 'none', 0.5));
      return { background: bg, backgroundGradient: gradient([mix(bg, hot, 0.3), bg, mix(bg, lime, 0.15)], 160), layers: L };
    },
  },

  // 11 ── Sports stats ──────────────────────────────────────────────────────
  {
    id: 'mg-sports-stats', name: 'Match Day', style: 'Sports broadcast package', category: 'Lower Third',
    tags: ['sports', 'broadcast', 'stats', 'score', 'lower third'], aspects: ['16:9'], duration: 22,
    colorways: [['#0a1b12', '#a3e635', '#f8fafc', '#22d3ee'], ['#1a0a0a', '#f87171', '#f8fafc', '#fbbf24'], ['#0a0f1b', '#38bdf8', '#f8fafc', '#f43f5e']],
    fonts: ['Teko', 'Oswald', 'Archivo'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, accent, ink, second] = c;
      const L: Layer[] = [];
      L.push(SH('rect', [0, 0, w, h], { fill: bg, endTime: dur }));
      L.push(SH('rect', [0, 0, w, 5 * f], { fill: accent, endTime: dur }));
      for (let i = 0; i < 9; i++) {
        L.push(scene(SH('rect', [w * 0.4 + i * 40 * f, 0, 2 * f, h], { fill: alpha(i % 3 === 0 ? accent : ink, 0.12), rotation: 18, endTime: dur }), i * 0.06, dur, 'none', 'fade', 0.4));
      }
      L.push(scene(TX('MATCH DAY', [w * 0.05, h * 0.08, w * 0.4, 32 * f], { fontFamily: font, fontSize: 22 * f, fontWeight: 600, letterSpacing: 6 * f, color: ink, uppercase: true }, { endTime: dur }), 0.2, dur, 'left', 'none', 0.5));
      L.push(scene(TX('PRISM LEAGUE · ROUND 14', [w * 0.05, h * 0.14, w * 0.45, 22 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 2.5 * f, color: alpha(ink, 0.55) }, { endTime: dur }), 0.35, dur, 'fade', 'none', 0.5));
      const sx = w * 0.05, sy = h * 0.3, sw = w * 0.9, sh = h * 0.34;
      L.push(scene(SH('roundedRect', [sx, sy, sw, sh], { fill: alpha('#000000', 0.35), stroke: alpha(ink, 0.14), strokeWidth: 1.2, radius: 14 * f, endTime: dur }), 0.6, dur - 1, 'scale', 'fade', 0.7));
      L.push(scene(SH('rect', [sx, sy, sw * 0.02, sh], { fill: accent, endTime: dur }), 0.7, dur - 1, 'none', 'fade', 0.5));
      [['NORTH', 'HOME'], ['RIVERSIDE', 'AWAY']].forEach(([name, tag], i) => {
        const x = sx + (i === 0 ? w * 0.05 : w * 0.56);
        L.push(scene(TX(name, [x, sy + sh * 0.2, w * 0.3, 44 * f], { fontFamily: font, fontSize: 30 * f, fontWeight: 500, letterSpacing: 2 * f, color: ink, align: i === 0 ? 'left' : 'right', uppercase: true }, { endTime: dur }), 0.9 + i * 0.2, dur - 1, 'up', 'fade', 0.6));
        L.push(scene(TX(tag, [x, sy + sh * 0.12, w * 0.3, 20 * f], { fontFamily: MONO, fontSize: 8.5 * f, letterSpacing: 3 * f, color: alpha(ink, 0.5), align: i === 0 ? 'left' : 'right' }, { endTime: dur }), 1 + i * 0.2, dur - 1, 'fade', 'fade', 0.5));
      });
      L.push(scene(TX('3', [sx + sw * 0.3, sy + sh * 0.42, w * 0.14, 90 * f], { fontFamily: font, fontSize: 84 * f, fontWeight: 600, color: accent, align: 'center' }, { endTime: dur }), 1.1, dur - 1, 'up', 'fade', 0.55));
      L.push(scene(TX('—', [sx + sw * 0.43, sy + sh * 0.5, w * 0.14, 50 * f], { fontFamily: font, fontSize: 30 * f, color: alpha(ink, 0.4), align: 'center' }, { endTime: dur }), 1.2, dur - 1, 'fade', 'fade', 0.5));
      L.push(scene(TX('1', [sx + sw * 0.56, sy + sh * 0.42, w * 0.14, 90 * f], { fontFamily: font, fontSize: 84 * f, fontWeight: 600, color: ink, align: 'center' }, { endTime: dur }), 1.3, dur - 1, 'up', 'fade', 0.55));
      L.push(scene(TX('68:22', [sx + sw * 0.44, sy + sh * 0.16, w * 0.12, 24 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 2 * f, color: alpha(ink, 0.6), align: 'center' }, { endTime: dur }), 1.4, dur - 1, 'fade', 'fade', 0.5));
      [['POSSESSION', 62, accent], ['SHOTS', 84, second], ['XG', 46, accent]].forEach(([label, val, colour], i) => {
        const y = h * 0.7 + i * h * 0.07;
        L.push(scene(TX(String(label), [w * 0.05, y, w * 0.16, 20 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 1.6 * f, color: alpha(ink, 0.6) }, { endTime: dur }), 1.6 + i * 0.18, dur - 0.8, 'fade', 'fade', 0.5));
        L.push(scene(SH('rect', [w * 0.22, y + 4 * f, w * 0.5, 7 * f], { fill: alpha(ink, 0.1), radius: 4, endTime: dur }), 1.6 + i * 0.18, dur - 0.8, 'fade', 'fade', 0.5));
        const fillBar = SH('rect', [w * 0.22, y + 4 * f, w * 0.5 * (Number(val) / 100), 7 * f], { fill: String(colour), radius: 4, endTime: dur });
        L.push({ ...enter(fillBar, 1.7 + i * 0.18, 'fade'), endTime: dur - 0.8, keyframes: { ...fillBar.keyframes, opacity: [kf(1.7 + i * 0.18, 0), kf(2.1 + i * 0.18, 0.92)], w: [kf(1.7 + i * 0.18, 0), kf(2.7 + i * 0.18, w * 0.5 * (Number(val) / 100), EASE)] } });
        L.push(scene(TX(`${val}%`, [w * 0.74, y, w * 0.08, 20 * f], { fontFamily: MONO, fontSize: 9.5 * f, color: ink, align: 'right' }, { endTime: dur }), 1.8 + i * 0.18, dur - 0.8, 'fade', 'fade', 0.5));
      });
      L.push(scene(SH('rect', [0, h * 0.93, w, h * 0.07], { fill: alpha(accent, 0.92), endTime: dur }), 2.2, dur, 'left', 'none', 0.6));
      L.push(scene(TX('FULL TIME · NORTH 3 — 1 RIVERSIDE', [w * 0.05, h * 0.945, w * 0.8, 22 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 2.5 * f, color: '#04120a', fontWeight: 600 }, { endTime: dur }), 2.3, dur, 'fade', 'none', 0.5));
      return { background: bg, backgroundGradient: gradient([mix(bg, accent, 0.12), bg, mix(bg, '#000000', 0.5)], 165), layers: L };
    },
  },

  // 12 ── Documentary title ────────────────────────────────────────────────
  {
    id: 'mg-documentary', name: 'After the Frame', style: 'Documentary title sequence', category: 'Story',
    tags: ['documentary', 'film', 'titles', 'cinematic', 'grain'], aspects: ['16:9', '9:16'], duration: 26,
    colorways: [['#0a0908', '#e7e0d3', '#c07a3e', '#7a7168'], ['#0b0e10', '#e8ecef', '#5b8ca8', '#79848c'], ['#0d0a0b', '#efe4d8', '#9c5a52', '#7e7166']],
    fonts: ['Cormorant Garamond', 'Fraunces', 'Playfair Display'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, ivory, warm] = c;
      const L: Layer[] = [];
      L.push(SH('rect', [0, 0, w, h], { fill: bg, endTime: dur }));
      L.push(SH('rect', [0, 0, w, h * 0.12], { fill: '#000', endTime: dur }));
      L.push(SH('rect', [0, h * 0.88, w, h * 0.12], { fill: '#000', endTime: dur }));
      L.push(scene(TX('A PRISM ORIGINAL DOCUMENTARY', [w * 0.08, h * 0.2, w * 0.5, 22 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 4 * f, color: alpha(ivory, 0.55) }, { endTime: dur }), 0.6, dur - 1.2, 'fade', 'fade', 0.7));
      L.push(scene(TX('AFTER', [w * 0.08, h * 0.28, w * 0.8, h * 0.2], { fontFamily: font, fontSize: h * 0.2, fontWeight: 400, letterSpacing: h * 0.002, color: ivory }, { endTime: dur }), 1, dur - 1.2, 'left', 'none', 1.1));
      L.push(scene(TX('THE FRAME', [w * 0.08, h * 0.46, w * 0.8, h * 0.2], { fontFamily: font, fontSize: h * 0.2, fontWeight: 400, letterSpacing: h * 0.002, color: alpha(ivory, 0.9) }, { endTime: dur }), 1.4, dur - 1.2, 'left', 'none', 1.1));
      L.push(scene(SH('rect', [w * 0.08, h * 0.66, w * 0.22, 1 * f], { fill: alpha(warm, 0.8), endTime: dur }), 2, dur - 1.2, 'none', 'fade', 0.6));
      L.push(scene(TX('Three editors. One archive. A century of images that refused to stay still.', [w * 0.08, h * 0.7, w * 0.44, h * 0.1], { fontFamily: font, fontSize: 14 * f, lineHeight: 1.7, color: alpha(ivory, 0.6) }, { endTime: dur }), 2.2, dur - 1.2, 'up', 'fade', 0.8));
      L.push(scene(TX('DIRECTED BY  ·  S. TESFAYE', [w * 0.08, h * 0.92, w * 0.5, 20 * f], { fontFamily: MONO, fontSize: 8 * f, letterSpacing: 3 * f, color: alpha(ivory, 0.45) }, { endTime: dur }), 2.4, dur, 'fade', 'fade', 0.6));
      L.push(scene(TX('26:00', [w * 0.8, h * 0.92, w * 0.12, 20 * f], { fontFamily: MONO, fontSize: 8 * f, letterSpacing: 2 * f, color: alpha(ivory, 0.45), align: 'right' }, { endTime: dur }), 2.4, dur, 'fade', 'fade', 0.6));
      L.push(drift(SH('ellipse', [w * 0.55, h * 0.1, h * 0.8, h * 0.8], { fill: alpha(warm, 0.16), blendMode: 'screen', endTime: dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 100 }] }), 0, dur, -w * 0.06, h * 0.05));
      L.push(scene(SH('rect', [0, 0, w, h], { fill: 'transparent', endTime: dur, effects: [{ id: uid('fx'), type: 'grain', enabled: true, amount: 18 }, { id: uid('fx'), type: 'vignette', enabled: true, amount: 55 }] }), 0, dur, 'none', 'none', 0.1));
      return { background: bg, layers: L };
    },
  },

  // 13 ── Product gradient ─────────────────────────────────────────────────
  {
    id: 'mg-gradient-product', name: 'Aurora Product', style: 'Gradient mesh product film', category: 'Ad',
    tags: ['product', 'gradient', 'mesh', 'aurora', 'ad'], aspects: ['9:16', '1:1', '16:9'], duration: 30,
    colorways: [['#070512', '#7c3aed', '#22d3ee', '#f0abfc'], ['#0b0616', '#e879f9', '#fbbf24', '#8b5cf6'], ['#04110f', '#10b981', '#22d3ee', '#a3e635']],
    fonts: ['Outfit', 'Sora', 'Manrope'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, v, cy, pink] = c;
      const L: Layer[] = [];
      L.push(drift(SH('ellipse', [-w * 0.3, h * 0.05, w * 0.9, w * 0.9], { fill: v, opacity: 0.6, blendMode: 'screen', endTime: dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 100 }] }), 0, dur, w * 0.15, -h * 0.04));
      L.push(drift(SH('ellipse', [w * 0.35, h * 0.3, w * 0.8, w * 0.8], { fill: cy, opacity: 0.45, blendMode: 'screen', endTime: dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 90 }] }), 0, dur, -w * 0.12, h * 0.03));
      L.push(drift(SH('ellipse', [w * 0.05, h * 0.6, w * 0.6, w * 0.6], { fill: pink, opacity: 0.3, blendMode: 'screen', endTime: dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 80 }] }), 0, dur, w * 0.08, -h * 0.05));
      L.push(scene(TX('PRISM', [w * 0.08, h * 0.06, w * 0.4, 24 * f], { fontFamily: font, fontSize: 14 * f, fontWeight: 600, letterSpacing: 6 * f, color: '#fff' }, { endTime: dur }), 0.2, dur, 'fade', 'fade', 0.5));
      const pw = w * 0.56, ph = pw * 1.15, px = (w - pw) / 2, py = h * 0.2;
      L.push(scene(SH('roundedRect', [px, py, pw, ph], { fillGradient: gradient([alpha('#ffffff', 0.16), alpha('#ffffff', 0.03)], 145), fill: 'transparent', stroke: alpha('#ffffff', 0.35), strokeWidth: 1.4, radius: 28 * f, endTime: dur, effects: [{ id: uid('fx'), type: 'dropShadow', enabled: true, amount: 80, y: 40, blur: 60 }] }), 0.5, dur - 0.8, 'scale', 'fade', 1));
      L.push(scene(SH('roundedRect', [px + pw * 0.12, py + ph * 0.12, pw * 0.55, ph * 0.34], { fillGradient: gradient([v, cy], 140), fill: 'transparent', radius: 16 * f, endTime: dur }), 0.9, dur - 0.8, 'up', 'fade', 0.7));
      L.push(scene(SH('ellipse', [px + pw * 0.72, py + ph * 0.16, pw * 0.14, pw * 0.14], { fill: alpha('#ffffff', 0.5), endTime: dur }), 1.1, dur - 0.8, 'scale', 'fade', 0.6));
      for (let i = 0; i < 4; i++) {
        L.push(scene(SH('roundedRect', [px + pw * 0.12, py + ph * (0.56 + i * 0.08), pw * (0.7 - i * 0.1), 8 * f], { fill: alpha('#ffffff', 0.28 - i * 0.04), radius: 4, endTime: dur }), 1.2 + i * 0.12, dur - 0.8, 'left', 'fade', 0.5));
      }
      L.push(scene(TX('THE NEXT\nSURFACE', [w * 0.08, h * 0.62, w * 0.84, h * 0.16], { fontFamily: font, fontSize: h * 0.062, fontWeight: 600, lineHeight: 1.02, letterSpacing: -1.4 * f, color: '#fff' }, { endTime: dur }), 1.6, dur - 0.6, 'up', 'none', 0.7));
      L.push(scene(TX('One canvas. Every format. Zero handoff.', [w * 0.08, h * 0.79, w * 0.7, 40 * f], { fontFamily: font, fontSize: 14 * f, color: alpha('#ffffff', 0.65) }, { endTime: dur }), 2, dur - 0.6, 'left', 'none', 0.7));
      for (let i = 0; i < 8; i++) {
        const dot = SH('ellipse', [w / 2 - 4 * f, h * 0.18 - 4 * f, 8 * f, 8 * f], { fill: alpha(i % 2 ? cy : pink, 0.9), endTime: dur });
        L.push({ ...mergeKeys(dot, 'rotation', [kf(0.6 + i * 0.05, i * 45, LINEAR), kf(dur - 0.5, i * 45 + 300, LINEAR)]), anchorX: 0.5, anchorY: 0.5 + (w * 0.5) / Math.max(1, dot.h) });
      }
      L.push(scene(TX('prism.studio', [w * 0.08, h * 0.9, w * 0.4, 22 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 3 * f, color: alpha('#ffffff', 0.5) }, { endTime: dur }), 2.2, dur, 'fade', 'none', 0.5));
      L.push(scene(TX('AVAILABLE NOW', [w * 0.55, h * 0.9, w * 0.37, 22 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 3 * f, color: alpha('#ffffff', 0.8), align: 'right' }, { endTime: dur }), 2.3, dur, 'fade', 'none', 0.5));
      return { background: bg, layers: L };
    },
  },

  // 14 ── Brutalist manifesto ──────────────────────────────────────────────
  {
    id: 'mg-brutalist', name: 'Brutalist Manifesto', style: 'Brutalist typographic', category: 'Poster',
    tags: ['brutalist', 'manifesto', 'typography', 'bold', 'high contrast'], aspects: ['1:1', '9:16', '16:9'], duration: 24,
    colorways: [['#0b0b0b', '#f5e800', '#f5f5f5', '#ff3b30'], ['#f5f5f2', '#111111', '#ff3b30', '#1d4ed8'], ['#101010', '#22d3ee', '#f5f5f5', '#facc15']],
    fonts: ['Archivo Black', 'Anton', 'Staatliches'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, accent, ink, red] = c;
      const L: Layer[] = [];
      L.push(SH('rect', [0, 0, w, h], { fill: bg, endTime: dur }));
      L.push(scene(SH('rect', [0, 0, w * 0.38, h * 0.16], { fill: accent, endTime: dur }), 0.1, dur, 'left', 'none', 0.4));
      L.push(scene(TX('PRISM///', [w * 0.03, h * 0.035, w * 0.32, 44 * f], { fontFamily: font, fontSize: 26 * f, color: bg, letterSpacing: 0 }, { endTime: dur }), 0.2, dur, 'fade', 'none', 0.4));
      L.push(scene(TX('MANIFESTO', [w * 0.62, h * 0.035, w * 0.35, 30 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 4 * f, color: alpha(ink, 0.7), align: 'right' }, { endTime: dur }), 0.3, dur, 'fade', 'none', 0.5));
      ['MAKE', 'IT', 'LOUD.'].forEach((word, i) => {
        const y = h * (0.2 + i * 0.17);
        L.push(scene(SH('rect', [w * 0.03, y + h * 0.14, w * 0.94, 3 * f], { fill: alpha(ink, 0.18), endTime: dur }), 0.3 + i * 0.12, dur, 'none', 'none', 0.4));
        L.push(scene(TX(word, [w * 0.03, y, w * 0.94, h * 0.16], { fontFamily: font, fontSize: h * 0.16, fontWeight: 700, letterSpacing: -h * 0.004, color: i === 2 ? red : ink, uppercase: true }, { endTime: dur }), 0.4 + i * 0.22, dur, 'left', 'none', 0.5));
      });
      ['NO TEMPLATES', 'NO WAITING', 'NO HANDOFF', 'NO EXCUSES'].forEach((s, i) => {
        const x = w * (i % 2 === 0 ? 0.03 : 0.52);
        const y = h * (0.7 + Math.floor(i / 2) * 0.07);
        L.push(scene(TX(s, [x, y, w * 0.45, 26 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 1.6 * f, color: i === 3 ? red : alpha(ink, 0.75) }, { endTime: dur }), 1.2 + i * 0.14, dur, 'fade', 'none', 0.5));
      });
      L.push(scene(SH('rect', [0, h * 0.9, w, h * 0.1], { fill: alpha(ink, 0.08), endTime: dur }), 0.6, dur, 'up', 'none', 0.5));
      L.push(scene(TX('DESIGN IS A DECISION, NOT A DELAY.', [w * 0.03, h * 0.925, w * 0.94, 30 * f], { fontFamily: font, fontSize: 12 * f, letterSpacing: 1 * f, color: ink }, { endTime: dur }), 0.8, dur, 'fade', 'none', 0.5));
      L.push(scene(SH('burst', [w * 0.82, h * 0.74, w * 0.14, w * 0.14], { fill: red, points: 22, innerRadius: 0.66, endTime: dur }), 1.4, dur, 'scale', 'none', 0.5));
      return { background: bg, layers: L };
    },
  },
];
