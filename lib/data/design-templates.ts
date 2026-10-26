import type { Layer, TemplateDef } from '@/lib/engine/types';
import { gradient } from '@/lib/engine/factory';
import { uid } from '@/lib/utils';
import { MONO, SH, TX, alpha, mix, typeScale } from './motion/shared';

// ─────────────────────────────────────────────────────────────────────────────
//  Static graphic-design templates across the formats teams actually ship:
//  social posts, posters, story covers, deck covers, thumbnails, menus,
//  business cards, invitations and product banners.
// ─────────────────────────────────────────────────────────────────────────────

interface DesignCtx { w: number; h: number; c: string[]; font: string }
interface DesignFamily {
  id: string; name: string; category: TemplateDef['category']; tags: string[];
  duration: number; colorways: string[][]; fonts: string[]; aspects: ('16:9' | '1:1' | '9:16' | '4:5')[];
  render: (x: DesignCtx) => { layers: Layer[]; background: string; backgroundGradient?: ReturnType<typeof gradient> | null };
}

const DIMS: Record<string, [number, number]> = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };

const FAMILIES: DesignFamily[] = [
  {
    id: 'dt-promo-slab', name: 'Promo Slab', category: 'Ad', tags: ['promo', 'sale', 'bold', 'gradient'],
    duration: 6, colorways: [['#0a0a0f', '#8b5cf6', '#22d3ee', '#f5f3ff'], ['#12060f', '#e879f9', '#fb923c', '#fff7ed'], ['#05110d', '#10b981', '#a3e635', '#f0fdf4']],
    fonts: ['Sora', 'Space Grotesk', 'Archivo'], aspects: ['1:1', '4:5', '16:9'],
    render: ({ w, h, c, font }) => {
      const f = typeScale({ w, h });
      const [bg, a, b, ink] = c;
      return {
        background: bg, backgroundGradient: gradient([bg, mix(a, bg, 0.45), bg], 140),
        layers: [
          SH('ellipse', [w * 0.5, -h * 0.2, h * 0.9, h * 0.9], { fill: a, opacity: 0.55, blendMode: 'screen', effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 80 }] }),
          SH('roundedRect', [w * 0.06, h * 0.08, w * 0.88, h * 0.84], { fill: alpha('#ffffff', 0.03), stroke: alpha('#ffffff', 0.12), strokeWidth: 1, radius: 22 * f }),
          TX('LIMITED RELEASE', [w * 0.1, h * 0.12, w * 0.5, 22 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 4 * f, color: alpha(ink, 0.65) }),
          TX('MAKE\nSOME\nNOISE', [w * 0.09, h * 0.2, w * 0.72, h * 0.42], { fontFamily: font, fontSize: h * 0.14, fontWeight: 800, lineHeight: 0.9, letterSpacing: -h * 0.006, color: ink, uppercase: true }),
          SH('rect', [w * 0.1, h * 0.64, w * 0.18, 5 * f], { fill: b, radius: 3 }),
          TX('New season drop — built for the feed,\nshipped in every format.', [w * 0.1, h * 0.69, w * 0.5, h * 0.12], { fontFamily: font, fontSize: 16 * f, lineHeight: 1.5, color: alpha(ink, 0.68) }),
          SH('roundedRect', [w * 0.1, h * 0.835, w * 0.24, 34 * f], { fill: b, radius: 17 * f }),
          TX('SHOP NOW', [w * 0.1, h * 0.84, w * 0.24, 28 * f], { fontFamily: font, fontSize: 13 * f, fontWeight: 600, color: bg }, { fill: b, radius: 6 * f }),
          SH('burst', [w * 0.66, h * 0.58, h * 0.2, h * 0.2], { fill: b, points: 20, innerRadius: 0.64 }),
          TX('-30%', [w * 0.66, h * 0.645, h * 0.2, h * 0.05], { fontFamily: font, fontSize: 20 * f, fontWeight: 700, color: bg, align: 'center' }),
        ],
      };
    },
  },
  {
    id: 'dt-editorial-quote', name: 'Editorial Quote', category: 'Social', tags: ['quote', 'editorial', 'serif', 'minimal'],
    duration: 6, colorways: [['#f7f4ee', '#111111', '#c2410c', '#8d8577'], ['#0e1116', '#eceff3', '#22d3ee', '#8a94a0'], ['#f4f1f8', '#221a2e', '#7c3aed', '#8b82a0']],
    fonts: ['Playfair Display', 'Fraunces', 'Cormorant Garamond'], aspects: ['1:1', '4:5', '9:16'],
    render: ({ w, h, c, font }) => {
      const f = typeScale({ w, h });
      const [bg, ink, accent, muted] = c;
      return {
        background: bg,
        layers: [
          SH('rect', [w * 0.07, h * 0.07, 1.5 * f, h * 0.86], { fill: accent, opacity: 0.7 }),
          TX('“', [w * 0.1, h * 0.14, w * 0.3, h * 0.16], { fontFamily: font, fontSize: h * 0.2, color: accent, lineHeight: 1 }),
          TX('Good design is\nobvious. Great\ndesign is invisible.', [w * 0.12, h * 0.32, w * 0.76, h * 0.32], { fontFamily: font, fontSize: h * 0.085, fontWeight: 400, lineHeight: 1.12, letterSpacing: -0.6 * f, color: ink }),
          SH('rect', [w * 0.12, h * 0.69, w * 0.14, 1.5 * f], { fill: alpha(ink, 0.35) }),
          TX('MAISON STUDIO', [w * 0.12, h * 0.73, w * 0.5, 26 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 3 * f, color: muted }),
          TX('FIELD NOTES / 12', [w * 0.12, h * 0.89, w * 0.5, 22 * f], { fontFamily: MONO, fontSize: 8 * f, letterSpacing: 2 * f, color: alpha(muted, 0.8) }),
        ],
      };
    },
  },
  {
    id: 'dt-product-spotlight', name: 'Product Spotlight', category: 'Ad', tags: ['product', 'ecommerce', 'clean', 'card'],
    duration: 6, colorways: [['#0b0b10', '#a78bfa', '#22d3ee', '#f8fafc'], ['#f4f4f2', '#111111', '#ff5a36', '#6b7280'], ['#0d1114', '#5eead4', '#fbbf24', '#f1f5f9']],
    fonts: ['Outfit', 'DM Sans', 'Manrope'], aspects: ['1:1', '4:5', '16:9'],
    render: ({ w, h, c, font }) => {
      const f = typeScale({ w, h });
      const [bg, accent, second, ink] = c;
      return {
        background: bg, backgroundGradient: gradient([mix(bg, accent, 0.16), bg, bg], 150),
        layers: [
          SH('roundedRect', [w * 0.08, h * 0.12, w * 0.84, h * 0.5], { fillGradient: gradient([accent, second], 135), fill: 'transparent', radius: 18 * f }),
          SH('ellipse', [w * 0.36, h * 0.19, h * 0.36, h * 0.36], { fill: alpha('#ffffff', 0.22), effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 20 }] }),
          SH('roundedRect', [w * 0.3, h * 0.3, w * 0.4, h * 0.18], { fill: alpha('#0b0b10', 0.75), stroke: alpha('#ffffff', 0.2), strokeWidth: 1, radius: 16 * f }),
          TX('PRISM ONE', [w * 0.3, h * 0.35, w * 0.4, 28 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 4 * f, color: ink, align: 'center' }),
          TX('New drop', [w * 0.1, h * 0.66, w * 0.6, 22 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 3 * f, color: alpha(ink, 0.5), uppercase: true }),
          TX('Studio Headphones', [w * 0.1, h * 0.7, w * 0.8, h * 0.09], { fontFamily: font, fontSize: h * 0.058, fontWeight: 700, letterSpacing: -1.4 * f, color: ink }),
          TX('Precision drivers. Forty hours of quiet.', [w * 0.1, h * 0.8, w * 0.62, 40 * f], { fontFamily: font, fontSize: 14 * f, color: alpha(ink, 0.6) }),
          TX('$249', [w * 0.1, h * 0.88, w * 0.3, h * 0.06], { fontFamily: font, fontSize: 26 * f, fontWeight: 600, color: accent }),
          SH('roundedRect', [w * 0.6, h * 0.858, w * 0.3, 34 * f], { fill: accent, radius: 17 * f }),
          TX('ADD TO BAG', [w * 0.6, h * 0.865, w * 0.3, 34 * f], { fontFamily: font, fontSize: 12 * f, fontWeight: 600, color: bg, align: 'center' }, { fill: accent, radius: 17 * f }),
        ],
      };
    },
  },
  {
    id: 'dt-event-poster', name: 'Event Poster', category: 'Poster', tags: ['event', 'poster', 'date', 'bold'],
    duration: 6, colorways: [['#0c0a1f', '#e879f9', '#22d3ee', '#f8fafc'], ['#1a0f06', '#fbbf24', '#fb7185', '#fff7ed'], ['#061318', '#38bdf8', '#a3e635', '#f0f9ff']],
    fonts: ['Archivo Black', 'Anton', 'Bebas Neue'], aspects: ['4:5', '9:16', '16:9'],
    render: ({ w, h, c, font }) => {
      const f = typeScale({ w, h });
      const [bg, a, b, ink] = c;
      return {
        background: bg, backgroundGradient: gradient([bg, mix(a, bg, 0.35), bg], 160),
        layers: [
          SH('ring', [w * 0.45, -h * 0.12, h * 0.72, h * 0.72], { fill: 'transparent', stroke: alpha(b, 0.4), strokeWidth: 2 * f, innerRadius: 0.82 }),
          SH('ring', [w * 0.3, h * 0.02, h * 0.4, h * 0.4], { fill: 'transparent', stroke: alpha(a, 0.5), strokeWidth: 1.5 * f, innerRadius: 0.86 }),
          TX('PRISM PRESENTS', [w * 0.08, h * 0.08, w * 0.5, 22 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 4 * f, color: alpha(ink, 0.6) }),
          TX('NIGHT\nSHIFT', [w * 0.07, h * 0.16, w * 0.84, h * 0.3], { fontFamily: font, fontSize: h * 0.16, fontWeight: 700, lineHeight: 0.88, letterSpacing: -h * 0.004, color: ink, uppercase: true }),
          TX('14 NOV / 22:00', [w * 0.08, h * 0.52, w * 0.5, 30 * f], { fontFamily: MONO, fontSize: 12 * f, letterSpacing: 3 * f, color: a }),
          SH('rect', [w * 0.08, h * 0.58, w * 0.84, 1 * f], { fill: alpha(ink, 0.2) }),
          TX('DOCKSIDE WAREHOUSE\nADDIS ABABA · 18+', [w * 0.08, h * 0.61, w * 0.5, h * 0.1], { fontFamily: font, fontSize: 14 * f, lineHeight: 1.6, color: alpha(ink, 0.7) }),
          TX('AURORA DRIFT · NEON PULSE · QUIET ENGINE', [w * 0.08, h * 0.76, w * 0.84, 24 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 2 * f, color: alpha(ink, 0.5) }),
          SH('burst', [w * 0.66, h * 0.84, h * 0.12, h * 0.12], { fill: b, points: 18, innerRadius: 0.6 }),
          TX('TICKETS', [w * 0.66, h * 0.883, h * 0.12, 20 * f], { fontFamily: MONO, fontSize: 7 * f, letterSpacing: 1 * f, color: bg, align: 'center' }),
        ],
      };
    },
  },
  {
    id: 'dt-deck-cover', name: 'Deck Cover', category: 'Presentation', tags: ['deck', 'cover', 'corporate', 'minimal'],
    duration: 6, colorways: [['#0a1220', '#3b82f6', '#22d3ee', '#f8fafc'], ['#f6f5f2', '#111111', '#e8442c', '#5f5b53'], ['#151021', '#a78bfa', '#e879f9', '#f5f3ff']],
    fonts: ['Inter', 'Sora', 'Manrope'], aspects: ['16:9', '4:5'],
    render: ({ w, h, c, font }) => {
      const f = typeScale({ w, h });
      const [bg, a, b, ink] = c;
      return {
        background: bg, backgroundGradient: gradient([mix(bg, a, 0.22), bg, mix(bg, '#000000', 0.35)], 150),
        layers: [
          SH('rect', [w * 0.07, h * 0.09, w * 0.02, h * 0.82], { fill: 'transparent', fillGradient: gradient([a, b], 90), radius: 4 }),
          TX('PRISM / STRATEGY', [w * 0.12, h * 0.1, w * 0.4, 22 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 3 * f, color: alpha(ink, 0.5) }),
          TX('Design systems\nfor scale', [w * 0.12, h * 0.3, w * 0.66, h * 0.26], { fontFamily: font, fontSize: h * 0.11, fontWeight: 600, lineHeight: 1.02, letterSpacing: -h * 0.004, color: ink }),
          TX('Prepared for the product & brand council', [w * 0.12, h * 0.61, w * 0.5, 34 * f], { fontFamily: font, fontSize: 15 * f, color: alpha(ink, 0.6) }),
          SH('rect', [w * 0.12, h * 0.72, w * 0.2, 2 * f], { fill: alpha(b, 0.8) }),
          TX('Q4 · 2026', [w * 0.12, h * 0.76, w * 0.3, 24 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 2 * f, color: a }),
          ...Array.from({ length: 14 }, (_, i) => SH('rect', [w * (0.66 + (i % 5) * 0.06), h * (0.2 + Math.floor(i / 5) * 0.06), 0.06 * w, 0.06 * w * (w / h) * 0.12], { fill: alpha(b, 0.12 + (i % 3) * 0.05), radius: 3 })),
        ],
      };
    },
  },
  {
    id: 'dt-thumbnail', name: 'Thumbnail Punch', category: 'YouTube', tags: ['youtube', 'thumbnail', 'click', 'bold'],
    duration: 6, colorways: [['#0a0a0f', '#facc15', '#f43f5e', '#ffffff'], ['#04121a', '#22d3ee', '#a3e635', '#ffffff'], ['#150610', '#f472b6', '#fbbf24', '#ffffff']],
    fonts: ['Anton', 'Bebas Neue', 'Archivo Black'], aspects: ['16:9'],
    render: ({ w, h, c, font }) => {
      const f = typeScale({ w, h });
      const [bg, a, b, ink] = c;
      return {
        background: bg, backgroundGradient: gradient([mix(bg, a, 0.2), bg, bg], 120),
        layers: [
          SH('ellipse', [w * 0.62, h * 0.05, h * 0.9, h * 0.9], { fill: alpha(a, 0.3), effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 70 }] }),
          TX('I BUILT AN\nAI EDITOR', [w * 0.05, h * 0.12, w * 0.62, h * 0.5], { fontFamily: font, fontSize: h * 0.17, fontWeight: 700, lineHeight: 0.9, letterSpacing: -2 * f, color: ink, uppercase: true, strokeWidth: 2 }),
          TX('AND IT ACTUALLY WORKS', [w * 0.05, h * 0.7, w * 0.5, 30 * f], { fontFamily: MONO, fontSize: 12 * f, letterSpacing: 3 * f, color: a }),
          TX('EP. 24', [w * 0.05, h * 0.84, w * 0.2, 24 * f], { fontFamily: MONO, fontSize: 10 * f, letterSpacing: 2 * f, color: alpha(ink, 0.5) }),
          SH('roundedRect', [w * 0.66, h * 0.26, w * 0.26, h * 0.48], { fill: alpha(b, 0.9), radius: 20 * f, stroke: ink, strokeWidth: 3 }),
          SH('ellipse', [w * 0.735, h * 0.36, w * 0.11, w * 0.11], { fill: alpha('#000000', 0.18) }),
          SH('roundedRect', [w * 0.66, h * 0.775, w * 0.26, 34 * f], { fill: a, radius: 17 * f }),
          TX('WATCH', [w * 0.66, h * 0.78, w * 0.26, 34 * f], { fontFamily: font, fontSize: 14 * f, color: bg, align: 'center' }, { fill: a, radius: 17 * f }),
        ],
      };
    },
  },
  {
    id: 'dt-sale-banner', name: 'Flash Sale', category: 'Ad', tags: ['sale', 'banner', 'discount', 'retail'],
    duration: 6, colorways: [['#12060a', '#ef4444', '#fbbf24', '#fff7ed'], ['#0a0a0a', '#22d3ee', '#f0abfc', '#f8fafc'], ['#0d1a0a', '#84cc16', '#facc15', '#f7fee7']],
    fonts: ['Archivo Black', 'Teko', 'Oswald'], aspects: ['16:9', '1:1'],
    render: ({ w, h, c, font }) => {
      const f = typeScale({ w, h });
      const [bg, hot, gold, ink] = c;
      return {
        background: bg, backgroundGradient: gradient([hot, mix(hot, '#000000', 0.5), bg], 135),
        layers: [
          SH('rect', [0, 0, w, h * 0.12], { fill: alpha('#000000', 0.25) }),
          TX('FLASH SALE — 48 HOURS ONLY', [w * 0.04, h * 0.032, w * 0.8, 26 * f], { fontFamily: MONO, fontSize: 11 * f, letterSpacing: 3 * f, color: ink }),
          TX('70%', [w * 0.04, h * 0.18, w * 0.5, h * 0.5], { fontFamily: font, fontSize: h * 0.32, fontWeight: 700, letterSpacing: -h * 0.012, color: ink }),
          TX('OFF', [w * 0.05, h * 0.66, w * 0.3, h * 0.12], { fontFamily: font, fontSize: h * 0.09, fontWeight: 600, letterSpacing: h * 0.02, color: gold }),
          TX('Everything must go.\nOnline + all stores.', [w * 0.05, h * 0.8, w * 0.5, h * 0.1], { fontFamily: MONO, fontSize: 12 * f, lineHeight: 1.6, letterSpacing: 1 * f, color: alpha(ink, 0.8) }),
          SH('roundedRect', [w * 0.62, h * 0.3, w * 0.32, h * 0.4], { fill: alpha('#000000', 0.28), stroke: alpha(ink, 0.35), strokeWidth: 1.5, radius: 18 * f }),
          TX('USE CODE', [w * 0.62, h * 0.36, w * 0.32, 20 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 3 * f, color: alpha(ink, 0.6), align: 'center' }),
          TX('PRISM70', [w * 0.62, h * 0.43, w * 0.32, h * 0.1], { fontFamily: font, fontSize: h * 0.09, fontWeight: 700, color: gold, align: 'center' }),
          TX('ENDS SUNDAY 23:59', [w * 0.62, h * 0.58, w * 0.32, 22 * f], { fontFamily: MONO, fontSize: 8 * f, letterSpacing: 2 * f, color: alpha(ink, 0.7), align: 'center' }),
          SH('burst', [w * 0.9, h * 0.06, w * 0.14, w * 0.14], { fill: gold, points: 18, innerRadius: 0.6, opacity: 0.9 }),
        ],
      };
    },
  },
  {
    id: 'dt-menu', name: 'Menu Card', category: 'Poster', tags: ['menu', 'restaurant', 'elegant', 'typographic'],
    duration: 6, colorways: [['#12100d', '#e8dcc4', '#c9a35f', '#9c9384'], ['#f6f1e6', '#1d1a15', '#a8552e', '#7a7163'], ['#0d1412', '#e7ece5', '#8ba888', '#8a948c']],
    fonts: ['Cormorant Garamond', 'Playfair Display', 'Fraunces'], aspects: ['4:5', '9:16'],
    render: ({ w, h, c, font }) => {
      const f = typeScale({ w, h });
      const [bg, ink, gold, muted] = c;
      const items = [['Sourdough & cultured butter', '120'], ['Charred leek, hazelnut, aged cheese', '260'], ['Hand-cut pappardelle, oxtail ragù', '420'], ['Market fish, saffron, fennel', '480'], ['Dark chocolate, sea salt, olive oil', '220']];
      return {
        background: bg,
        layers: [
          SH('rect', [w * 0.07, h * 0.05, w * 0.86, h * 0.9], { fill: 'transparent', stroke: alpha(ink, 0.2), strokeWidth: 1 }),
          TX('MAISON — KITCHEN', [0, h * 0.09, w, 22 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 5 * f, color: alpha(muted, 0.9), align: 'center' }),
          TX('Dinner', [0, h * 0.13, w, h * 0.1], { fontFamily: font, fontSize: h * 0.08, color: ink, align: 'center' }),
          SH('rect', [w * 0.44, h * 0.25, w * 0.12, 1 * f], { fill: alpha(gold, 0.7) }),
          ...items.flatMap(([name, price], i) => {
            const y = h * (0.3 + i * 0.1);
            return [
              TX(name, [w * 0.11, y, w * 0.62, 26 * f], { fontFamily: font, fontSize: 13 * f, color: ink }),
              TX(price, [w * 0.76, y, w * 0.12, 26 * f], { fontFamily: MONO, fontSize: 10 * f, color: gold, align: 'right' }),
              SH('rect', [w * 0.11, y + 26 * f, w * 0.78, 0.6 * f], { fill: alpha(ink, 0.12) }),
            ];
          }),
          TX('SERVICE INCLUDED · ALLERGENS ON REQUEST', [0, h * 0.89, w, 18 * f], { fontFamily: MONO, fontSize: 7.5 * f, letterSpacing: 2 * f, color: alpha(muted, 0.8), align: 'center' }),
        ],
      };
    },
  },
  {
    id: 'dt-invitation', name: 'Invitation', category: 'Story', tags: ['invitation', 'wedding', 'elegant', 'serif'],
    duration: 6, colorways: [['#f5efe4', '#26221b', '#a5814a', '#8d8474'], ['#0e1412', '#eef2ee', '#b8a06a', '#8c948d'], ['#f4eef2', '#2a1f28', '#b06a86', '#92848d']],
    fonts: ['Cormorant Garamond', 'Great Vibes', 'Playfair Display'], aspects: ['9:16', '4:5'],
    render: ({ w, h, c, font }) => {
      const f = typeScale({ w, h });
      const [bg, ink, gold, muted] = c;
      return {
        background: bg,
        layers: [
          SH('rect', [w * 0.08, h * 0.06, w * 0.84, h * 0.88], { fill: 'transparent', stroke: alpha(gold, 0.55), strokeWidth: 1 }),
          SH('ring', [w * 0.36, h * 0.13, w * 0.28, w * 0.28], { fill: 'transparent', stroke: alpha(gold, 0.45), strokeWidth: 1, innerRadius: 0.94 }),
          TX('TOGETHER WITH THEIR FAMILIES', [0, h * 0.2, w, 20 * f], { fontFamily: MONO, fontSize: 8 * f, letterSpacing: 4 * f, color: alpha(muted, 0.9), align: 'center' }),
          TX('Sara\n& Dawit', [0, h * 0.28, w, h * 0.2], { fontFamily: 'Great Vibes', fontSize: h * 0.11, lineHeight: 1.1, color: ink, align: 'center' }),
          SH('rect', [w * 0.44, h * 0.52, w * 0.12, 1 * f], { fill: alpha(gold, 0.6) }),
          TX('INVITE YOU TO CELEBRATE', [0, h * 0.55, w, 20 * f], { fontFamily: MONO, fontSize: 8 * f, letterSpacing: 4 * f, color: alpha(muted, 0.9), align: 'center' }),
          TX('Saturday, the fourteenth of November\nTwo thousand and twenty-six · four o’clock', [0, h * 0.61, w, h * 0.1], { fontFamily: font, fontSize: 13 * f, lineHeight: 1.8, color: ink, align: 'center' }),
          TX('THE GARDEN HOUSE · ADDIS ABABA', [0, h * 0.8, w, 20 * f], { fontFamily: MONO, fontSize: 8 * f, letterSpacing: 3 * f, color: gold, align: 'center' }),
          TX('RSVP BY 01 OCTOBER', [0, h * 0.87, w, 18 * f], { fontFamily: MONO, fontSize: 7.5 * f, letterSpacing: 2 * f, color: alpha(muted, 0.8), align: 'center' }),
        ],
      };
    },
  },
  {
    id: 'dt-podcast', name: 'Podcast Cover', category: 'Social', tags: ['podcast', 'cover', 'audio', 'bold'],
    duration: 6, colorways: [['#0b0b12', '#8b5cf6', '#22d3ee', '#f8fafc'], ['#101010', '#f97316', '#fde047', '#fafafa'], ['#0a1214', '#2dd4bf', '#f472b6', '#f0fdfa']],
    fonts: ['Space Grotesk', 'Sora', 'Archivo'], aspects: ['1:1', '4:5'],
    render: ({ w, h, c, font }) => {
      const f = typeScale({ w, h });
      const [bg, a, b, ink] = c;
      return {
        background: bg, backgroundGradient: gradient([mix(bg, a, 0.35), bg, mix(bg, b, 0.12)], 140),
        layers: [
          SH('ring', [w * 0.12, h * 0.12, w * 0.76, w * 0.76], { fill: 'transparent', stroke: alpha(ink, 0.12), strokeWidth: 1.5 * f, innerRadius: 0.92 }),
          SH('ring', [w * 0.2, h * 0.2, w * 0.6, w * 0.6], { fill: 'transparent', stroke: alpha(ink, 0.1), strokeWidth: 1.5 * f, innerRadius: 0.9 }),
          TX('EP. 42', [w * 0.12, h * 0.16, w * 0.3, 24 * f], { fontFamily: MONO, fontSize: 9 * f, letterSpacing: 3 * f, color: alpha(ink, 0.55) }),
          TX('THE\nPRISM\nSHOW', [w * 0.1, h * 0.28, w * 0.8, h * 0.34], { fontFamily: font, fontSize: h * 0.13, fontWeight: 700, lineHeight: 0.92, letterSpacing: -2 * f, color: ink }),
          SH('rect', [w * 0.1, h * 0.68, w * 0.16, 5 * f], { fill: b, radius: 3 }),
          TX('Design, motion & machines.\nNew episode every Thursday.', [w * 0.1, h * 0.72, w * 0.6, h * 0.1], { fontFamily: font, fontSize: 13 * f, lineHeight: 1.6, color: alpha(ink, 0.65) }),
          SH('ellipse', [w * 0.72, h * 0.72, w * 0.14, w * 0.14], { fill: a, effects: [{ id: uid('fx'), type: 'glow', enabled: true, amount: 50, color: a }] }),
        ],
      };
    },
  },
];

