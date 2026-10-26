// ─────────────────────────────────────────────────────────────────────────────
//  Sticker library — real vector SVG, no bitmaps, no external requests.
//  32 hand-drawn bases × colourways = 200+ stickers, all transparent and crisp.
// ─────────────────────────────────────────────────────────────────────────────

export interface Sticker {
  id: string;
  name: string;
  category: StickerCategory;
  tags: string[];
  src: string;
  color: string;
}

export type StickerCategory = 'Badges' | 'Arrows' | 'Bursts' | 'Doodles' | 'Labels' | 'Nature' | 'Tech' | 'Frames';

const C = {
  amber: '#fbbf24', cyan: '#22d3ee', fuchsia: '#e879f9', violet: '#8b5cf6',
  lime: '#a3e635', rose: '#fb7185', white: '#ffffff', ink: '#0b0b12', orange: '#fb923c', mint: '#5eead4',
};
const COLORWAYS = [C.amber, C.cyan, C.fuchsia, C.violet, C.lime, C.rose, C.white, C.orange, C.mint];

const svg = (inner: string, color: string, box = '0 0 100 100') =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="220" height="220" color="${color}">${inner}</svg>`)}`;

const star5 = 'M50 6l11.8 27.9 30 2.6-22.7 19.9 6.7 29.4L50 69.9 24.2 85.8l6.7-29.4L8.2 36.5l30-2.6z';
const star8 = 'M50 2l8 26 22-15-8 26 26 8-26 9 15 22-26-8-9 26-8-26-22 15 8-26-26-8 26-9-15-22 26 8z';
const burst = (n = 16, r = 48) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.58;
    pts.push(`${(50 + Math.cos(a) * rad).toFixed(1)},${(50 + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
};

interface Base { key: string; name: string; category: StickerCategory; tags: string[]; inner: (c: string) => string }

const BASES: Base[] = [
  // Badges
  { key: 'burst-official', name: 'Burst badge', category: 'Bursts', tags: ['burst', 'badge', 'sticker', 'sale'], inner: (c) => `<path d="${burst(18, 48)}" fill="${c}"/><circle cx="50" cy="50" r="29" fill="#0b0b12" opacity=".9"/><text x="50" y="48" text-anchor="middle" font-family="Inter, sans-serif" font-size="15" font-weight="800" fill="${c}" letter-spacing="1">NEW</text><text x="50" y="63" text-anchor="middle" font-family="Inter, sans-serif" font-size="8.5" font-weight="600" fill="#ffffff" opacity=".8" letter-spacing="2">DROP</text>` },
  { key: 'seal', name: 'Wax seal', category: 'Badges', tags: ['seal', 'badge', 'premium', 'round'], inner: (c) => `<circle cx="50" cy="50" r="44" fill="${c}"/><circle cx="50" cy="50" r="35" fill="none" stroke="#0b0b12" stroke-opacity=".28" stroke-width="2" stroke-dasharray="3 4"/><circle cx="50" cy="50" r="26" fill="#0b0b12" opacity=".16"/><path d="M50 32l5.6 12.4 13.4 1.4-10 9 2.9 13.2L50 61.6 38.1 68l2.9-13.2-10-9 13.4-1.4z" fill="#ffffff" opacity=".92"/>` },
  { key: 'verified', name: 'Verified tick', category: 'Badges', tags: ['verified', 'tick', 'check', 'badge'], inner: (c) => `<path d="${burst(12, 46)}" fill="${c}"/><path d="M32 51l12 12 24-26" fill="none" stroke="#0b0b12" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'double-ring', name: 'Double ring', category: 'Badges', tags: ['ring', 'circle', 'outline'], inner: (c) => `<circle cx="50" cy="50" r="45" fill="none" stroke="${c}" stroke-width="6"/><circle cx="50" cy="50" r="34" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="2 5"/><circle cx="50" cy="50" r="12" fill="${c}"/>` },
  { key: 'hot', name: 'Hot tag', category: 'Labels', tags: ['hot', 'label', 'tag', 'sale'], inner: (c) => `<rect x="8" y="28" width="74" height="44" rx="22" fill="${c}"/><path d="M82 50l12-14v28z" fill="${c}"/><circle cx="22" cy="50" r="4" fill="#0b0b12" opacity=".35"/><text x="48" y="58" text-anchor="middle" font-family="Inter, sans-serif" font-size="21" font-weight="900" fill="#0b0b12" letter-spacing="1">HOT</text>` },
  { key: 'sale', name: 'Sale flash', category: 'Labels', tags: ['sale', 'discount', 'flash', 'commerce'], inner: (c) => `<path d="${burst(14, 48)}" fill="${c}"/><text x="50" y="46" text-anchor="middle" font-family="Inter, sans-serif" font-size="19" font-weight="900" fill="#0b0b12">50%</text><text x="50" y="63" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="800" fill="#0b0b12" letter-spacing="2">OFF</text>` },
  // Arrows
  { key: 'arrow-curve', name: 'Curved arrow', category: 'Arrows', tags: ['arrow', 'hand', 'cream'], inner: (c) => `<path d="M10 76c6-40 40-58 72-40" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="M68 17l19 6-9 18" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'arrow-doodle', name: 'Doodle arrow', category: 'Arrows', tags: ['arrow', 'sketch', 'doodle'], inner: (c) => `<path d="M8 24c22 4 30 20 22 34-6 11-22 10-22 0 0-12 28-20 56-12" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M56 36l22 10-18 15" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'arrow-block', name: 'Block arrow', category: 'Arrows', tags: ['arrow', 'block', 'bold'], inner: (c) => `<path d="M4 36h44V18l44 32-44 32V64H4z" fill="${c}"/>` },
  { key: 'arrow-circle', name: 'Circle arrow', category: 'Arrows', tags: ['arrow', 'circle', 'refresh'], inner: (c) => `<circle cx="50" cy="50" r="42" fill="${c}"/><path d="M30 54h32M50 40l14 14-14 14" fill="none" stroke="#0b0b12" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` },
  // Bursts
  { key: 'sparkle-4', name: 'Sparkle', category: 'Bursts', tags: ['sparkle', 'star', 'magic'], inner: (c) => `<path d="M50 4l10.4 33.6L94 48l-33.6 10.4L50 92 39.6 58.4 6 48l33.6-10.4z" fill="${c}"/>` },
  { key: 'confetti', name: 'Confetti', category: 'Bursts', tags: ['confetti', 'party', 'celebrate'], inner: (c) => `<rect x="12" y="18" width="10" height="18" rx="2" fill="${c}" transform="rotate(-22 17 27)"/><circle cx="50" cy="18" r="6" fill="${c}" opacity=".75"/><rect x="72" y="14" width="9" height="16" rx="2" fill="${c}" transform="rotate(30 76 22)"/><path d="M24 52l7 7-7 7-7-7z" fill="${c}" opacity=".85"/><circle cx="56" cy="60" r="9" fill="${c}" opacity=".5"/><rect x="70" y="48" width="10" height="20" rx="3" fill="${c}" transform="rotate(-36 75 58)"/><circle cx="34" cy="82" r="5" fill="${c}" opacity=".7"/><path d="M60 82l5 5 10-12" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'burst-lines', name: 'Rays', category: 'Bursts', tags: ['rays', 'burst', 'sun', 'lines'], inner: (c) => Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const x1 = 50 + Math.cos(a) * 18, y1 = 50 + Math.sin(a) * 18;
    const x2 = 50 + Math.cos(a) * 47, y2 = 50 + Math.sin(a) * 47;
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${c}" stroke-width="${i % 2 === 0 ? 6 : 3}" stroke-linecap="round"/>`;
  }).join('') },
  { key: 'star-5', name: 'Star', category: 'Bursts', tags: ['star', 'rating', 'favourite'], inner: (c) => `<path d="${star5}" fill="${c}"/>` },
  { key: 'star-8', name: 'Starburst', category: 'Bursts', tags: ['star', 'burst', 'spark'], inner: (c) => `<path d="${star8}" fill="${c}"/>` },
  // Labels
  { key: 'pill', name: 'Pill label', category: 'Labels', tags: ['label', 'pill', 'tag', 'ui'], inner: (c) => `<rect x="6" y="32" width="88" height="36" rx="18" fill="${c}"/><text x="50" y="55" text-anchor="middle" font-family="Inter, sans-serif" font-size="15" font-weight="800" fill="#0b0b12" letter-spacing="1.5">LABEL</text>` },
  { key: 'ribbon', name: 'Ribbon', category: 'Labels', tags: ['ribbon', 'banner', 'label'], inner: (c) => `<path d="M14 28h72v34H14z" fill="${c}"/><path d="M14 28L0 45l14 17zM86 28l14 17-14 17z" fill="${c}" opacity=".7"/><text x="50" y="51" text-anchor="middle" font-family="Inter, sans-serif" font-size="16" font-weight="900" fill="#0b0b12" letter-spacing="2">BANNER</text>` },
  { key: 'tape', name: 'Tape strip', category: 'Labels', tags: ['tape', 'strip', 'grunge'], inner: (c) => `<g transform="rotate(-7 50 50)"><rect x="-8" y="38" width="116" height="26" fill="${c}" opacity=".9"/><path d="M-8 38l6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6 6-6 6 6" fill="none" stroke="#0b0b12" stroke-opacity=".2" stroke-width="1.5"/></g>` },
  { key: 'speech', name: 'Speech bubble', category: 'Labels', tags: ['speech', 'bubble', 'chat', 'comment'], inner: (c) => `<path d="M12 24a12 12 0 0112-12h52a12 12 0 0112 12v32a12 12 0 01-12 12H44L26 86V68h-2A12 12 0 0112 56z" fill="${c}"/><circle cx="34" cy="40" r="5" fill="#0b0b12" opacity=".35"/><circle cx="50" cy="40" r="5" fill="#0b0b12" opacity=".35"/><circle cx="66" cy="40" r="5" fill="#0b0b12" opacity=".35"/>` },
  { key: 'underline', name: 'Marker underline', category: 'Doodles', tags: ['underline', 'marker', 'highlight'], inner: (c) => `<path d="M4 56c24-20 68-26 92-8" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/><path d="M14 72c22-12 50-16 70-6" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" opacity=".55"/>` },
  { key: 'highlight', name: 'Highlighter', category: 'Doodles', tags: ['highlight', 'marker', 'swipe'], inner: (c) => `<path d="M2 60l30-22 66 8-8 26-66 6z" fill="${c}" opacity=".85"/>` },
  // Doodles
  { key: 'squiggle', name: 'Squiggle', category: 'Doodles', tags: ['squiggle', 'line', 'wave'], inner: (c) => `<path d="M4 54c10-24 20-24 30 0s20 24 30 0 20-24 32 0" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/>` },
  { key: 'spiral', name: 'Spiral', category: 'Doodles', tags: ['spiral', 'swirl', 'line'], inner: (c) => `<path d="M50 50c0-8 10-8 10 0s-12 14-24 8-8-26 8-30 30 10 26 28-22 28-40 20" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>` },
  { key: 'scribble-circle', name: 'Scribble circle', category: 'Doodles', tags: ['circle', 'scribble', 'hand', 'emphasis'], inner: (c) => `<path d="M58 12C26 8 8 30 14 54s34 36 56 26 26-38 8-52" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/><path d="M64 18C34 16 16 34 22 54s30 30 48 22" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>` },
  { key: 'cross-mark', name: 'Cross mark', category: 'Doodles', tags: ['cross', 'x', 'mark', 'no'], inner: (c) => `<path d="M24 24l52 52M76 24L24 76" stroke="${c}" stroke-width="11" stroke-linecap="round"/>` },
  { key: 'checkmark', name: 'Check', category: 'Doodles', tags: ['check', 'tick', 'yes', 'done'], inner: (c) => `<path d="M16 54l24 24 44-50" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'dots', name: 'Dot grid', category: 'Tech', tags: ['dots', 'grid', 'pattern'], inner: (c) => Array.from({ length: 25 }, (_, i) => {
    const x = 10 + (i % 5) * 20, y = 10 + Math.floor(i / 5) * 20;
    return `<circle cx="${x}" cy="${y}" r="${i % 7 === 0 ? 4.2 : 2.4}" fill="${c}" opacity="${i % 7 === 0 ? 1 : 0.55}"/>`;
  }).join('') },
  // Nature
  { key: 'flower', name: 'Flower', category: 'Nature', tags: ['flower', 'bloom', 'nature', 'pretty'], inner: (c) => Array.from({ length: 6 }, (_, i) => `<ellipse cx="50" cy="29" rx="10" ry="21" fill="${c}" opacity=".9" transform="rotate(${i * 60} 50 50)"/>`).join('') + `<circle cx="50" cy="50" r="10" fill="#0b0b12" opacity=".35"/>` },
  { key: 'leaf', name: 'Leaf', category: 'Nature', tags: ['leaf', 'nature', 'eco', 'green'], inner: (c) => `<path d="M84 14C40 14 16 38 16 78c40 0 68-26 68-64z" fill="${c}"/><path d="M20 76C42 60 60 40 76 22" stroke="#0b0b12" stroke-opacity=".28" stroke-width="3" fill="none" stroke-linecap="round"/>` },
  { key: 'cloud', name: 'Cloud', category: 'Nature', tags: ['cloud', 'sky', 'soft'], inner: (c) => `<path d="M28 70a18 18 0 01-2-36 24 24 0 0146-6 18 18 0 014 42z" fill="${c}"/>` },
  { key: 'sun', name: 'Sun', category: 'Nature', tags: ['sun', 'summer', 'warm'], inner: (c) => `<circle cx="50" cy="50" r="20" fill="${c}"/>` + Array.from({ length: 12 }, (_, i) => `<path d="M50 12v10M50 78v10M12 50h10M78 50h10M23 23l7 7M70 70l7 7M77 23l-7 7M30 70l-7 7" stroke="${c}" stroke-width="5" stroke-linecap="round" transform="rotate(${i * 30} 50 50)"/>`).join('') },
  // Tech
  { key: 'cpu', name: 'Chip', category: 'Tech', tags: ['chip', 'tech', 'ai', 'cpu'], inner: (c) => `<rect x="26" y="26" width="48" height="48" rx="10" fill="none" stroke="${c}" stroke-width="6"/><rect x="40" y="40" width="20" height="20" rx="4" fill="${c}"/><path d="M38 26V12M50 26V12M62 26V12M38 88V74M50 88V74M62 88V74M26 38H12M26 50H12M26 62H12M88 38H74M88 50H74M88 62H74" stroke="${c}" stroke-width="5" stroke-linecap="round"/>` },
  { key: 'wifi', name: 'Signal', category: 'Tech', tags: ['wifi', 'signal', 'network'], inner: (c) => `<path d="M12 40a54 54 0 0176 0M26 54a36 36 0 0148 0M39 68a18 18 0 0122 0" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="82" r="6" fill="${c}"/>` },
  { key: 'circuit', name: 'Circuit', category: 'Tech', tags: ['circuit', 'tech', 'line'], inner: (c) => `<path d="M10 24h24v22h18M52 46V22h20M72 22v46h18M10 78h30V58M60 78h30" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/><circle cx="34" cy="24" r="5" fill="${c}"/><circle cx="52" cy="72" r="5" fill="${c}"/><circle cx="90" cy="68" r="5" fill="${c}"/>` },
  // Frames
  { key: 'frame-corner', name: 'Corner frame', category: 'Frames', tags: ['frame', 'corner', 'border'], inner: (c) => `<path d="M8 36V8h28M92 64v28H64M8 8h84v84H8z" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>` },
  { key: 'frame-dashed', name: 'Dashed frame', category: 'Frames', tags: ['frame', 'dashed', 'border'], inner: (c) => `<rect x="8" y="8" width="84" height="84" rx="14" fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="10 8" stroke-linecap="round"/>` },
  { key: 'frame-ticket', name: 'Ticket frame', category: 'Frames', tags: ['ticket', 'frame', 'coupon'], inner: (c) => `<path d="M10 30a10 10 0 0110-10h60a10 10 0 0110 10v8a12 12 0 000 24v8a10 10 0 01-10 10H20a10 10 0 01-10-10v-8a12 12 0 000-24z" fill="none" stroke="${c}" stroke-width="5"/>` },
];

const PREFIX: Record<StickerCategory, string> = {
  Badges: 'badge', Arrows: 'arrow', Bursts: 'burst', Doodles: 'doodle', Labels: 'label', Nature: 'nature', Tech: 'tech', Frames: 'frame',
};

let cache: Sticker[] | null = null;

export function getStickers(): Sticker[] {
  if (cache) return cache;
  const out: Sticker[] = [];
  for (const base of BASES) {
    const colors = COLORWAYS.filter((c) => (base.category === 'Badges' || base.category === 'Labels') ? c !== C.white || true : true);
    colors.forEach((color, i) => {
      const suffix = Object.entries(C).find(([, v]) => v === color)?.[0] ?? `c${i}`;
      out.push({
        id: `${PREFIX[base.category]}-${base.key}-${suffix}`,
        name: `${base.name} · ${suffix}`,
        category: base.category,
        tags: [...base.tags, suffix],
        color,
        src: svg(base.inner(color), color),
      });
    });
  }
  cache = out;
  return out;
}

export const STICKER_CATEGORIES: StickerCategory[] = ['Badges', 'Bursts', 'Arrows', 'Labels', 'Doodles', 'Nature', 'Tech', 'Frames'];

export const STICKER_COUNT = () => getStickers().length;

export function searchStickers(query: string, category: StickerCategory | 'All' = 'All', limit = 400): Sticker[] {
  const q = query.trim().toLowerCase();
  return getStickers()
    .filter((s) => (category === 'All' || s.category === category) && (!q || s.name.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q))))
    .slice(0, limit);
}
