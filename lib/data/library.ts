import type { Gradient } from '@/lib/engine/types';

export interface LibraryItem { id: string; name: string; type: 'image' | 'svg' | 'icon' | 'lottie' | 'music' | 'sfx' | 'sticker'; src: string; tags: string[]; w?: number; h?: number; meta?: Record<string, unknown> }

// ── Procedural backdrop generator (SVG data-URL, zero network) ───────────────
export function makeBackdrop(kind: 'mesh' | 'grain' | 'waves' | 'orb' | 'grid' | 'blob' | 'spotlight' | 'duotone', colors: string[], seed = 1): string {
  const [a, b, c] = [colors[0] ?? '#8b5cf6', colors[1] ?? '#22d3ee', colors[2] ?? '#e879f9'];
  const rnd = (n: number) => { const x = Math.sin(seed * 9301 + n * 49297) * 233280; return Math.abs(x - Math.floor(x)); };
  let body = '';
  switch (kind) {
    case 'mesh':
      body = `<defs><radialGradient id="g1" cx="20%" cy="20%"><stop offset="0" stop-color="${a}" stop-opacity=".95"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>
      <radialGradient id="g2" cx="80%" cy="30%"><stop offset="0" stop-color="${b}" stop-opacity=".9"/><stop offset="1" stop-color="${b}" stop-opacity="0"/></radialGradient>
      <radialGradient id="g3" cx="60%" cy="90%"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>
      <rect width="800" height="800" fill="#0b0b12"/><rect width="800" height="800" fill="url(#g1)"/><rect width="800" height="800" fill="url(#g2)"/><rect width="800" height="800" fill="url(#g3)"/>`;
      break;
    case 'waves': {
      const paths = Array.from({ length: 7 }, (_, i) => {
        const y = 180 + i * 70 + rnd(i) * 40;
        return `<path d="M0 ${y} C 200 ${y - 90 + rnd(i) * 60}, 420 ${y + 100 - rnd(i) * 60}, 800 ${y - 20}" fill="none" stroke="${i % 2 ? b : a}" stroke-opacity="${0.75 - i * 0.07}" stroke-width="${3 + rnd(i) * 3}"/>`;
      }).join('');
      body = `<rect width="800" height="800" fill="#08080f"/>${paths}`;
      break;
    }
    case 'orb':
      body = `<defs><radialGradient id="o" cx="38%" cy="32%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".35" stop-color="${b}" stop-opacity=".9"/><stop offset=".7" stop-color="${a}"/><stop offset="1" stop-color="#08080f"/></radialGradient>
      <filter id="bl"><feGaussianBlur stdDeviation="26"/></filter></defs>
      <rect width="800" height="800" fill="#07070d"/><circle cx="400" cy="400" r="260" fill="url(#o)" filter="url(#bl)"/><circle cx="400" cy="400" r="215" fill="url(#o)"/>`;
      break;
    case 'grid':
      body = `<defs><pattern id="p" width="46" height="46" patternUnits="userSpaceOnUse"><path d="M46 0H0V46" fill="none" stroke="${a}" stroke-opacity=".28" stroke-width="1"/></pattern></defs>
      <rect width="800" height="800" fill="#0a0a12"/><rect width="800" height="800" fill="url(#p)"/>
      <circle cx="${200 + rnd(1) * 400}" cy="${200 + rnd(2) * 400}" r="180" fill="${b}" opacity=".18" filter="blur(40)"/>`;
      break;
    case 'blob':
      body = `<rect width="800" height="800" fill="#0a0a12"/>
      <path d="M120 ${300 + rnd(1) * 100} C ${80} 120, ${320} 60, ${430} 150 C ${580} 240, ${700} 120, ${710} 330 C ${720} 560, ${520} 700, ${330} 660 C ${140} 620, ${60} 470, 120 300 Z" fill="${a}" opacity=".9"/>
      <path d="M300 90 C ${520} 20, ${700} 180, ${640} 330 C ${580} 480, ${360} 520, ${250} 420 C ${140} 320, ${160} 140, 300 90 Z" fill="${b}" opacity=".55"/>`;
      break;
    case 'spotlight':
      body = `<defs><radialGradient id="s" cx="50%" cy="18%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".4" stop-color="${b}" stop-opacity=".5"/><stop offset="1" stop-color="#05050a" stop-opacity="1"/></radialGradient></defs><rect width="800" height="800" fill="url(#s)"/>`;
      break;
    case 'duotone':
      body = `<defs><linearGradient id="d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
      <filter id="b2"><feTurbulence baseFrequency="0.012" numOctaves="3"/><feDisplacementMap in="SourceGraphic" scale="60"/></filter></defs>
      <rect width="800" height="800" fill="#08080f"/><rect width="800" height="800" fill="url(#d)" opacity=".85" filter="url(#b2)"/>`;
      break;
    case 'grain':
    default:
      body = `<defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
      <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="4"/><feColorMatrix type="saturate" values="0"/></filter></defs>
      <rect width="800" height="800" fill="url(#l)"/><rect width="800" height="800" filter="url(#n)" opacity=".22"/>`;
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${body}</svg>`)}`;
}

const BACKDROP_KINDS: LibraryItem['tags'] = ['mesh', 'grain', 'waves', 'orb', 'grid', 'blob', 'spotlight', 'duotone'] as never;
const PALETTE_SETS = [
  ['#8b5cf6', '#22d3ee', '#e879f9'], ['#f59e0b', '#f97316', '#7c2d12'], ['#22c55e', '#a3e635', '#064e3b'],
  ['#f472b6', '#60a5fa', '#facc15'], ['#0ea5e9', '#2dd4bf', '#1e1b4b'], ['#fda4af', '#f9a8d4', '#be123c'],
  ['#a78bfa', '#6366f1', '#c026d3'], ['#e5e7eb', '#9ca3af', '#111827'],
];

export const BACKDROPS: LibraryItem[] = (BACKDROP_KINDS as string[]).flatMap((kind, ki) =>
  PALETTE_SETS.slice(0, 6).map((pal, pi) => ({
    id: `bg-${kind}-${pi}`,
    name: `${kind[0].toUpperCase()}${kind.slice(1)} ${pi + 1}`,
    type: 'image' as const,
    src: makeBackdrop(kind as 'mesh', pal, ki * 7 + pi + 1),
    tags: [kind, 'abstract', 'backdrop', 'gradient'],
    w: 800, h: 800,
  })),
);

export const STICKERS: LibraryItem[] = [
  { id: 'st-1', name: 'Star Burst', type: 'sticker', src: stickerSvg('#fbbf24', '<path d="M50 4l13 33 35 3-27 24 8 35-29-19-29 19 8-35L2 40l35-3z" fill="currentColor"/>'), tags: ['star', 'burst', 'badge'], w: 100, h: 100 },
  { id: 'st-2', name: 'Ring', type: 'sticker', src: stickerSvg('#22d3ee', '<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="8"/>'), tags: ['ring', 'circle'], w: 100, h: 100 },
  { id: 'st-3', name: 'Arrow Curl', type: 'sticker', src: stickerSvg('#e879f9', '<path d="M12 72c8-46 46-56 68-40" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M80 22l8 12-14 4" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>'), tags: ['arrow', 'curl'], w: 100, h: 100 },
  { id: 'st-4', name: 'Sparkle', type: 'sticker', src: stickerSvg('#ffffff', '<path d="M50 6l9 35 35 9-35 9-9 35-9-35-35-9 35-9z" fill="currentColor"/>'), tags: ['sparkle', 'star', 'shine'], w: 100, h: 100 },
  { id: 'st-5', name: 'Underline', type: 'sticker', src: stickerSvg('#a3e635', '<path d="M6 56c20-18 62-24 88-6" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>'), tags: ['underline', 'marker'], w: 100, h: 100 },
  { id: 'st-6', name: 'Grid Badge', type: 'sticker', src: stickerSvg('#8b5cf6', '<rect x="18" y="18" width="64" height="64" rx="14" fill="none" stroke="currentColor" stroke-width="7"/><path d="M50 30v40M30 50h40" stroke="currentColor" stroke-width="7"/>'), tags: ['badge', 'grid'], w: 100, h: 100 },
];

function stickerSvg(color: string, inner: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="200" height="200" color="${color}">${inner}</svg>`)}`;
}

export const FONTS = [
  // Sans / grotesk
  { family: 'Inter', category: 'Sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Space Grotesk', category: 'Sans', weights: [300, 400, 500, 600, 700] },
  { family: 'Sora', category: 'Sans', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
  { family: 'Outfit', category: 'Sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'DM Sans', category: 'Sans', weights: [400, 500, 700] },
  { family: 'Manrope', category: 'Sans', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Poppins', category: 'Sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Archivo', category: 'Sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Figtree', category: 'Sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Plus Jakarta Sans', category: 'Sans', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Rubik', category: 'Sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Work Sans', category: 'Sans', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Montserrat', category: 'Sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Urbanist', category: 'Sans', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Lexend', category: 'Sans', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Onest', category: 'Sans', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Bricolage Grotesque', category: 'Sans', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Instrument Sans', category: 'Sans', weights: [400, 500, 600, 700] },
  { family: 'Schibsted Grotesk', category: 'Sans', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Geist', category: 'Sans', weights: [300, 400, 500, 600, 700, 800, 900] },
  // Serif
  { family: 'Playfair Display', category: 'Serif', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Fraunces', category: 'Serif', weights: [300, 400, 500, 600, 700, 900] },
  { family: 'Cormorant Garamond', category: 'Serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Libre Baskerville', category: 'Serif', weights: [400, 700] },
  { family: 'Lora', category: 'Serif', weights: [400, 500, 600, 700] },
  { family: 'Merriweather', category: 'Serif', weights: [300, 400, 700, 900] },
  { family: 'DM Serif Display', category: 'Serif', weights: [400] },
  { family: 'Bodoni Moda', category: 'Serif', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Instrument Serif', category: 'Serif', weights: [400] },
  { family: 'Newsreader', category: 'Serif', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Spectral', category: 'Serif', weights: [300, 400, 500, 600, 700, 800] },
  // Display
  { family: 'Bebas Neue', category: 'Display', weights: [400] },
  { family: 'Anton', category: 'Display', weights: [400] },
  { family: 'Oswald', category: 'Display', weights: [200, 300, 400, 500, 600, 700] },
  { family: 'Archivo Black', category: 'Display', weights: [400] },
  { family: 'Syne', category: 'Display', weights: [400, 500, 600, 700, 800] },
  { family: 'Unbounded', category: 'Display', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Righteous', category: 'Display', weights: [400] },
  { family: 'Bungee', category: 'Display', weights: [400] },
  { family: 'Abril Fatface', category: 'Display', weights: [400] },
  { family: 'Teko', category: 'Display', weights: [300, 400, 500, 600, 700] },
  { family: 'Russo One', category: 'Display', weights: [400] },
  { family: 'Chakra Petch', category: 'Display', weights: [300, 400, 500, 600, 700] },
  { family: 'Monoton', category: 'Display', weights: [400] },
  { family: 'Cinzel', category: 'Display', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Staatliches', category: 'Display', weights: [400] },
  // Handwriting / script
  { family: 'Caveat', category: 'Handwriting', weights: [400, 500, 600, 700] },
  { family: 'Dancing Script', category: 'Handwriting', weights: [400, 500, 600, 700] },
  { family: 'Pacifico', category: 'Handwriting', weights: [400] },
  { family: 'Permanent Marker', category: 'Handwriting', weights: [400] },
  { family: 'Shadows Into Light', category: 'Handwriting', weights: [400] },
  { family: 'Kalam', category: 'Handwriting', weights: [300, 400, 700] },
  { family: 'Satisfy', category: 'Handwriting', weights: [400] },
  { family: 'Great Vibes', category: 'Handwriting', weights: [400] },
  { family: 'Sacramento', category: 'Handwriting', weights: [400] },
  // Mono
  { family: 'JetBrains Mono', category: 'Mono', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'IBM Plex Mono', category: 'Mono', weights: [300, 400, 500, 600, 700] },
  { family: 'Space Mono', category: 'Mono', weights: [400, 700] },
  { family: 'Courier Prime', category: 'Mono', weights: [400, 700] },
  { family: 'DM Mono', category: 'Mono', weights: [300, 400, 500] },
];

export type FontCategory = (typeof FONTS)[number]['category'];

export const GOOGLE_FONTS_HREF = `https://fonts.googleapis.com/css2?${[
  'Inter:wght@300;400;500;600;700;800;900', 'Space+Grotesk:wght@300;400;500;600;700', 'Sora:wght@100..800',
  'Outfit:wght@100..900', 'DM+Sans:wght@400;500;700', 'Manrope:wght@200..800', 'Poppins:wght@300;400;500;600;700;800;900',
  'Archivo:wght@300..900', 'Figtree:wght@300..900', 'Plus+Jakarta+Sans:wght@200..800', 'Rubik:wght@300..900',
  'Work+Sans:wght@300..800', 'Montserrat:wght@300..900', 'Urbanist:wght@300..800', 'Lexend:wght@300..800',
  'Onest:wght@300..800', 'Bricolage+Grotesque:wght@300..800', 'Instrument+Sans:wght@400..700', 'Schibsted+Grotesk:wght@400..900',
  'Geist:wght@300..900',
  'Playfair+Display:wght@400..900', 'Fraunces:wght@300..900', 'Cormorant+Garamond:wght@300..700', 'Libre+Baskerville:wght@400;700',
  'Lora:wght@400..700', 'Merriweather:wght@300;400;700;900', 'DM+Serif+Display', 'Bodoni+Moda:wght@400..900',
  'Instrument+Serif', 'Newsreader:wght@200..800', 'Spectral:wght@300;400;500;600;700;800',
  'Bebas+Neue', 'Anton', 'Oswald:wght@200..700', 'Archivo+Black', 'Syne:wght@400..800', 'Unbounded:wght@200..900', 'Righteous',
  'Bungee', 'Abril+Fatface', 'Teko:wght@300..700', 'Russo+One', 'Chakra+Petch:wght@300;400;500;600;700', 'Monoton',
  'Cinzel:wght@400..900', 'Staatliches',
  'Caveat:wght@400..700', 'Dancing+Script:wght@400..700', 'Pacifico', 'Permanent+Marker', 'Shadows+Into+Light',
  'Kalam:wght@300;400;700', 'Satisfy', 'Great+Vibes', 'Sacramento',
  'JetBrains+Mono:wght@300..800', 'IBM+Plex+Mono:wght@300;400;500;600;700', 'Space+Mono:wght@400;700', 'Courier+Prime:wght@400;700', 'DM+Mono:wght@300;400;500',
].map((f) => `family=${f}`).join('&')}&display=swap`;

// ── Music / SFX (procedurally synthesized in-app, royalty free) ─────────────
export interface Track { id: string; name: string; mood: string; bpm: number; duration: number; bpmKey?: string; scale: number[]; root: number; kind: 'music' | 'sfx'; pattern?: number[]; waveform?: OscillatorType }

export const MUSIC: Track[] = [
  { id: 'mus-aurora', name: 'Aurora Drift', mood: 'Ambient', bpm: 84, duration: 32, root: 220, scale: [0, 3, 5, 7, 10], kind: 'music', waveform: 'sine', pattern: [0, 2, 4, 2, 1, 3, 2, 0] },
  { id: 'mus-pulse', name: 'Neon Pulse', mood: 'Electronic', bpm: 122, duration: 30, root: 146.83, scale: [0, 2, 3, 7, 9], kind: 'music', waveform: 'triangle', pattern: [0, 0, 3, 1, 0, 4, 2, 1] },
  { id: 'mus-lift', name: 'Launch Sequence', mood: 'Cinematic', bpm: 96, duration: 40, root: 98, scale: [0, 2, 5, 7, 11], kind: 'music', waveform: 'sawtooth', pattern: [0, 4, 2, 4, 1, 3, 4, 2] },
  { id: 'mus-soft', name: 'Soft Geometry', mood: 'Lo-fi', bpm: 76, duration: 36, root: 174.61, scale: [0, 3, 7, 10, 12], kind: 'music', waveform: 'sine', pattern: [0, 1, 2, 1, 3, 2, 1, 0] },
  { id: 'mus-drive', name: 'Night Drive', mood: 'Synthwave', bpm: 108, duration: 34, root: 130.81, scale: [0, 2, 3, 5, 8], kind: 'music', waveform: 'square', pattern: [0, 3, 2, 4, 1, 2, 3, 4] },
  { id: 'mus-minimal', name: 'Quiet Engine', mood: 'Minimal', bpm: 90, duration: 28, root: 196, scale: [0, 5, 7, 12], kind: 'music', waveform: 'sine', pattern: [0, 2, 1, 3, 0, 2, 3, 1] },
];

export const SFX: Track[] = [
  { id: 'sfx-whoosh', name: 'Whoosh', mood: 'Transition', bpm: 0, duration: 0.9, root: 440, scale: [], kind: 'sfx' },
  { id: 'sfx-pop', name: 'Pop', mood: 'UI', bpm: 0, duration: 0.35, root: 660, scale: [], kind: 'sfx' },
  { id: 'sfx-riser', name: 'Riser', mood: 'Build', bpm: 0, duration: 2.4, root: 220, scale: [], kind: 'sfx' },
  { id: 'sfx-impulse', name: 'Impact', mood: 'Hit', bpm: 0, duration: 1.2, root: 80, scale: [], kind: 'sfx' },
  { id: 'sfx-click', name: 'Soft Click', mood: 'UI', bpm: 0, duration: 0.18, root: 1200, scale: [], kind: 'sfx' },
  { id: 'sfx-shimmer', name: 'Shimmer', mood: 'Accent', bpm: 0, duration: 1.8, root: 880, scale: [], kind: 'sfx' },
];

// ── Icon library (lazy loaded from /icon-library.json) ─────────────────────
interface IconEntry { label: string; svg: string; tags: string[] }
let iconPromise: Promise<Record<string, IconEntry>> | null = null;

export function loadIcons(): Promise<Record<string, IconEntry>> {
  if (!iconPromise) {
    iconPromise = fetch('/icon-library.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  }
  return iconPromise;
}

export async function searchIcons(query: string, limit = 120): Promise<{ name: string; label: string; svg: string }[]> {
  const all = await loadIcons();
  const q = query.trim().toLowerCase();
  const entries = Object.entries(all);
  const filtered = q ? entries.filter(([name, e]) => name.toLowerCase().includes(q) || e.label.toLowerCase().includes(q) || e.tags.some((t) => t.startsWith(q))) : entries;
  return filtered.slice(0, limit).map(([name, e]) => ({ name, label: e.label, svg: e.svg }));
}

export function iconToDataUrl(svgInner: string, color = '#ffffff', strokeWidth = 1.75, size = 512): string {
  const inner = svgInner.replace(/currentColor/g, color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function iconToReusableSvg(name: string, inner: string, color: string, strokeWidth: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

// ── Stock providers (via API proxy; graceful empty state offline) ───────────
export interface StockPhoto { id: string; thumb: string; full: string; author: string; provider: 'unsplash' | 'pexels'; alt: string }
export async function searchStock(query: string, provider: 'unsplash' | 'pexels' = 'unsplash'): Promise<StockPhoto[]> {
  try {
    const r = await fetch(`/api/stock?provider=${provider}&q=${encodeURIComponent(query)}`);
    if (!r.ok) return [];
    const data = await r.json();
    return data.results ?? [];
  } catch { return []; }
}

export function gradientFromPalette(colors: string[], angle = 135): Gradient {
  return { type: 'linear', angle, stops: colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color })) };
}

export const LOTTIE_STUBS: LibraryItem[] = [
  { id: 'lottie-1', name: 'Pulse Ring', type: 'lottie', src: '', tags: ['loop', 'ring'], meta: { kind: 'pulse' } },
  { id: 'lottie-2', name: 'Orbit Dots', type: 'lottie', src: '', tags: ['loop', 'dots'], meta: { kind: 'orbit' } },
  { id: 'lottie-3', name: 'Wave Bars', type: 'lottie', src: '', tags: ['audio', 'bars'], meta: { kind: 'bars' } },
];
