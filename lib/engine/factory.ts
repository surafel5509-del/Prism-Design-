import type { Gradient, Layer, LayerType, Project, ShapeKind, TextProps, BrandKit, BlendMode } from './types';
import { uid } from '@/lib/utils';

export const FONT_STACKS = [
  'Inter', 'Space Grotesk', 'Sora', 'Outfit', 'DM Sans', 'Manrope', 'Poppins',
  'Playfair Display', 'Fraunces', 'Cormorant Garamond', 'Bebas Neue', 'Anton',
  'Oswald', 'Archivo Black', 'Syne', 'Unbounded', 'Righteous', 'Caveat', 'JetBrains Mono',
];

export const PALETTES: { name: string; colors: string[] }[] = [
  { name: 'Prism', colors: ['#8b5cf6', '#22d3ee', '#e879f9', '#0b0b12', '#f8f8ff'] },
  { name: 'Midnight Bloom', colors: ['#7c3aed', '#f472b6', '#fbbf24', '#0b1020', '#f5f3ff'] },
  { name: 'Cyber Lime', colors: ['#a3e635', '#22d3ee', '#111827', '#0b0b12', '#f7fee7'] },
  { name: 'Sunset Studio', colors: ['#fb7185', '#fbbf24', '#7c3aed', '#1c1017', '#fff7ed'] },
  { name: 'Editorial', colors: ['#111111', '#f5f1e8', '#c8462f', '#2f4538', '#d9c5a0'] },
  { name: 'Ocean Depth', colors: ['#0ea5e9', '#2dd4bf', '#1e1b4b', '#0b1120', '#ecfeff'] },
  { name: 'Neo Candy', colors: ['#f472b6', '#60a5fa', '#facc15', '#1e1b4b', '#fdf4ff'] },
  { name: 'Mono Graphite', colors: ['#f4f4f5', '#a1a1aa', '#18181b', '#09090b', '#ffffff'] },
  { name: 'Golden Hour', colors: ['#f59e0b', '#f97316', '#7c2d12', '#1a1410', '#fffbeb'] },
  { name: 'Forest Signal', colors: ['#22c55e', '#a3e635', '#064e3b', '#052e16', '#f0fdf4'] },
  { name: 'Rose Quartz', colors: ['#fda4af', '#f9a8d4', '#be123c', '#1f1216', '#fff1f2'] },
  { name: 'Electric Violet', colors: ['#a78bfa', '#6366f1', '#c026d3', '#0a0618', '#f5f3ff'] },
];

export function paletteByName(name: string) {
  return PALETTES.find((p) => p.name.toLowerCase() === name.toLowerCase())?.colors ?? PALETTES[0].colors;
}

export function defaultTextProps(partial: Partial<TextProps> = {}): TextProps {
  return {
    content: 'Your headline',
    fontFamily: 'Inter',
    fontSize: 72,
    fontWeight: 700,
    fontStyle: 'normal',
    lineHeight: 1.1,
    letterSpacing: -1,
    align: 'left',
    color: '#ffffff',
    gradient: null,
    uppercase: false,
    strokeWidth: 0,
    padding: 0,
    animator: null,
    ...partial,
  };
}

export interface LayerInit extends Partial<Omit<Layer, 'id'>> {
  id?: string;
  type?: LayerType;
}

export function createLayer(init: LayerInit = {}): Layer {
  const type = init.type ?? 'shape';
  return {
    id: init.id ?? uid('ly'),
    name: init.name ?? (type === 'text' ? 'Text' : type === 'image' ? 'Image' : type === 'group' ? 'Group' : 'Shape'),
    type,
    x: init.x ?? 0,
    y: init.y ?? 0,
    w: init.w ?? 200,
    h: init.h ?? 200,
    rotation: init.rotation ?? 0,
    scaleX: init.scaleX ?? 1,
    scaleY: init.scaleY ?? 1,
    skewX: 0,
    skewY: 0,
    anchorX: init.anchorX ?? 0,
    anchorY: init.anchorY ?? 0,
    opacity: init.opacity ?? 1,
    blendMode: (init.blendMode as BlendMode) ?? 'normal',
    visible: init.visible ?? true,
    locked: init.locked ?? false,
    fill: init.fill ?? '#8b5cf6',
    fillGradient: init.fillGradient ?? null,
    stroke: init.stroke,
    strokeWidth: init.strokeWidth ?? 0,
    radius: init.radius ?? 0,
    shape: init.shape ?? 'rect',
    points: init.points ?? 5,
    innerRadius: init.innerRadius ?? 0.45,
    text: type === 'text' ? defaultTextProps(init.text) : init.text,
    media: init.media,
    path: init.path,
    effects: init.effects ?? [],
    keyframes: init.keyframes ?? {},
    parentId: init.parentId ?? null,
    startTime: init.startTime ?? 0,
    endTime: init.endTime ?? 8,
    mask: init.mask ?? null,
    motionPath: init.motionPath ?? null,
    particles: init.particles ?? null,
    meta: init.meta ?? {},
  };
}