let cache: TemplateDef[] | null = null;

export function getDesignTemplates(): TemplateDef[] {
  if (cache) return cache;
  const out: TemplateDef[] = [];
  FAMILIES.forEach((fam, fi) => {
    fam.colorways.forEach((colors, ci) => {
      fam.aspects.forEach((aspect) => {
        const [w, h] = DIMS[aspect];
        const font = fam.fonts[ci % fam.fonts.length];
        out.push({
          id: `${fam.id}--${ci}--${aspect.replace(':', 'x')}`,
          name: ci ? `${fam.name} ${ci + 1}` : fam.name,
          category: fam.category,
          tags: [...fam.tags, 'design', aspect, `${familiesIndex(fi)}`],
          aspect,
          duration: fam.duration,
          palette: colors,
          font,
          pro: ci > 0,
          render: () => {
            const res = fam.render({ w, h, c: colors, font });
            const layers = res.layers.map((l) => ({
              ...l,
              startTime: Math.max(0, Math.min(l.startTime, fam.duration - 0.1)),
              endTime: Math.max(0.1, Math.min(l.endTime, fam.duration)),
            }));
            return { layers, width: w, height: h, background: res.background, backgroundGradient: res.backgroundGradient ?? null };
          },
        });
      });
    });
  });
  cache = out;
  return out;
}

function familiesIndex(i: number) { return `family-${i + 1}`; }
export const DESIGN_FAMILY_COUNT = FAMILIES.length;
