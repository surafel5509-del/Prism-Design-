import type { Aspect, Gradient, Keyframe, Layer, Project, ShapeKind, TemplateDef } from '@/lib/engine/types';
import { createLayer, createShape, createText, gradient, PALETTES, seededRandom } from '@/lib/engine/factory';
import { getTemplates } from '@/lib/data/templates';
import { makeBackdrop } from '@/lib/data/library';
import { uid } from '@/lib/utils';
import { resolveLayer } from '@/lib/engine/animation';

// ── Palette & typography selection ──────────────────────────────────────────
const PALETTE_HINTS: { re: RegExp; name: string }[] = [
  { re: /neon|cyber|futur|tech|electric|gaming/i, name: 'Cyber Lime' },
  { re: /luxur|elegant|editorial|fashion|serif|magazine/i, name: 'Editorial' },
  { re: /sunset|warm|gold|amber|autumn|desert/i, name: 'Golden Hour' },
  { re: /ocean|calm|blue|aqua|medical|fintech|corporate/i, name: 'Ocean Depth' },
  { re: /candy|pink|playful|fun|kids|sweet|gen z/i, name: 'Neo Candy' },
  { re: /minimal|mono|black|white|swiss|architect/i, name: 'Mono Graphite' },
  { re: /green|eco|nature|sustain|forest/i, name: 'Forest Signal' },
  { re: /violet|purple|prism|gradient|cosmic|space/i, name: 'Prism' },
  { re: /rose|blush|romantic|beauty|skincare/i, name: 'Rose Quartz' },
];