export function createShape(kind: ShapeKind, overrides: Partial<Layer> = {}): Layer {
  const base = { shape: kind, type: 'shape' as LayerType };
  const defaults: Record<string, Partial<Layer>> = {
    rect: { w: 300, h: 200, radius: 0 },
    roundedRect: { w: 320, h: 200, radius: 32 },
    ellipse: { w: 240, h: 240 },
    polygon: { w: 240, h: 240, points: 6 },
    star: { w: 260, h: 260, points: 5, innerRadius: 0.45 },
    triangle: { w: 240, h: 220, points: 3 },
    diamond: { w: 220, h: 220 },
    hexagon: { w: 240, h: 240 },
    line: { w: 320, h: 4, fill: '#ffffff' },
    arrow: { w: 300, h: 80, fill: '#22d3ee' },
  };
  return createLayer({ ...base, ...defaults[kind], ...overrides });
}

export function createText(content: string, overrides: Partial<Layer> = {}, textOverrides: Partial<TextProps> = {}): Layer {
  const size = overrides.text?.fontSize ?? textOverrides.fontSize ?? 72;
  const w = overrides.w ?? Math.min(1400, Math.max(360, content.length * size * 0.56));
  const h = overrides.h ?? size * 1.35;
  return createLayer({
    type: 'text',
    name: content.slice(0, 28) || 'Text',
    w, h,
    fill: '#ffffff',
    text: defaultTextProps({ content, fontSize: size, ...textOverrides }),
    ...overrides,
  });
}

export function createImage(src: string, overrides: Partial<Layer> = {}): Layer {
  return createLayer({
    type: 'image',
    name: overrides.name ?? 'Image',
    w: 640, h: 420,
    fill: 'transparent',
    media: { src, fit: 'cover', ...overrides.media },
    ...overrides,
  });
}

export function createProject(overrides: Partial<Project> = {}): Project {
  const now = Date.now();
  return {
    id: overrides.id ?? uid('pr'),
    name: overrides.name ?? 'Untitled project',
    width: overrides.width ?? 1920,
    height: overrides.height ?? 1080,
    fps: overrides.fps ?? 30,
    duration: overrides.duration ?? 8,
    background: overrides.background ?? '#0b0b12',
    backgroundGradient: overrides.backgroundGradient ?? null,
    layers: overrides.layers ?? [],
    brandKitId: overrides.brandKitId ?? null,
    folderId: overrides.folderId ?? null,
    tags: overrides.tags ?? [],
    thumbnail: overrides.thumbnail ?? null,
    description: overrides.description ?? '',
    createdAt: overrides.createdAt ?? now,
    updatedAt: now,
    version: 1,
  };
}

export function gradient(colors: string[], angle = 135, type: Gradient['type'] = 'linear'): Gradient {
  const stops = colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color }));
  return { type, angle, stops };
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  id: 'bk_default',
  name: 'Prism House',
  colors: ['#8b5cf6', '#22d3ee', '#e879f9', '#0b0b12', '#f8f8ff'],
  secondaryColors: ['#312e81', '#0e7490'],
  fonts: { heading: 'Sora', body: 'Inter', mono: 'JetBrains Mono' },
  logo: null,
  voice: 'Confident, modern, optimistic. Short sentences. No jargon.',
  radius: 24,
  style: 'Editorial gradients, soft glow, generous spacing',
  updatedAt: Date.now(),
};

export function applyBrandToLayers(layers: Layer[], kit: BrandKit): Layer[] {
  const textLayers = layers.filter((l) => l.type === 'text');
  return layers.map((l) => {
    if (l.type === 'text') {
      const idx = textLayers.indexOf(l);
      return {
        ...l,
        text: l.text ? { ...l.text, fontFamily: idx === 0 ? kit.fonts.heading : kit.fonts.body, color: kit.colors[4] || '#ffffff' } : l.text,
      };
    }
    return l;
  });
}

/** A tiny deterministic RNG for repeatable procedural design. */
export function seededRandom(seedStr: string) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
