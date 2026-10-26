import type { Layer } from '@/lib/engine/types';
import { gradient } from '@/lib/engine/factory';
import { uid } from '@/lib/utils';
import {
  MONO, SH, TX, alpha, drift, enter, kf, leave, mergeKeys, mix, scene, typeScale,
  EASE, LINEAR, type MotionFamily,
} from './shared';

// 7 long-form motion families: Swiss kinetic, glass SaaS, broadcast, cyber, explainer, retro, corporate.

export const SET_A: MotionFamily[] = [
  // 1 ── Kinetic Swiss ────────────────────────────────────────────────────────
  {
    id: 'mg-kinetic-swiss', name: 'Kinetic Swiss', style: 'International typographic', category: 'Motion',
    tags: ['kinetic', 'typography', 'swiss', 'minimal', 'showreel'], aspects: ['16:9', '1:1', '9:16'], duration: 24,
    colorways: [['#f5f2ec', '#e8442c', '#111111', '#8f8b84'], ['#0d0d0f', '#f5f2ec', '#ff4d2e', '#9a9a9a'], ['#eef3f7', '#1450f5', '#0b1220', '#7e8a9a']],
    fonts: ['Space Grotesk', 'Archivo', 'Inter'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, accent, ink, muted] = c;
      const L: Layer[] = [];
      const margin = w * 0.07;
      L.push(SH('rect', [margin, h * 0.08, 1.5 * f, h * 0.84], { fill: ink, opacity: 0.25, endTime: dur, startTime: 0 }));
      L.push(TX('PRISM / MOTION STUDY 01', [margin + 14 * f, h * 0.06, w * 0.6, 22 * f], { fontFamily: MONO, fontSize: 12 * f, letterSpacing: 3 * f, color: ink, uppercase: true }, { endTime: dur, opacity: 0.75 }));
      L.push(TX(`${dur}.0 SEC · 30 FPS`, [w * 0.7, h * 0.06, w * 0.24, 22 * f], { fontFamily: MONO, fontSize: 12 * f, letterSpacing: 2 * f, color: muted, align: 'right' }, { endTime: dur }));
      const chapters = [
        { t: 0, word: 'FORM', sub: 'follows feeling' },
        { t: dur * 0.34, word: 'RHYTHM', sub: 'is a design decision' },
        { t: dur * 0.68, word: 'MOTION', sub: 'makes meaning visible' },
      ];
      chapters.forEach((ch, i) => {
        const next = chapters[i + 1]?.t ?? dur;
        const big = TX(ch.word, [margin + 30 * f, h * 0.28, w - margin * 2, h * 0.34], {
          fontFamily: font, fontSize: h * 0.3, fontWeight: 700, letterSpacing: -h * 0.012, color: ink, uppercase: true,
        }, { endTime: next });
        L.push(leave(enter(big, ch.t + 0.1, 'up', 0.5), next - 0.1, 'up', 0.4));
        const sub = TX(ch.sub, [margin + 34 * f, h * 0.63, w * 0.5, h * 0.08], {
          fontFamily: font, fontSize: 24 * f, fontWeight: 400, color: accent, letterSpacing: 0.2 * f,
        }, { endTime: next - 0.2 });
        L.push(scene(sub, ch.t + 0.5, next - 0.25, 'left', 'fade', 0.5));
        L.push(scene(SH('rect', [margin + 34 * f, h * 0.72, w * 0.18, 6 * f], { fill: accent, radius: 3, endTime: next }), ch.t + 0.6, next - 0.2, 'none', 'fade', 0.4));
        L.push(scene(TX(`0${i + 1}`, [w - margin - 90 * f, h * 0.7, 90 * f, 40 * f], { fontFamily: MONO, fontSize: 34 * f, color: muted, align: 'right', fontWeight: 500 }, { endTime: next }), ch.t + 0.3, next - 0.2, 'fade', 'none', 0.5));
        for (let r = 0; r < 3; r++) {
          const y = h * 0.82 + r * 7 * f;
          const line = SH('rect', [margin + 34 * f, y, 0, 1 * f], { fill: ink, opacity: 0.35, endTime: next });
          L.push({ ...line, keyframes: { w: [kf(ch.t + 0.3 + r * 0.08, 0), kf(ch.t + 1.1 + r * 0.08, w * (0.12 + r * 0.06), EASE)] } });
        }
      });
      const bar = SH('rect', [margin, h * 0.94, 0, 2 * f], { fill: accent, endTime: dur });
      L.push({ ...bar, keyframes: { w: [kf(0, 0), kf(dur, w - margin * 2, LINEAR)] } });
      return { background: bg, layers: L };
    },
  },

  // 2 ── Glass SaaS ───────────────────────────────────────────────────────────
  {
    id: 'mg-glass-saas', name: 'Glass Launch', style: 'Glassmorphic product launch', category: 'Ad',
    tags: ['saas', 'product', 'glass', 'gradient', 'launch'], aspects: ['16:9', '9:16', '1:1'], duration: 30,
    colorways: [['#07070f', '#8b5cf6', '#22d3ee', '#e879f9'], ['#050b12', '#22d3ee', '#a3e635', '#6366f1'], ['#0f0714', '#e879f9', '#fbbf24', '#8b5cf6']],
    fonts: ['Sora', 'Outfit', 'Manrope'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, v1, cy, mg] = c;
      const L: Layer[] = [];
      L.push(leave(SH('ellipse', [-w * 0.15, -h * 0.25, h * 0.95, h * 0.95], { fill: v1, opacity: 0.55, blendMode: 'screen', endTime: dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 90 }] }), dur, 'fade', 0.8));
      L.push(leave(SH('ellipse', [w * 0.62, h * 0.45, h * 0.7, h * 0.7], { fill: cy, opacity: 0.4, blendMode: 'screen', endTime: dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 80 }] }), dur, 'fade', 0.8));
      L.push(drift(SH('ellipse', [w * 0.2, h * 0.1, h * 0.4, h * 0.4], { fill: mg, opacity: 0.22, blendMode: 'screen', endTime: dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 70 }] }), 0, dur, w * 0.08, h * 0.05));
      L.push(scene(TX('prism', [w * 0.07, h * 0.06, w * 0.3, 34 * f], { fontFamily: font, fontSize: 22 * f, fontWeight: 700, letterSpacing: -0.4 * f, color: '#fff' }, { endTime: dur }), 0.2, dur, 'down', 'none', 0.6));
      L.push(scene(TX('AGENT OS', [w * 0.07 + 70 * f, h * 0.062, w * 0.2, 26 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 3 * f, color: cy, uppercase: true }, { endTime: dur }), 0.4, dur, 'fade', 'none', 0.6));
      const head = TX('Design at the\nspeed of thought', [w * 0.07, h * 0.24, w * 0.62, h * 0.26], {
        fontFamily: font, fontSize: h * 0.093, fontWeight: 700, lineHeight: 0.98, letterSpacing: -h * 0.004, color: '#fff',
        animator: { type: 'wordReveal', duration: 1.1, stagger: 0.06, delay: 0 },
      }, { endTime: dur });
      L.push(scene(head, 0.7, dur, 'scale', 'none', 0.9));
      L.push(scene(TX('A real agent that builds, animates and exports in your browser — talking to the models you choose.', [w * 0.07, h * 0.52, w * 0.46, h * 0.12], { fontFamily: font, fontSize: 17 * f, lineHeight: 1.55, color: alpha('#ffffff', 0.68) }, { endTime: dur }), 1.4, dur, 'left', 'none', 0.8));
      const chips = ['Tool calling', 'Live timeline', '30s exports', 'Bring your own model'];
      chips.forEach((label, i) => {
        const cw = (label.length * 8.2 + 34) * f;
        const x = w * 0.07 + (i % 2) * (cw + 14 * f);
        const y = h * 0.66 + Math.floor(i / 2) * 34 * f;
        L.push(scene(SH('roundedRect', [x, y, cw, 26 * f], { fill: alpha('#ffffff', 0.09), stroke: alpha('#ffffff', 0.16), strokeWidth: 1, radius: 13 * f, endTime: dur }), 2 + i * 0.18, dur - 0.6, 'scale', 'fade', 0.5));
        L.push(scene(SH('ellipse', [x + 9 * f, y + 9 * f, 8 * f, 8 * f], { fill: i % 2 ? cy : mg, endTime: dur }), 2.1 + i * 0.18, dur - 0.6, 'scale', 'fade', 0.5));
        L.push(scene(TX(label, [x + 22 * f, y + 4 * f, cw - 26 * f, 18 * f], { fontFamily: font, fontSize: 11.5 * f, color: '#fff', fontWeight: 500 }, { endTime: dur }), 2.15 + i * 0.18, dur - 0.6, 'fade', 'fade', 0.5));
      });
      const cardX = w * 0.6, cardY = h * 0.2, cardW = w * 0.33, cardH = h * 0.6;
      L.push(scene(SH('roundedRect', [cardX, cardY, cardW, cardH], {
        fill: alpha('#0b0b12', 0.78), stroke: alpha('#ffffff', 0.14), strokeWidth: 1.2, radius: 18 * f, endTime: dur,
        effects: [{ id: uid('fx'), type: 'dropShadow', enabled: true, amount: 80, y: 40, blur: 60 }],
      }), 0.5, dur, 'up', 'none', 0.9));
      L.push(scene(SH('roundedRect', [cardX + 16 * f, cardY + 16 * f, cardW - 32 * f, 26 * f], { fill: alpha('#ffffff', 0.06), radius: 8 * f, endTime: dur }), 0.9, dur, 'fade', 'none', 0.6));
      for (let i = 0; i < 3; i++) L.push(scene(SH('ellipse', [cardX + 26 * f + i * 12 * f, cardY + 23 * f, 7 * f, 7 * f], { fill: [alpha('#f87171', 0.9), alpha('#fbbf24', 0.9), alpha('#34d399', 0.9)][i], endTime: dur }), 1 + i * 0.08, dur, 'scale', 'none', 0.4));
      for (let i = 0; i < 6; i++) {
        const y = cardY + 70 * f + i * 44 * f;
        const rowW = cardW - 60 * f;
        L.push(scene(SH('roundedRect', [cardX + 26 * f, y, rowW * (0.45 + (i % 3) * 0.18), 12 * f], { fill: alpha(i % 2 ? cy : v1, 0.85), radius: 6 * f, endTime: dur }), 1.2 + i * 0.14, dur, 'left', 'none', 0.5));
        L.push(scene(SH('roundedRect', [cardX + 26 * f + rowW * (0.5 + (i % 3) * 0.18), y, rowW * 0.12, 12 * f], { fill: alpha(mg, 0.75), radius: 6 * f, endTime: dur }), 1.3 + i * 0.14, dur, 'left', 'none', 0.5));
        L.push(scene(SH('diamond', [cardX + 22 * f, y - 3 * f, 8 * f, 8 * f], { fill: '#fff', endTime: dur }), 1.4 + i * 0.14, dur, 'scale', 'none', 0.4));
      }
      const ph = SH('rect', [cardX + 50 * f, cardY + 62 * f, 1.5 * f, 260 * f], { fill: '#fff', opacity: 0.8, endTime: dur });
      L.push({ ...ph, keyframes: { x: [kf(2, cardX + 50 * f, LINEAR), kf(dur - 2, cardX + cardW - 60 * f, LINEAR)] } });
      L.push(scene(SH('roundedRect', [w * 0.07, h * 0.828, w * 0.2, 34 * f], { fill: '#ffffff', radius: 8 * f, endTime: dur, effects: [{ id: uid('fx'), type: 'dropShadow', enabled: true, amount: 40, blur: 30, y: 8 }] }), 2.6, dur, 'up', 'none', 0.6));
      L.push(scene(TX('Start building →', [w * 0.085, h * 0.836, w * 0.18, 26 * f], { fontFamily: font, fontSize: 13 * f, fontWeight: 600, color: '#0b0b12' }, { endTime: dur }), 2.65, dur, 'fade', 'none', 0.6));
      L.push(scene(TX('prism.studio', [w * 0.07, h * 0.9, w * 0.3, 22 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 2.5 * f, color: alpha('#ffffff', 0.5) }, { endTime: dur }), 2.8, dur, 'fade', 'none', 0.6));
      return { background: bg, backgroundGradient: gradient([bg, mix(v1, '#000000', 0.72), bg], 135), layers: L };
    },
  },

  // 3 ── Broadcast news ───────────────────────────────────────────────────────
  {
    id: 'mg-broadcast-news', name: 'Broadcast Open', style: 'News / current affairs', category: 'Lower Third',
    tags: ['broadcast', 'news', 'ticker', 'lower third', 'titles'], aspects: ['16:9'], duration: 18,
    colorways: [['#0b1a33', '#e11d48', '#f8fafc', '#38bdf8'], ['#0d1620', '#f59e0b', '#f8fafc', '#22d3ee'], ['#111827', '#22c55e', '#f8fafc', '#f43f5e']],
    fonts: ['Archivo', 'Oswald', 'Inter'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, accent, ink, cool] = c;
      const L: Layer[] = [];
      L.push(SH('rect', [0, h * 0.82, w, h * 0.18], { fill: mix(bg, '#ffffff', 0.06), endTime: dur }));
      for (let i = 0; i < 3; i++) {
        const ring = SH('ring', [w * 0.62 - i * 40 * f, h * 0.16 - i * 40 * f, h * 0.52 + i * 80 * f, h * 0.52 + i * 80 * f], { fill: 'transparent', stroke: alpha(i === 0 ? accent : cool, 0.5 - i * 0.12), strokeWidth: 2 * f, innerRadius: 0.86, endTime: dur });
        L.push(scene(mergeKeys(ring, 'rotation', [kf(0, 0, LINEAR), kf(dur, i % 2 ? -80 : 90, LINEAR)]), 0.2 + i * 0.12, dur, 'scale', 'none', 0.9));
      }
      L.push(scene(SH('ellipse', [w * 0.62 + h * 0.16, h * 0.16 + h * 0.16, h * 0.2, h * 0.2], { fillGradient: gradient([accent, cool], 140), fill: 'transparent', endTime: dur, effects: [{ id: uid('fx'), type: 'glow', enabled: true, amount: 55, color: accent }] }), 0.3, dur, 'scale', 'none', 0.8));
      L.push(scene(SH('rect', [0, 0, w, 6 * f], { fill: accent, endTime: dur }), 0, dur, 'none', 'none', 0.01));
      L.push(scene(TX('PRISM NEWS', [w * 0.06, h * 0.08, w * 0.4, 26 * f], { fontFamily: font, fontSize: 15 * f, fontWeight: 700, letterSpacing: 4 * f, color: ink, uppercase: true }, { endTime: dur }), 0.2, dur, 'left', 'none', 0.6));
      L.push(scene(TX('LIVE · 18:00 GMT', [w * 0.78, h * 0.08, w * 0.16, 24 * f], { fontFamily: MONO, fontSize: 11 * f, letterSpacing: 2 * f, color: accent, align: 'right' }, { endTime: dur }), 0.4, dur, 'fade', 'none', 0.5));
      L.push(scene(SH('ellipse', [w * 0.755, h * 0.083, 8 * f, 8 * f], { fill: accent, endTime: dur }), 0.4, dur, 'scale', 'none', 0.4));
      ['THE STORY', 'BEHIND', 'THE SHIFT'].forEach((t, i) => {
        const y = h * 0.3 + i * h * 0.13;
        L.push(scene(TX(t, [w * 0.06, y, w * 0.6, h * 0.13], { fontFamily: font, fontSize: h * 0.105, fontWeight: 700, letterSpacing: -2 * f, color: ink, uppercase: true }, { endTime: dur }), 0.5 + i * 0.22, dur - 1.2, 'left', 'none', 0.55));
        L.push(scene(SH('rect', [w * 0.06 + 4 * f, y + h * 0.115, w * 0.12, 2.5 * f], { fill: accent, endTime: dur }), 0.9 + i * 0.22, dur - 1.2, 'none', 'fade', 0.4));
      });
      L.push(scene(TX('A special report on how autonomous design tools are reshaping the newsroom.', [w * 0.06, h * 0.66, w * 0.46, h * 0.08], { fontFamily: font, fontSize: 15 * f, lineHeight: 1.5, color: alpha(ink, 0.7) }, { endTime: dur }), 1.5, dur - 1.2, 'up', 'none', 0.6));
      L.push(scene(SH('rect', [0, h * 0.86, w * 0.58, 52 * f], { fill: accent, endTime: dur }), 2, dur - 0.8, 'left', 'none', 0.6));
      L.push(scene(SH('rect', [w * 0.58, h * 0.86, w * 0.42, 52 * f], { fill: mix(bg, '#ffffff', 0.12), endTime: dur }), 2.1, dur - 0.8, 'left', 'none', 0.6));
      L.push(scene(TX('ANALYSIS', [w * 0.06, h * 0.875, w * 0.16, 28 * f], { fontFamily: font, fontSize: 12 * f, fontWeight: 700, letterSpacing: 3 * f, color: '#fff', uppercase: true }, { endTime: dur }), 2.2, dur - 0.8, 'fade', 'none', 0.5));
      L.push(scene(TX('Why motion design is the new interface', [w * 0.06, h * 0.905, w * 0.46, 24 * f], { fontFamily: font, fontSize: 13 * f, color: '#fff' }, { endTime: dur }), 2.3, dur - 0.8, 'fade', 'none', 0.5));
      L.push(scene(SH('rect', [0, h * 0.95, w, 26 * f], { fill: alpha('#000000', 0.35), endTime: dur }), 2.2, dur, 'none', 'fade', 0.4));
      const ticker = TX('PRISM STUDIO   •   AGENT RUNS COMPLETE   •   30 SECOND TIMELINES   •   REAL TOOL CALLS   •   EXPORT TO MP4   •   ', [w * 0.02, h * 0.955, w * 1.4, 18 * f], { fontFamily: MONO, fontSize: 10.5 * f, letterSpacing: 2 * f, color: alpha(ink, 0.8), uppercase: true }, { endTime: dur });
      L.push({ ...enter(ticker, 2.3, 'none'), keyframes: { x: [kf(2.3, w * 0.02, LINEAR), kf(dur, -w * 0.6, LINEAR)] } });
      L.push(scene(TX('WATCH THE FULL FILM', [w * 0.06, h * 0.4, w * 0.5, h * 0.1], { fontFamily: font, fontSize: 20 * f, letterSpacing: 6 * f, color: ink, uppercase: true }, { endTime: dur }), dur - 2.2, dur, 'fade', 'fade', 0.5));
      return { background: bg, backgroundGradient: gradient([mix(bg, '#ffffff', 0.08), bg, mix(bg, '#000000', 0.4)], 160), layers: L };
    },
  },

  // 4 ── Neon cyber title ────────────────────────────────────────────────────
  {
    id: 'mg-neon-cyber', name: 'Neon Protocol', style: 'Cyberpunk title sequence', category: 'Motion',
    tags: ['cyberpunk', 'neon', 'glitch', 'title', 'sci-fi'], aspects: ['16:9', '9:16'], duration: 22,
    colorways: [['#050507', '#e879f9', '#22d3ee', '#facc15'], ['#060410', '#8b5cf6', '#34d399', '#f472b6'], ['#080606', '#f43f5e', '#38bdf8', '#fde047']],
    fonts: ['Chakra Petch', 'Unbounded', 'Space Grotesk'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, mg, cy, hi] = c;
      const L: Layer[] = [];
      for (let i = 0; i < 14; i++) {
        const y = h * 0.62 + i * i * 1.35;
        if (y > h) break;
        L.push(SH('rect', [0, y, w, 1.3 * f], { fill: alpha(cy, 0.16 + i * 0.02), endTime: dur }));
      }
      for (let i = -8; i <= 8; i++) {
        L.push({ ...SH('rect', [w / 2 + i * w * 0.08, h * 0.62, 1 * f, h * 0.38], { fill: alpha(cy, 0.12), endTime: dur }), rotation: i * 3.1 });
      }
      L.push(scene(SH('rect', [w * 0.04, h * 0.05, w * 0.92, h * 0.9], { fill: 'transparent', stroke: alpha(mg, 0.35), strokeWidth: 1.2, endTime: dur }), 0.2, dur, 'fade', 'none', 0.6));
      for (const [x, y, sx, sy] of [[w * 0.04, h * 0.05, 1, 1], [w * 0.96, h * 0.05, -1, 1], [w * 0.04, h * 0.95, 1, -1], [w * 0.96, h * 0.95, -1, -1]] as const) {
        L.push(scene(SH('rect', [x, y, 26 * f * sx, 2 * f], { fill: hi, endTime: dur }), 0.3, dur, 'scale', 'none', 0.5));
        L.push(scene(SH('rect', [x, y, 2 * f, 26 * f * sy], { fill: hi, endTime: dur }), 0.3, dur, 'scale', 'none', 0.5));
      }
      L.push(scene(TX('SYS://PRISM_OS  v4.0', [w * 0.06, h * 0.07, w * 0.4, 20 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 2 * f, color: alpha(cy, 0.85) }, { endTime: dur }), 0.4, dur, 'fade', 'none', 0.5));
      L.push(scene(TX('NEURAL LINK ESTABLISHED', [w * 0.55, h * 0.07, w * 0.39, 20 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 1.6 * f, color: alpha(mg, 0.85), align: 'right' }, { endTime: dur }), 0.6, dur, 'fade', 'none', 0.5));
      const title = TX('PROTOCOL', [w * 0.06, h * 0.36, w * 0.9, h * 0.24], {
        fontFamily: font, fontSize: h * 0.185, fontWeight: 700, letterSpacing: -h * 0.006, color: '#ffffff', uppercase: true,
        gradient: gradient([mg, '#ffffff', cy], 100),
      }, { endTime: dur, effects: [{ id: uid('fx'), type: 'glow', enabled: true, amount: 55, color: mg }, { id: uid('fx'), type: 'chromatic', enabled: true, amount: 18 }] });
      L.push(scene(title, 1, dur - 1.4, 'scale', 'none', 0.33));
      L.push(scene(TX('A FILM ABOUT MACHINES THAT MAKE', [w * 0.06, h * 0.6, w * 0.7, 24 * f], { fontFamily: MONO, fontSize: 12 * f, letterSpacing: 6 * f, color: alpha('#ffffff', 0.7) }, { endTime: dur }), 1.8, dur - 1.4, 'fade', 'none', 0.6));
      const sweep = SH('rect', [0, -h * 0.1, w, 2 * f], { fill: alpha(cy, 0.9), endTime: dur, effects: [{ id: uid('fx'), type: 'glow', enabled: true, amount: 80, color: cy }] });
      L.push({ ...sweep, keyframes: { y: [kf(0.5, -h * 0.05, LINEAR), kf(4, h * 1.05, LINEAR)] } });
      [['NEURAL', '98.4%'], ['LATENCY', '12ms'], ['LAYERS', '1,204'], ['RENDER', '60fps']].forEach(([k, v], i) => {
        const x = w * 0.06 + i * w * 0.23;
        L.push(scene(TX(k, [x, h * 0.76, w * 0.2, 18 * f], { fontFamily: MONO, fontSize: 9.5 * f, letterSpacing: 2 * f, color: alpha(mg, 0.8) }, { endTime: dur }), 2.2 + i * 0.18, dur - 1.4, 'fade', 'none', 0.5));
        L.push(scene(TX(v, [x, h * 0.79, w * 0.2, 30 * f], { fontFamily: font, fontSize: 24 * f, fontWeight: 600, color: '#fff' }, { endTime: dur }), 2.3 + i * 0.18, dur - 1.4, 'up', 'none', 0.5));
        L.push(scene(SH('rect', [x, h * 0.815, w * 0.16, 1.5 * f], { fill: alpha(cy, 0.5), endTime: dur }), 2.4 + i * 0.18, dur - 1.4, 'none', 'none', 0.4));
      });
      L.push(scene(SH('burst', [w * 0.42, h * 0.3, h * 0.16, h * 0.16], { fill: alpha(mg, 0.8), points: 24, innerRadius: 0.72, endTime: dur, effects: [{ id: uid('fx'), type: 'glow', enabled: true, amount: 90, color: mg }] }), dur - 2, dur, 'scale', 'fade', 0.6));
      L.push(scene(TX('PRISM', [0, h * 0.44, w, h * 0.12], { fontFamily: font, fontSize: h * 0.09, fontWeight: 700, letterSpacing: h * 0.02, color: '#fff', align: 'center' }, { endTime: dur }), dur - 1.9, dur, 'fade', 'scale', 0.6));
      return { background: bg, backgroundGradient: gradient([bg, mix(mg, '#000000', 0.82), bg], 160), layers: L };
    },
  },

  // 5 ── Line explainer ─────────────────────────────────────────────────────
  {
    id: 'mg-line-explainer', name: 'Line Explainer', style: 'Editorial line-art explainer', category: 'Motion',
    tags: ['explainer', 'line art', 'education', 'story', 'minimal'], aspects: ['16:9', '9:16', '1:1'], duration: 26,
    colorways: [['#f7f5f0', '#111111', '#e8442c', '#b8b2a6'], ['#eef1f5', '#0f172a', '#2563eb', '#94a3b8'], ['#101014', '#f4f4f5', '#22d3ee', '#71717a']],
    fonts: ['DM Sans', 'Manrope', 'Inter'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, ink, accent, muted] = c;
      const L: Layer[] = [];
      L.push(scene(TX('01 — THE QUESTION', [w * 0.08, h * 0.08, w * 0.5, 22 * f], { fontFamily: MONO, fontSize: 10.5 * f, letterSpacing: 3 * f, color: muted, uppercase: true }, { endTime: dur }), 0.2, dur, 'fade', 'none', 0.5));
      L.push(scene(SH('rect', [w * 0.08, h * 0.12, w * 0.84, 1 * f], { fill: alpha(ink, 0.2), endTime: dur }), 0.3, dur, 'none', 'none', 0.4));
      const stages = [
        { t: 0.4, n: '01', title: 'Attention is\na scarce resource', caption: 'Every surface competes for the same two seconds.', art: 'circle' },
        { t: dur * 0.28, n: '02', title: 'Motion creates\nhierarchy', caption: 'Movement directs the eye before a single word is read.', art: 'arrows' },
        { t: dur * 0.53, n: '03', title: 'Systems beat\none-offs', caption: 'A kit of parts scales across every channel you own.', art: 'grid' },
        { t: dur * 0.78, n: '04', title: 'Make it\nrepeatable', caption: 'Templates turn taste into throughput.', art: 'orbit' },
      ];
      stages.forEach((st, i) => {
        const next = stages[i + 1]?.t ?? dur;
        L.push(scene(TX(st.n, [w * 0.08, h * 0.2, w * 0.12, h * 0.1], { fontFamily: font, fontSize: 44 * f, fontWeight: 300, color: accent }, { endTime: next }), st.t, next - 0.2, 'fade', 'fade', 0.5));
        L.push(scene(TX(st.title, [w * 0.08, h * 0.32, w * 0.44, h * 0.24], { fontFamily: font, fontSize: h * 0.075, fontWeight: 600, lineHeight: 1.02, letterSpacing: -1.6 * f, color: ink }, { endTime: next }), st.t + 0.15, next - 0.2, 'left', 'fade', 0.6));
        L.push(scene(TX(st.caption, [w * 0.08, h * 0.58, w * 0.36, h * 0.1], { fontFamily: font, fontSize: 14.5 * f, lineHeight: 1.55, color: muted }, { endTime: next }), st.t + 0.4, next - 0.2, 'left', 'fade', 0.6));
        L.push(scene(SH('rect', [w * 0.08, h * 0.7, w * 0.04, 2 * f], { fill: accent, endTime: next }), st.t + 0.4, next - 0.2, 'none', 'fade', 0.4));
        const bx = w * 0.56, by = h * 0.24, bw = w * 0.36, bh = h * 0.54;
        L.push(scene(SH('rect', [bx, by, bw, bh], { fill: 'transparent', stroke: alpha(ink, 0.18), strokeWidth: 1.2, endTime: next }), st.t, next - 0.2, 'scale', 'fade', 0.7));
        if (st.art === 'circle') {
          for (let r = 0; r < 4; r++) {
            const ring = SH('ring', [bx + bw / 2 - bw * (0.12 + r * 0.09), by + bh / 2 - bw * (0.12 + r * 0.09), bw * (0.24 + r * 0.18), bw * (0.24 + r * 0.18)], { fill: 'transparent', stroke: alpha(ink, 0.55 - r * 0.1), strokeWidth: 1.6, innerRadius: 0.94, endTime: next });
            L.push(scene(ring, st.t + 0.2 + r * 0.14, next - 0.2, 'scale', 'fade', 0.6));
          }
          L.push(scene(SH('ellipse', [bx + bw / 2 - 10 * f, by + bh / 2 - 10 * f, 20 * f, 20 * f], { fill: accent, endTime: next }), st.t + 0.8, next - 0.2, 'scale', 'fade', 0.4));
        }
        if (st.art === 'arrows') {
          for (let r = 0; r < 5; r++) {
            const arrow = SH('arrow', [bx + 24 * f, by + 30 * f + r * (bh - 60 * f) / 4, bw * 0.6 - r * 18 * f, 8 * f], { fill: alpha(ink, 0.75 - r * 0.1), endTime: next });
            L.push(scene(arrow, st.t + 0.2 + r * 0.12, next - 0.2, 'left', 'fade', 0.5));
          }
          L.push(scene(SH('ellipse', [bx + bw * 0.72, by + bh * 0.42, 44 * f, 44 * f], { fill: accent, endTime: next }), st.t + 0.6, next - 0.2, 'scale', 'fade', 0.5));
        }
        if (st.art === 'grid') {
          for (let gx = 0; gx < 4; gx++) {
            for (let gy = 0; gy < 4; gy++) {
              const cell = SH('roundedRect', [bx + 22 * f + gx * (bw - 44 * f) / 4, by + 24 * f + gy * (bh - 48 * f) / 4, (bw - 52 * f) / 4, (bh - 58 * f) / 4], { fill: (gx + gy) % 3 === 0 ? alpha(accent, 0.85) : alpha(ink, 0.08), radius: 5 * f, endTime: next });
              L.push(scene(cell, st.t + 0.15 + (gx + gy) * 0.05, next - 0.2, 'scale', 'fade', 0.45));
            }
          }
        }
        if (st.art === 'orbit') {
          L.push(scene(SH('ellipse', [bx + bw / 2 - 18 * f, by + bh / 2 - 18 * f, 36 * f, 36 * f], { fill: accent, endTime: next }), st.t + 0.2, next - 0.2, 'scale', 'fade', 0.5));
          for (let r = 1; r <= 3; r++) {
            const orbit = SH('ring', [bx + bw / 2 - (30 + r * 30) * f, by + bh / 2 - (30 + r * 30) * f, (60 + r * 60) * f, (60 + r * 60) * f], { fill: 'transparent', stroke: alpha(ink, 0.3), strokeWidth: 1.2, innerRadius: 0.95, endTime: next });
            L.push(scene(orbit, st.t + 0.3 + r * 0.1, next - 0.2, 'scale', 'fade', 0.6));
            const dot = SH('ellipse', [bx + bw / 2 - 5 * f, by + bh / 2 - (30 + r * 30) * f - 5 * f, 10 * f, 10 * f], { fill: ink, endTime: next });
            L.push({ ...mergeKeys(dot, 'rotation', [kf(st.t + 0.4, 0, LINEAR), kf(next - 0.3, 260 + r * 40, LINEAR)]), anchorX: 0.5, anchorY: 0.5 + (30 + r * 30) * f / Math.max(1, dot.h) });
          }
        }
      });
      L.push(scene(TX('PRISM STUDIO · 2026', [w * 0.08, h * 0.92, w * 0.4, 18 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 2 * f, color: alpha(ink, 0.45) }, { endTime: dur }), 0.2, dur, 'fade', 'none', 0.5));
      return { background: bg, layers: L };
    },
  },

  // 6 ── Retro sunburst ─────────────────────────────────────────────────────
  {
    id: 'mg-retro-sun', name: 'Retro Sunburst', style: 'Seventies poster motion', category: 'Poster',
    tags: ['retro', '70s', 'sunburst', 'groovy', 'festival'], aspects: ['1:1', '4:5', '16:9'], duration: 20,
    colorways: [['#f4e6cf', '#e8663c', '#7c3f2b', '#f2b64c'], ['#f6f0e1', '#2f6b5e', '#1f3d36', '#e6a94f'], ['#f8e9e9', '#c2410c', '#3b1d14', '#fbbf24']],
    fonts: ['Fraunces', 'Playfair Display', 'Outfit'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, sun, ink, gold] = c;
      const L: Layer[] = [];
      const rays = 18;
      for (let i = 0; i < rays; i++) {
        const ray = SH('trapezoid', [w / 2 - 6 * f, h * 0.5, 12 * f, h * 0.42], { fill: alpha(sun, i % 2 ? 0.14 : 0.22), endTime: dur, rotation: (360 / rays) * i, anchorX: 0.5, anchorY: 1 });
        L.push(ray);
      }
      for (let i = 0; i < 5; i++) {
        const ring = SH('ellipse', [w / 2 - (h * 0.06 + i * h * 0.035), h * 0.62 - (h * 0.06 + i * h * 0.035), (h * 0.12 + i * h * 0.07), (h * 0.12 + i * h * 0.07)], { fill: i % 2 ? alpha(sun, 0.55) : alpha(gold, 0.8), endTime: dur });
        L.push(scene(ring, i * 0.08, dur, 'scale', 'none', 0.7));
      }
      for (let i = 0; i < 6; i++) {
        L.push(SH('rect', [0, h * 0.78 + i * h * 0.035, w, h * 0.014], { fill: alpha(ink, 0.55 - i * 0.06), endTime: dur }));
      }
      L.push(scene(TX('FEEL', [w * 0.06, h * 0.14, w * 0.88, h * 0.2], { fontFamily: font, fontSize: h * 0.22, fontWeight: 700, letterSpacing: -h * 0.008, color: ink, align: 'center' }, { endTime: dur }), 0.3, dur, 'up', 'none', 0.7));
      L.push(scene(TX('THE', [w * 0.06, h * 0.33, w * 0.88, h * 0.08], { fontFamily: font, fontSize: h * 0.055, fontWeight: 500, letterSpacing: h * 0.03, color: sun, align: 'center' }, { endTime: dur }), 0.7, dur, 'fade', 'none', 0.6));
      L.push(scene(TX('GOOD', [w * 0.06, h * 0.4, w * 0.88, h * 0.2], { fontFamily: font, fontSize: h * 0.2, fontWeight: 700, letterSpacing: -h * 0.006, color: ink, align: 'center' }, { endTime: dur }), 0.9, dur, 'up', 'none', 0.7));
      L.push(scene(TX('MOTION', [w * 0.06, h * 0.58, w * 0.88, h * 0.12], { fontFamily: font, fontSize: h * 0.085, fontWeight: 600, letterSpacing: h * 0.012, color: sun, align: 'center', uppercase: true }, { endTime: dur }), 1.2, dur, 'fade', 'none', 0.7));
      L.push(scene(TX('A GROOVE IN SIXTEEN FRAMES', [w * 0.06, h * 0.86, w * 0.88, h * 0.04], { fontFamily: 'JetBrains Mono', fontSize: 11 * f, letterSpacing: 4 * f, color: alpha(ink, 0.7), align: 'center' }, { endTime: dur }), 1.5, dur, 'fade', 'none', 0.6));
      return { background: bg, layers: L };
    },
  },

  // 7 ── Corporate tech ─────────────────────────────────────────────────────
  {
    id: 'mg-corporate-tech', name: 'Enterprise Story', style: 'Corporate technology', category: 'Presentation',
    tags: ['corporate', 'b2b', 'clean', 'charts', 'saas'], aspects: ['16:9'], duration: 30,
    colorways: [['#0a1a33', '#3b82f6', '#22d3ee', '#f8fafc'], ['#0b1f1a', '#10b981', '#a3e635', '#f8fafc'], ['#1a102e', '#8b5cf6', '#f087d6', '#f8fafc']],
    fonts: ['Inter', 'Sora', 'Manrope'],
    render: ({ w, h, c, font, dur }) => {
      const f = typeScale({ w, h });
      const [bg, blue, cyan, ink] = c;
      const L: Layer[] = [];
      L.push(SH('rect', [0, 0, w, h], { fill: bg, endTime: dur }));
      L.push(drift(SH('ellipse', [w * 0.55, -h * 0.2, h * 0.9, h * 0.9], { fill: alpha(blue, 0.22), blendMode: 'screen', endTime: dur, effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 90 }] }), 0, dur, -w * 0.05, h * 0.06));
      L.push(scene(TX('PRISM', [w * 0.07, h * 0.07, w * 0.2, 24 * f], { fontFamily: font, fontSize: 16 * f, fontWeight: 700, letterSpacing: 4 * f, color: ink }, { endTime: dur }), 0.2, dur, 'down', 'none', 0.5));
      L.push(scene(TX('ENTERPRISE', [w * 0.07, h * 0.095, w * 0.2, 18 * f], { fontFamily: MONO, fontSize: 8.5 * f, letterSpacing: 3 * f, color: alpha(ink, 0.55) }, { endTime: dur }), 0.35, dur, 'fade', 'none', 0.5));
      L.push(scene(TX('Operational clarity,\nat every scale', [w * 0.07, h * 0.22, w * 0.55, h * 0.24], { fontFamily: font, fontSize: h * 0.082, fontWeight: 600, lineHeight: 1.03, letterSpacing: -h * 0.003, color: ink, animator: { type: 'slideUp', duration: 1, stagger: 0.08, delay: 0 } }, { endTime: dur }), 0.5, dur - 1, 'up', 'none', 0.8));
      L.push(scene(TX('One platform to design, animate and ship every customer touchpoint.', [w * 0.07, h * 0.48, w * 0.44, h * 0.08], { fontFamily: font, fontSize: 15 * f, lineHeight: 1.6, color: alpha(ink, 0.7) }, { endTime: dur }), 1.1, dur - 1, 'left', 'none', 0.7));
      [['+248%', 'throughput'], ['12.4k', 'assets shipped'], ['99.98%', 'uptime'], ['< 40ms', 'render']].forEach(([v, k], i) => {
        const cw = w * 0.19, ch = h * 0.19, x = w * 0.07 + i * (cw + w * 0.015), y = h * 0.65;
        L.push(scene(SH('roundedRect', [x, y, cw, ch], { fill: alpha('#ffffff', 0.055), stroke: alpha('#ffffff', 0.12), strokeWidth: 1, radius: 12 * f, endTime: dur }), 1.4 + i * 0.16, dur - 0.8, 'up', 'fade', 0.6));
        L.push(scene(TX(v, [x + 16 * f, y + 22 * f, cw - 32 * f, 36 * f], { fontFamily: font, fontSize: 26 * f, fontWeight: 600, color: i % 2 ? cyan : '#fff' }, { endTime: dur }), 1.6 + i * 0.16, dur - 0.8, 'fade', 'fade', 0.5));
        L.push(scene(TX(k, [x + 16 * f, y + ch - 34 * f, cw - 32 * f, 20 * f], { fontFamily: font, fontSize: 11 * f, color: alpha(ink, 0.55) }, { endTime: dur }), 1.7 + i * 0.16, dur - 0.8, 'fade', 'fade', 0.5));
      });
      const dx = w * 0.58, dy = h * 0.2, dw = w * 0.35, dh = h * 0.52;
      L.push(scene(SH('roundedRect', [dx, dy, dw, dh], { fill: alpha('#050b18', 0.72), stroke: alpha('#ffffff', 0.13), strokeWidth: 1, radius: 16 * f, endTime: dur }), 0.8, dur, 'scale', 'fade', 0.8));
      for (let i = 0; i < 7; i++) {
        const bh = (dh * 0.5) * (0.22 + ((i * 37) % 70) / 100);
        L.push(scene(SH('roundedRect', [dx + 26 * f + i * (dw - 52 * f) / 7, dy + dh * 0.72 - bh, (dw - 66 * f) / 7, bh], { fillGradient: gradient([blue, cyan], 90), fill: 'transparent', radius: 5 * f, endTime: dur }), 1.1 + i * 0.09, dur, 'up', 'fade', 0.6));
      }
      const line = SH('rect', [dx + 26 * f, dy + dh * 0.36, dw - 52 * f, 2 * f], { fill: alpha(cyan, 0.7), endTime: dur });
      L.push({ ...line, keyframes: { w: [kf(1.4, 0), kf(3.2, dw - 52 * f, EASE)] } });
      L.push(scene(TX('LIVE PIPELINE', [dx + 26 * f, dy + 20 * f, dw * 0.5, 18 * f], { fontFamily: MONO, fontSize: 8.5 * f, letterSpacing: 2 * f, color: alpha(cyan, 0.9) }, { endTime: dur }), 1, dur, 'fade', 'fade', 0.5));
      L.push(scene(TX('4.8M', [dx + 26 * f, dy + 48 * f, dw * 0.4, 34 * f], { fontFamily: font, fontSize: 30 * f, fontWeight: 600, color: '#fff' }, { endTime: dur }), 1.1, dur, 'up', 'fade', 0.5));
      L.push(scene(SH('rect', [0, h * 0.93, w, 2 * f], { fill: alpha(cyan, 0.3), endTime: dur }), 0.3, dur, 'none', 'fade', 0.4));
      L.push(scene(TX('prism.studio/enterprise', [w * 0.07, h * 0.95, w * 0.4, 18 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 2 * f, color: alpha(ink, 0.5) }, { endTime: dur }), 2.2, dur, 'fade', 'none', 0.5));
      L.push(scene(TX('BOOK A WALKTHROUGH', [w * 0.7, h * 0.95, w * 0.23, 18 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 2 * f, color: cyan, align: 'right' }, { endTime: dur }), 2.3, dur, 'fade', 'none', 0.5));
      return { background: bg, layers: L };
    },
  },
];