export function pickPalette(brief: string, fallback = 'Prism'): string[] {
  const hex = brief.match(/#[0-9a-f]{6}\b/gi);
  if (hex && hex.length >= 2) {
    const base = hex.slice(0, 3);
    return [...base, '#0b0b12', '#f8f8ff'].map((c, i) => base[i] ?? c);
  }
  const hit = PALETTE_HINTS.find((h) => h.re.test(brief));
  const name = hit?.name ?? fallback;
  return (PALETTES.find((p) => p.name === name) ?? PALETTES[0]).colors;
}

const DISPLAY_FONTS = ['Sora', 'Space Grotesk', 'Syne', 'Unbounded', 'Bricolage', 'Archivo Black', 'Bebas Neue', 'Anton', 'Fraunces'];
export function pickFont(brief: string): string {
  if (/serif|editorial|luxury|elegant|magazine/i.test(brief)) return 'Playfair Display';
  if (/tech|futur|cyber|neon/i.test(brief)) return 'Unbounded';
  if (/bold|impact|sport|poster/i.test(brief)) return 'Anton';
  if (/minimal|swiss|clean/i.test(brief)) return 'Space Grotesk';
  if (/friendly|playful|app/i.test(brief)) return 'Outfit';
  const rnd = seededRandom(brief || 'prism');
  return DISPLAY_FONTS[Math.floor(rnd() * DISPLAY_FONTS.length)] ?? 'Sora';
}

export interface Copy { kicker: string; headline: string; subhead: string; cta: string }

export function copyFromBrief(brief: string, kind: string): Copy {
  const quoted = brief.match(/["“']([^"”']{4,80})["”']/);
  const words = brief.replace(/[^\w\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !/^(design|poster|create|make|for|with|that|this|and|the|from|instagram|tiktok|youtube|video|motion|social|template|need|want|please)$/i.test(w));
  const pick = words.slice(0, 3).map((w) => w[0].toUpperCase() + w.slice(1));
  const headline = quoted?.[1] ?? (pick.length >= 2 ? `${pick[0]}\n${pick.slice(1).join(' ')}` : 'Make it\nmatter');
  const ctaMap: Record<string, string> = {
    poster: 'GET TICKETS', social: 'LEARN MORE', banner: 'SHOP NOW', logo: 'PRISM', motion: 'WATCH NOW',
    intro: 'SUBSCRIBE', story: 'SWIPE UP', thumbnail: 'FULL VIDEO', ad: 'BOOK A CALL', presentation: 'VIEW DECK',
  };
  const kickerSource = brief.replace(/\s+/g, ' ').slice(0, 64);
  return {
    kicker: /[A-Z]{2,}/.test(brief) ? (brief.match(/[A-Z]{2,}(?:\s+[A-Z]{2,})?/)?.[1] ?? 'PRISM STUDIO') : 'PRISM STUDIO — 2026',
    headline: headline.toUpperCase(),
    subhead: brief.replace(/^(create|make|design|generate|build)\s+(a|an|the)?\s*/i, '').replace(/\s+/g, ' ').slice(0, 128) || 'Designed in Prism.',
    cta: ctaMap[kind] ?? 'START NOW',
  };
}

// ── Template matching ──────────────────────────────────────────────────────
const KIND_TO_CATEGORIES: Record<string, TemplateDef['category'][]> = {
  poster: ['Poster', 'Presentation', 'Social'],
  social: ['Social', 'Ad', 'Story'],
  banner: ['Ad', 'Poster'],
  logo: ['Logo', 'Motion'],
  motion: ['Motion', 'Logo', 'YouTube'],
  intro: ['Motion', 'Logo', 'YouTube'],
  story: ['Story', 'TikTok'],
  thumbnail: ['YouTube', 'Motion'],
  ad: ['Ad', 'Poster'],
  presentation: ['Presentation'],
  lowerThird: ['Lower Third'],
};

export function findTemplate(kind: string, aspect: Aspect, brief: string, preferredFamily?: string): TemplateDef {
  const all = getTemplates();
  if (preferredFamily) {
    const exact = all.find((t) => t.id.startsWith(preferredFamily) && t.aspect === aspect);
    if (exact) return exact;
  }
  const cats = KIND_TO_CATEGORIES[kind] ?? ['Social', 'Poster', 'Motion'];
  const score = (t: TemplateDef) => {
    let s = 0;
    if (t.aspect === aspect) s += 12;
    const ci = cats.indexOf(t.category);
    if (ci >= 0) s += 8 - ci * 2;
    if (/bold/i.test(brief) && /bold|thumbnail|sale/i.test(t.tags.join(' '))) s += 3;
    if (/serif|editorial/i.test(brief) && t.tags.includes('serif')) s += 4;
    if (/minimal/i.test(brief) && t.tags.includes('minimal')) s += 4;
    if (/gradient|glow/i.test(brief) && t.tags.some((x) => x.includes('gradient') || x.includes('glass'))) s += 3;
    return s;
  };
  return [...all].sort((a, b) => score(b) - score(a))[0] ?? all[0];
}

function remapColor(color: string, from: string[], to: string[]): string {
  const idx = from.findIndex((c) => c.toLowerCase() === color.toLowerCase());
  if (idx >= 0) return to[idx % to.length];
  return color;
}

function retargetText(layers: Layer[], copy: Copy, font: string, palette: string[]): Layer[] {
  const texts = layers.filter((l) => l.type === 'text' && l.text).sort((a, b) => (b.text!.fontSize * (b.text!.content.length > 12 ? 1.15 : 1)) - (a.text!.fontSize * (a.text!.content.length > 12 ? 1.15 : 1)));
  const headlineLayer = texts[0];
  const ctaRe = /(get tickets|shop now|watch now|apply now|learn more|swipe up|subscribe|start|book)/i;
  const ctaLayer = texts.find((t) => ctaRe.test(t.text!.content) && t !== headlineLayer);
  const rest = texts.filter((t) => t !== headlineLayer && t !== ctaLayer);
  const subLayer = rest.sort((a, b) => b.text!.fontSize - a.text!.fontSize)[0];
  const kickerCandidates = rest.filter((t) => t !== subLayer);
  const kickerLayer = kickerCandidates.sort((a, b) => a.text!.fontSize - b.text!.fontSize)[0];

  const assign: [Layer | undefined, string | undefined, number | undefined][] = [
    [headlineLayer, copy.headline, undefined],
    [subLayer, copy.subhead, undefined],
    [kickerLayer, copy.kicker, undefined],
    [ctaLayer, copy.cta, undefined],
  ];
  const map = new Map<string, string>();
  for (const [l, value] of assign) if (l && value) map.set(l.id, value);

  return layers.map((l) => {
    if (l.type !== 'text' || !l.text) return { ...l, fill: remapColor(l.fill, [], palette) };
    const content = map.get(l.id);
    const isHeadline = l.id === headlineLayer?.id;
    const isKicker = l.id === kickerLayer?.id;
    const next = content ? { ...l.text, content } : l.text;
    const widthLimit = l.w;
    if (content && isHeadline) {
      const longest = content.split('\n').sort((a, b) => b.length - a.length)[0] ?? content;
      const approx = longest.length * next.fontSize * 0.54;
      if (approx > widthLimit) next.fontSize = Math.max(24, Math.floor(next.fontSize * (widthLimit / approx)));
      next.fontFamily = font;
    } else if (isKicker) {
      next.fontFamily = 'JetBrains Mono';
    } else if (content) {
      next.fontFamily = 'Inter';
    }
    return { ...l, text: next, fill: remapColor(l.fill, [], palette), fillGradient: l.fillGradient ? recolorGradient(l.fillGradient, palette) : null };
  });
}

function recolorGradient(g: Gradient, palette: string[]): Gradient {
  return { ...g, stops: g.stops.map((s, i) => ({ ...s, color: palette[i % palette.length] ?? s.color })) };
}

export interface DesignResult { layers: Layer[]; width: number; height: number; background: string; backgroundGradient: Gradient | null; template: string }

export function buildDesign(args: {
  brief: string; kind?: string; aspect?: Aspect; palette?: string[]; font?: string; copy?: Partial<Copy>; family?: string;
}): DesignResult {
  const kind = args.kind ?? 'poster';
  const aspect = args.aspect ?? '4:5';
  const palette = args.palette?.length ? args.palette : pickPalette(args.brief);
  const font = args.font ?? pickFont(args.brief);
  const template = findTemplate(kind, aspect, args.brief, args.family);
  const rendered = template.render();
  const copy: Copy = { ...copyFromBrief(args.brief, kind), ...args.copy };
  const layers = retargetText(rendered.layers, copy, font, palette);
  return {
    layers: recolorLayers(layers, template.palette, palette),
    width: rendered.width,
    height: rendered.height,
    background: palette[3] ?? rendered.background,
    backgroundGradient: rendered.backgroundGradient ? recolorGradient(rendered.backgroundGradient, palette) : null,
    template: template.id,
  };
}

function recolorLayers(layers: Layer[], from: string[], to: string[]): Layer[] {
  return layers.map((l) => ({
    ...l,
    fill: remapColor(l.fill, from, to),
    fillGradient: l.fillGradient ? { ...l.fillGradient, stops: l.fillGradient.stops.map((s) => ({ ...s, color: remapColor(s.color, from, to) })) } : null,
    stroke: l.stroke ? remapColor(l.stroke, from, to) : l.stroke,
    effects: l.effects.map((e) => (e.color ? { ...e, color: remapColor(e.color, from, to) } : e)),
    text: l.text ? { ...l.text, color: remapColor(l.text.color, from, to), gradient: l.text.gradient ? recolorGradient(l.text.gradient, to) : null } : l.text,
  }));
}

// ── Motion composition ─────────────────────────────────────────────────────
const kf = (time: number, value: number | [number, number], ease: Keyframe['easing'] = { type: 'easeInOut' }): Keyframe => ({ id: uid('kf'), time: Math.max(0, Math.round(time * 100) / 100), value, easing: ease });

function inOut(start: number, end: number, fade = 0.35) {
  return {
    opacity: [kf(0, 0), kf(start, 0), kf(start + fade, 1, { type: 'easeOut' }), kf(end - fade, 1), kf(end, 0, { type: 'easeIn' })],
    y: [kf(start, 0), kf(start + fade, 0)],
  };
}

export interface MotionResult { layers: Layer[]; duration: number; background: string; backgroundGradient: Gradient | null }

export function buildMotionComposition(args: {
  brief: string; width?: number; height?: number; duration?: number; palette?: string[]; font?: string; copy?: Partial<Copy>;
  scenes?: ('title' | 'features' | 'quote' | 'cta')[];
  imageSrc?: string | null;
}): MotionResult {
  const width = args.width ?? 1920, height = args.height ?? 1080;
  const duration = args.duration ?? 8;
  const palette = args.palette?.length ? args.palette : pickPalette(args.brief);
  const font = args.font ?? pickFont(args.brief);
  const copy: Copy = { ...copyFromBrief(args.brief, 'motion'), ...args.copy };
  const [a, b, c, dark, light] = [palette[0], palette[1], palette[2] ?? palette[1], palette[3] ?? '#0b0b12', palette[4] ?? '#ffffff'];
  const layers: Layer[] = [];
  const scale = Math.min(width / 1920, height / 1080);
  const f = (n: number) => Math.round(n * scale);

  // background
  layers.push(createShape('rect', {
    name: 'Background gradient', x: 0, y: 0, w: width, h: height, fill: dark, endTime: duration,
    fillGradient: gradient([dark, a, b], 135),
  }));
  const artSrc = makeBackdrop('mesh', [a, b, c], 11);
  layers.push(createLayer({
    type: 'image', name: 'Atmosphere', x: 0, y: 0, w: width, h: height, fill: 'transparent', endTime: duration,
    media: { src: artSrc, fit: 'cover' }, opacity: 0.32, blendMode: 'screen',
    keyframes: { scaleX: [kf(0, 1), kf(duration, 1.12)], scaleY: [kf(0, 1), kf(duration, 1.12)], rotation: [kf(0, 0), kf(duration, 4)] },
  }));
  if (args.imageSrc) {
    layers.push(createLayer({
      type: 'image', name: 'Hero image', x: width * 0.52, y: height * 0.12, w: width * 0.42, h: height * 0.76,
      fill: 'transparent', endTime: duration, media: { src: args.imageSrc, fit: 'cover' }, radius: f(28),
      keyframes: { opacity: [kf(0, 0), kf(0.5, 0), kf(1.1, 1, { type: 'easeOut' })], scaleX: [kf(0, 1.08), kf(duration, 1)], scaleY: [kf(0, 1.08), kf(duration, 1)], x: [kf(0, width * 0.56), kf(duration, width * 0.52)] },
    }));
    layers.push(createShape('roundedRect', { name: 'Image frame', x: width * 0.52, y: height * 0.12, w: width * 0.42, h: height * 0.76, fill: 'transparent', stroke: light, strokeWidth: 1, radius: f(28), opacity: 0.25, endTime: duration }));
  }

  const scenes = args.scenes ?? ['title', 'features', 'cta'];
  const titles: Record<string, { start: number; end: number }> = {};
  const seg = duration / scenes.length;
  scenes.forEach((s, i) => { titles[`${s}-${i}`] = { start: i * seg, end: (i + 1) * seg }; });

  scenes.forEach((scene, i) => {
    const start = i * seg;
    const end = (i + 1) * seg;
    if (scene === 'title') {
      layers.push(createText(copy.kicker, {
        name: 'Kicker', x: width * 0.08, y: height * 0.3, w: width * 0.7, h: f(34), startTime: start, endTime: end,
        keyframes: inOut(start, end),
      }, { fontFamily: 'JetBrains Mono', fontSize: f(19), fontWeight: 500, letterSpacing: f(4), color: b, uppercase: true }));
      layers.push(createText(copy.headline, {
        name: 'Headline', x: width * 0.07, y: height * 0.36, w: args.imageSrc ? width * 0.46 : width * 0.8, h: height * 0.34,
        startTime: start, endTime: end,
        keyframes: inOut(start, end),
      }, { fontFamily: font, fontSize: f(args.imageSrc ? 92 : 132), fontWeight: 800, lineHeight: 0.94, letterSpacing: f(-3), color: light, uppercase: true, animator: { type: 'charRise', duration: 0.9, stagger: 0.03, delay: 0.15 } }));
      layers.push(createShape('rect', {
        name: 'Accent rule', x: width * 0.08, y: height * 0.76, w: f(220), h: f(6), fill: b, radius: 3, startTime: start, endTime: end,
        keyframes: { w: [kf(start, 0), kf(start + 0.8, f(220), { type: 'easeOut' })], ...inOut(start, end) },
      }));
      layers.push(createShape('ellipse', {
        name: 'Glow orb', x: width * 0.76, y: height * 0.16, w: f(380), h: f(380), fill: c, opacity: 0.5, startTime: start, endTime: end,
        effects: [{ id: uid('fx'), type: 'blur', enabled: true, amount: 80 }],
        keyframes: { scaleX: [kf(start, 0.8), kf(end, 1.15)], scaleY: [kf(start, 0.8), kf(end, 1.15)], opacity: inOut(start, end).opacity },
      }));
    } else if (scene === 'features') {
      layers.push(createText(copy.subhead, {
        name: 'Subhead', x: width * 0.08, y: height * 0.24, w: width * 0.74, h: height * 0.16, startTime: start, endTime: end,
        keyframes: inOut(start, end),
      }, { fontFamily: font, fontSize: f(46), fontWeight: 600, lineHeight: 1.12, letterSpacing: f(-1), color: light }));
      const items = ['Editable layers', 'Real keyframes', 'Export-ready', 'Brand-aware'];
      items.forEach((item, idx) => {
        const y = height * 0.48 + idx * f(84);
        const st = start + 0.12 * idx;
        layers.push(createShape('roundedRect', { name: `Row ${idx + 1} bg`, x: width * 0.08, y, w: width * 0.62, h: f(64), fill: light, opacity: 0.06, radius: f(14), startTime: start, endTime: end, keyframes: { opacity: [kf(st, 0), kf(st + 0.4, 0.06, { type: 'easeOut' }), kf(end - 0.3, 0.06), kf(end, 0)] } }));
        layers.push(createText(`${String(idx + 1).padStart(2, '0')}  ${item}`, {
          name: `Feature ${idx + 1}`, x: width * 0.1, y: y + f(18), w: width * 0.58, h: f(34), startTime: start, endTime: end,
          keyframes: { x: [kf(st, width * 0.1 - 30), kf(st + 0.45, width * 0.1, { type: 'easeOut' })], opacity: [kf(st, 0), kf(st + 0.4, 1), kf(end - 0.25, 1), kf(end, 0)] },
        }, { fontFamily: 'Inter', fontSize: f(24), fontWeight: 500, letterSpacing: f(0.5), color: light }));
      });
    } else if (scene === 'quote') {
      layers.push(createText(`“${copy.subhead}”`, {
        name: 'Quote', x: width * 0.12, y: height * 0.3, w: width * 0.76, h: height * 0.32, startTime: start, endTime: end,
        keyframes: inOut(start, end),
      }, { fontFamily: 'Playfair Display', fontSize: f(54), fontWeight: 500, fontStyle: 'italic', lineHeight: 1.2, color: light, align: 'center', animator: { type: 'wordReveal', duration: 1, stagger: 0.06, delay: 0.1 } }));
    } else {
      layers.push(createText(copy.headline, {
        name: 'CTA headline', x: width * 0.08, y: height * 0.28, w: width * 0.74, h: height * 0.24, startTime: start, endTime: end,
        keyframes: inOut(start, end),
      }, { fontFamily: font, fontSize: f(88), fontWeight: 800, lineHeight: 0.98, letterSpacing: f(-2), color: light, uppercase: true }));
      layers.push(createShape('roundedRect', {
        name: 'CTA button', x: width * 0.08, y: height * 0.62, w: f(300), h: f(76), fill: b, radius: f(38), startTime: start, endTime: end,
        keyframes: { scaleX: [kf(start + 0.2, 0.8), kf(start + 0.7, 1, { type: 'spring', stiffness: 170, damping: 14 })], scaleY: [kf(start + 0.2, 0.8), kf(start + 0.7, 1, { type: 'spring', stiffness: 170, damping: 14 })], ...inOut(start, end) },
      }));
      layers.push(createText(copy.cta, {
        name: 'CTA label', x: width * 0.08, y: height * 0.62 + f(23), w: f(300), h: f(30), startTime: start, endTime: end,
        keyframes: inOut(start + 0.3, end),
      }, { fontFamily: 'Inter', fontSize: f(18), fontWeight: 700, letterSpacing: f(3), color: '#0b0b12', align: 'center', uppercase: true }));
      layers.push(createText('prism.studio', {
        name: 'Url', x: width * 0.08, y: height * 0.76, w: width * 0.4, h: f(26), startTime: start, endTime: end,
        keyframes: inOut(start + 0.4, end),
      }, { fontFamily: 'JetBrains Mono', fontSize: f(15), letterSpacing: f(1), color: light }));
    }
  });

  // texture overlays
  layers.push(createShape('rect', { name: 'Grain', x: 0, y: 0, w: width, h: height, fill: 'transparent', endTime: duration, effects: [{ id: uid('fx'), type: 'grain', enabled: true, amount: 16 }] }));
  layers.push(createShape('rect', { name: 'Vignette', x: 0, y: 0, w: width, h: height, fill: 'transparent', endTime: duration, effects: [{ id: uid('fx'), type: 'vignette', enabled: true, amount: 32 }] }));
  layers.push(createLayer({
    type: 'particles', name: 'Dust', x: 0, y: 0, w: width, h: height, fill: 'transparent', endTime: duration,
    particles: { count: 70, shape: 'circle', color: b, size: f(4), speed: 0.22, spread: 26, gravity: -0.1, seed: 19 },
  }));

  return { layers, duration, background: dark, backgroundGradient: gradient([dark, a, b], 135) };
}

// ── Image-driven skills ────────────────────────────────────────────────────
export function imageMotionLayers(image: Layer, style: 'parallax' | 'kenBurns' | 'reveal' | 'kinetic' | '2.5d', duration: number): Layer[] {
  const layers: Layer[] = [{ ...image, name: image.name || 'Image', startTime: 0, endTime: duration }];
  if (style === 'parallax' || style === '2.5d') {
    layers[0] = { ...layers[0], keyframes: { ...layers[0].keyframes, scaleX: [kf(0, 1.08), kf(duration, 1.16)], scaleY: [kf(0, 1.08), kf(duration, 1.16)], x: [kf(0, image.x - 20), kf(duration, image.x + 20)], y: [kf(0, image.y + 10), kf(duration, image.y - 10)] } };
    for (let i = 0; i < 3; i++) {
      const s = createShape('roundedRect', {
        name: `Parallax card ${i + 1}`, x: image.x + image.w * (0.12 + i * 0.28), y: image.y + image.h * 0.62, w: image.w * 0.2, h: image.h * 0.22,
        fill: '#ffffff', opacity: 0.14, radius: 18, endTime: duration, blendMode: 'overlay',
        keyframes: { y: [kf(0, image.y + image.h * 0.62), kf(duration, image.y + image.h * 0.56)], x: [kf(0, image.x + image.w * (0.12 + i * 0.28)), kf(duration, image.x + image.w * (0.12 + i * 0.28) + (i - 1) * 60)] },
      });
      layers.push(s);
    }
  } else if (style === 'kenBurns') {
    layers[0] = { ...layers[0], keyframes: { ...layers[0].keyframes, scaleX: [kf(0, 1), kf(duration, 1.18)], scaleY: [kf(0, 1), kf(duration, 1.18)] } };
  } else if (style === 'reveal') {
    layers[0] = { ...layers[0], keyframes: { ...layers[0].keyframes, x: [kf(0, image.x + image.w * 0.6), kf(0.9, image.x, { type: 'bezier', bezier: [0.16, 1, 0.3, 1] })], opacity: [kf(0, 0), kf(0.4, 1)] } };
    layers.push(createShape('rect', { name: 'Reveal wipe', x: image.x, y: image.y, w: image.w, h: image.h, fill: '#0b0b12', endTime: 1.2, keyframes: { w: [kf(0, image.w), kf(0.9, 0, { type: 'bezier', bezier: [0.16, 1, 0.3, 1] })] } }));
  } else {
    layers[0] = { ...layers[0], keyframes: { ...layers[0].keyframes, scaleX: [kf(0, 1.1), kf(duration, 1.02)], scaleY: [kf(0, 1.1), kf(duration, 1.02)] } };
  }
  return layers;
}

export function smartReframeOps(project: Project, aspect: Aspect): { width: number; height: number; updates: { id: string; x: number; y: number; w: number; h: number }[] } {
  const target = aspect === '16:9' ? { w: 1920, h: 1080 } : aspect === '9:16' ? { w: 1080, h: 1920 } : aspect === '1:1' ? { w: 1080, h: 1080 } : { w: 1080, h: 1350 };
  const scale = Math.max(target.w / project.width, target.h / project.height);
  const ox = (target.w - project.width * scale) / 2;
  const oy = (target.h - project.height * scale) / 2;
  const updates = project.layers.map((l) => {
    const r = resolveLayer(l, 0);
    return { id: l.id, x: Math.round(r.x * scale + ox), y: Math.round(r.y * scale + oy), w: Math.round(r.w * scale), h: Math.round(r.h * scale) };
  });
  return { width: target.w, height: target.h, updates };
}

// ── Misc generators ────────────────────────────────────────────────────────
export function captionChunks(text: string, maxChars = 42): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if ((current + ' ' + s).trim().length > maxChars && current) { chunks.push(current.trim()); current = s; }
    else current = `${current} ${s}`.trim();
  }
  if (current) chunks.push(current.trim());
  return chunks.length ? chunks : [text.slice(0, maxChars)];
}

export function captionLayers(text: string, project: Project): Layer[] {
  const chunks = captionChunks(text);
  const per = project.duration / Math.max(1, chunks.length);
  return chunks.map((chunk, i) => createText(chunk, {
    name: `Caption ${i + 1}`, x: project.width * 0.1, y: project.height * 0.82, w: project.width * 0.8, h: project.height * 0.1,
    startTime: i * per, endTime: Math.min(project.duration, (i + 1) * per), fill: '#ffffff',
  }, { fontFamily: 'Inter', fontSize: Math.round(project.width / 40), fontWeight: 600, color: '#ffffff', align: 'center', lineHeight: 1.3 }));
}

export function brandOps(kit: { colors: string[]; fonts: { heading: string; body: string } }, project: Project): { background: string; gradient: Gradient; textUpdates: { id: string; fontFamily: string; color: string }[] } {
  const textLayers = project.layers.filter((l) => l.type === 'text').sort((a, b) => (b.text?.fontSize ?? 0) - (a.text?.fontSize ?? 0));
  return {
    background: kit.colors[3] ?? project.background,
    gradient: gradient([kit.colors[3] ?? '#0b0b12', kit.colors[0], kit.colors[1]], 140),
    textUpdates: textLayers.map((l, i) => ({ id: l.id, fontFamily: i === 0 ? kit.fonts.heading : kit.fonts.body, color: kit.colors[4] ?? '#ffffff' })),
  };
}

export function shapeKindFromText(text: string): ShapeKind {
  if (/circle|ellipse|round/i.test(text)) return 'ellipse';
  if (/star/i.test(text)) return 'star';
  if (/triangle/i.test(text)) return 'triangle';
  if (/hex/i.test(text)) return 'hexagon';
  if (/polygon/i.test(text)) return 'polygon';
  if (/line/i.test(text)) return 'line';
  if (/arrow/i.test(text)) return 'arrow';
  if (/diamond/i.test(text)) return 'diamond';
  if (/rounded/i.test(text)) return 'roundedRect';
  return 'rect';
}
