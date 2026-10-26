import { nanoid } from "nanoid";
import type { PrismProject } from "./types";
import { DEFAULT_BRAND, makeKeyframe, makeLayer } from "./layers";

export interface TemplateMeta {
  id: string;
  name: string;
  category: string;
  description: string;
  width: number;
  height: number;
  duration: number;
  accent: string;
  build: () => PrismProject;
}

function base(meta: Pick<TemplateMeta, "width" | "height" | "duration">, name: string, background: string): PrismProject {
  const now = new Date().toISOString();
  return {
    id: nanoid(12),
    name,
    width: meta.width,
    height: meta.height,
    fps: 30,
    duration: meta.duration,
    background,
    backgroundGradient: null,
    layers: [],
    brandKit: DEFAULT_BRAND,
    createdAt: now,
    updatedAt: now,
  };
}

const fadeUp = (layerIdTime: number, y: number, dy = 60, dur = 0.8) => [
  makeKeyframe({ time: layerIdTime, property: "opacity", value: 0, easing: "linear" }),
  makeKeyframe({ time: layerIdTime + dur, property: "opacity", value: 1, easing: "easeOutCubic" }),
  makeKeyframe({ time: layerIdTime, property: "y", value: y + dy, easing: "linear" }),
  makeKeyframe({ time: layerIdTime + dur, property: "y", value: y, easing: "easeOutCubic" }),
];

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "neon-product-launch", name: "Neon Product Launch", category: "Motion Ads",
    description: "Cinematic dark launch title with glow and kinetic type.", width: 1920, height: 1080, duration: 6, accent: "#7c3aed",
    build() {
      const p = base(this, "Neon Product Launch", "#07070d");
      p.backgroundGradient = { kind: "radial", stops: [{ offset: 0, color: "#2e1065" }, { offset: 0.55, color: "#0b0b14" }, { offset: 1, color: "#07070d" }] };
      const orb = makeLayer({ type: "ellipse", name: "Glow Orb", x: 710, y: 240, width: 500, height: 500, fill: "#7c3aed", opacity: 0.55, effects: [{ id: nanoid(6), type: "glow", color: "#7c3aed", blur: 90, opacity: 0.9 }], keyframes: [makeKeyframe({ time: 0, property: "scale", value: 0.4, easing: "linear" }), makeKeyframe({ time: 2.2, property: "scale", value: 1.15, easing: "easeOutCubic" }), makeKeyframe({ time: 6, property: "scale", value: 1, easing: "easeInOut" })] });
      const kicker = makeLayer({ type: "text", name: "Kicker", text: "INTRODUCING", x: 460, y: 300, width: 1000, height: 60, fill: "#06b6d4", fontSize: 34, fontWeight: 600, letterSpacing: 14, keyframes: fadeUp(0.3, 300, 30, 0.7) });
      const title = makeLayer({ type: "text", name: "Headline", text: "AURORA X1", x: 260, y: 380, width: 1400, height: 190, fill: "#ffffff", fontSize: 150, fontWeight: 700, letterSpacing: 2, keyframes: [makeKeyframe({ time: 0.6, property: "opacity", value: 0, easing: "linear" }), makeKeyframe({ time: 1.6, property: "opacity", value: 1, easing: "easeOutCubic" }), makeKeyframe({ time: 0.6, property: "scale", value: 0.82, easing: "linear" }), makeKeyframe({ time: 1.6, property: "scale", value: 1, easing: "easeOutBack" })], effects: [{ id: nanoid(6), type: "glow", color: "#06b6d4", blur: 34, opacity: 0.55 }] });
      const sub = makeLayer({ type: "text", name: "Subhead", text: "Beyond fast. Beyond light. Available 11.11", x: 460, y: 590, width: 1000, height: 60, fill: "#cbd5e1", fontSize: 36, fontWeight: 400, fontFamily: "Inter", keyframes: fadeUp(1.4, 590, 36, 0.8) });
      const rule = makeLayer({ type: "rect", name: "Accent Rule", x: 860, y: 565, width: 200, height: 6, cornerRadius: 3, fill: "#d946ef", gradient: { kind: "linear", angle: 90, stops: [{ offset: 0, color: "#7c3aed" }, { offset: 0.5, color: "#06b6d4" }, { offset: 1, color: "#d946ef" }] }, keyframes: [makeKeyframe({ time: 1.1, property: "scaleX", value: 0, easing: "linear" }), makeKeyframe({ time: 1.9, property: "scaleX", value: 1, easing: "easeOutCubic" })] });
      p.layers = [orb, rule, kicker, sub, title];
      return p;
    },
  },
  {
    id: "ig-sale-post", name: "Instagram Flash Sale", category: "Social",
    description: "Bold square sale post with badge pop.", width: 1080, height: 1080, duration: 4, accent: "#ec4899",
    build() {
      const p = base(this, "Instagram Flash Sale", "#ec4899");
      p.backgroundGradient = { kind: "linear", angle: 140, stops: [{ offset: 0, color: "#7c3aed" }, { offset: 1, color: "#ec4899" }] };
      const badge = makeLayer({ type: "star", name: "Sale Badge", x: 720, y: 90, width: 280, height: 280, points: 12, innerRadius: 0.78, fill: "#facc15", keyframes: [makeKeyframe({ time: 0.4, property: "scale", value: 0, easing: "linear" }), makeKeyframe({ time: 1.1, property: "scale", value: 1, easing: "easeOutElastic" }), makeKeyframe({ time: 0.4, property: "rotation", value: -30, easing: "linear" }), makeKeyframe({ time: 1.1, property: "rotation", value: 12, easing: "easeOutBack" })] });
      const off = makeLayer({ type: "text", name: "Discount", text: "-50%", x: 750, y: 175, width: 220, height: 110, fill: "#111827", fontSize: 72, fontWeight: 700, rotation: 12, keyframes: fadeUp(0.6, 175, 0, 0.4) });
      const title = makeLayer({ type: "text", name: "Headline", text: "FLASH\nSALE", x: 90, y: 300, width: 900, height: 360, fill: "#ffffff", fontSize: 170, fontWeight: 700, lineHeight: 0.95, align: "left", keyframes: fadeUp(0.15, 300, 70, 0.7), effects: [{ id: nanoid(6), type: "shadow", color: "#000000", blur: 0, offsetX: 8, offsetY: 8, opacity: 0.35 }] });
      const cta = makeLayer({ type: "rect", name: "CTA Button", x: 90, y: 800, width: 420, height: 96, cornerRadius: 48, fill: "#111827" });
      const ctaText = makeLayer({ type: "text", name: "CTA Label", text: "SHOP NOW →", x: 90, y: 826, width: 420, height: 50, fill: "#ffffff", fontSize: 34, fontWeight: 700, letterSpacing: 2 });
      const note = makeLayer({ type: "text", name: "Note", text: "Ends Sunday · Online only", x: 90, y: 930, width: 600, height: 44, fill: "#fde68a", fontSize: 28, fontWeight: 600, align: "left", fontFamily: "Inter" });
      p.layers = [badge, title, cta, note, off, ctaText];
      return p;
    },
  },
  {
    id: "yt-thumbnail", name: "YouTube Thumbnail", category: "Social",
    description: "High-contrast thumbnail with pop text.", width: 1280, height: 720, duration: 3, accent: "#facc15",
    build() {
      const p = base(this, "YouTube Thumbnail", "#0f172a");
      p.backgroundGradient = { kind: "linear", angle: 120, stops: [{ offset: 0, color: "#1e3a8a" }, { offset: 1, color: "#0f172a" }] };
      const panel = makeLayer({ type: "rect", name: "Subject Panel", x: 760, y: 60, width: 460, height: 600, cornerRadius: 36, fill: "#f59e0b", gradient: { kind: "linear", angle: 160, stops: [{ offset: 0, color: "#f59e0b" }, { offset: 1, color: "#ef4444" }] } });
      const emoji = makeLayer({ type: "text", name: "Subject", text: "🚀", x: 820, y: 220, width: 340, height: 260, fill: "#ffffff", fontSize: 200, keyframes: [makeKeyframe({ time: 0.2, property: "scale", value: 0.6, easing: "linear" }), makeKeyframe({ time: 0.9, property: "scale", value: 1.05, easing: "easeOutBack" })] });
      const l1 = makeLayer({ type: "text", name: "Line 1", text: "I BUILT THIS", x: 50, y: 110, width: 700, height: 130, fill: "#ffffff", fontSize: 104, fontWeight: 700, align: "left", keyframes: fadeUp(0.1, 110, 40, 0.5) });
      const l2 = makeLayer({ type: "text", name: "Line 2", text: "IN 24 HOURS!", x: 50, y: 250, width: 700, height: 130, fill: "#facc15", fontSize: 104, fontWeight: 700, align: "left", keyframes: fadeUp(0.3, 250, 40, 0.5), effects: [{ id: nanoid(6), type: "shadow", color: "#000000", blur: 0, offsetX: 6, offsetY: 6, opacity: 0.5 }] });
      const chip = makeLayer({ type: "rect", name: "Duration Chip", x: 1050, y: 620, width: 180, height: 64, cornerRadius: 12, fill: "#000000", opacity: 0.85 });
      const chipT = makeLayer({ type: "text", name: "Duration", text: "12:47", x: 1050, y: 634, width: 180, height: 40, fill: "#ffffff", fontSize: 30, fontWeight: 700, fontFamily: "JetBrains Mono" });
      p.layers = [panel, emoji, l1, l2, chip, chipT];
      return p;
    },
  },
  {
    id: "story-promo", name: "Vertical Story Promo", category: "Social",
    description: "9:16 story with stacked kinetic type.", width: 1080, height: 1920, duration: 5, accent: "#06b6d4",
    build() {
      const p = base(this, "Vertical Story Promo", "#0b0b14");
      p.backgroundGradient = { kind: "linear", angle: 170, stops: [{ offset: 0, color: "#312e81" }, { offset: 1, color: "#0b0b14" }] };
      const words = ["CREATE.", "ANIMATE.", "SHIP IT."];
      const layers = words.map((w, i) => makeLayer({ type: "text", name: `Word ${i + 1}`, text: w, x: 90, y: 620 + i * 190, width: 900, height: 170, fill: i === 2 ? "#06b6d4" : "#ffffff", fontSize: 138, fontWeight: 700, align: "left", keyframes: [makeKeyframe({ time: 0.3 + i * 0.7, property: "x", value: -700, easing: "linear" }), makeKeyframe({ time: 0.9 + i * 0.7, property: "x", value: 90, easing: "easeOutCubic" }), makeKeyframe({ time: 0.3 + i * 0.7, property: "opacity", value: 0, easing: "linear" }), makeKeyframe({ time: 0.9 + i * 0.7, property: "opacity", value: 1, easing: "easeOutCubic" })] }));
      const handle = makeLayer({ type: "text", name: "Handle", text: "@yourbrand", x: 90, y: 1700, width: 500, height: 50, fill: "#a5b4fc", fontSize: 34, fontWeight: 600, align: "left", fontFamily: "Inter" });
      const swipe = makeLayer({ type: "text", name: "Swipe Hint", text: "SWIPE UP ↑", x: 340, y: 1500, width: 400, height: 50, fill: "#ffffff", fontSize: 30, fontWeight: 700, letterSpacing: 4, keyframes: [makeKeyframe({ time: 3, property: "y", value: 1516, easing: "linear" }), makeKeyframe({ time: 3.5, property: "y", value: 1484, easing: "easeInOut" }), makeKeyframe({ time: 4, property: "y", value: 1516, easing: "easeInOut" })] });
      p.layers = [...layers, swipe, handle];
      return p;
    },
  },
  {
    id: "logo-reveal", name: "Logo Reveal", category: "Intros",
    description: "Minimal mark draw-in with wordmark fade.", width: 1920, height: 1080, duration: 4, accent: "#f8fafc",
    build() {
      const p = base(this, "Logo Reveal", "#ffffff");
      const mark = makeLayer({ type: "polygon", name: "Logo Mark", x: 860, y: 330, width: 200, height: 200, points: 3, fill: "#7c3aed", gradient: { kind: "linear", angle: 135, stops: [{ offset: 0, color: "#7c3aed" }, { offset: 0.5, color: "#06b6d4" }, { offset: 1, color: "#d946ef" }] }, keyframes: [makeKeyframe({ time: 0.2, property: "scale", value: 0, easing: "linear" }), makeKeyframe({ time: 1.2, property: "scale", value: 1, easing: "easeOutElastic" }), makeKeyframe({ time: 0.2, property: "rotation", value: -120, easing: "linear" }), makeKeyframe({ time: 1.2, property: "rotation", value: 0, easing: "easeOutCubic" })] });
      const word = makeLayer({ type: "text", name: "Wordmark", text: "PRISM", x: 560, y: 580, width: 800, height: 120, fill: "#0b0b14", fontSize: 96, fontWeight: 700, letterSpacing: 26, keyframes: [makeKeyframe({ time: 1, property: "opacity", value: 0, easing: "linear" }), makeKeyframe({ time: 1.9, property: "opacity", value: 1, easing: "easeOutCubic" })] });
      const tag = makeLayer({ type: "text", name: "Tagline", text: "design in motion", x: 560, y: 715, width: 800, height: 50, fill: "#64748b", fontSize: 32, fontWeight: 400, fontFamily: "Inter", letterSpacing: 6, keyframes: fadeUp(1.4, 715, 24, 0.8) });
      p.layers = [mark, word, tag];
      return p;
    },
  },
  {
    id: "lower-third", name: "Broadcast Lower Third", category: "Titles",
    description: "Name + title bar with slide-in accent.", width: 1920, height: 1080, duration: 5, accent: "#06b6d4",
    build() {
      const p = base(this, "Broadcast Lower Third", "#111827");
      const bar = makeLayer({ type: "rect", name: "Bar", x: 120, y: 800, width: 760, height: 150, fill: "#ffffff", keyframes: [makeKeyframe({ time: 0.3, property: "scaleX", value: 0, easing: "linear" }), makeKeyframe({ time: 1, property: "scaleX", value: 1, easing: "easeOutCubic" })] });
      const accent = makeLayer({ type: "rect", name: "Accent", x: 120, y: 800, width: 14, height: 150, fill: "#06b6d4" });
      const name = makeLayer({ type: "text", name: "Name", text: "Alex Morgan", x: 170, y: 822, width: 680, height: 64, fill: "#0b0b14", fontSize: 52, fontWeight: 700, align: "left", keyframes: fadeUp(0.7, 822, 18, 0.5) });
      const role = makeLayer({ type: "text", name: "Role", text: "Creative Director · Studio North", x: 170, y: 892, width: 680, height: 40, fill: "#475569", fontSize: 28, fontWeight: 500, align: "left", fontFamily: "Inter", keyframes: fadeUp(0.9, 892, 18, 0.5) });
      p.layers = [bar, accent, name, role];
      return p;
    },
  },
  {
    id: "kinetic-quote", name: "Kinetic Quote", category: "Titles",
    description: "Word-by-word quote animation.", width: 1920, height: 1080, duration: 6, accent: "#d946ef",
    build() {
      const p = base(this, "Kinetic Quote", "#0b0b14");
      const lines: [string, string, number][] = [["“Design is", "#ffffff", 0.3], ["intelligence", "#d946ef", 1.1], ["made visible.”", "#ffffff", 1.9]];
      p.layers = lines.map(([text, fill, t], i) => makeLayer({ type: "text", name: `Line ${i + 1}`, text, x: 260, y: 320 + i * 170, width: 1400, height: 150, fill, fontSize: 124, fontWeight: 700, fontFamily: i === 1 ? "Playfair Display" : "Space Grotesk", keyframes: [makeKeyframe({ time: t, property: "opacity", value: 0, easing: "linear" }), makeKeyframe({ time: t + 0.6, property: "opacity", value: 1, easing: "easeOutCubic" }), makeKeyframe({ time: t, property: "y", value: 380 + i * 170, easing: "linear" }), makeKeyframe({ time: t + 0.6, property: "y", value: 320 + i * 170, easing: "easeOutBack" })] }));
      p.layers.push(makeLayer({ type: "text", name: "Attribution", text: "— ALINA WHEELER", x: 260, y: 860, width: 1400, height: 44, fill: "#94a3b8", fontSize: 28, fontWeight: 600, letterSpacing: 5, fontFamily: "Inter", keyframes: fadeUp(2.8, 860, 20, 0.6) }));
      return p;
    },
  },
  {
    id: "event-poster", name: "Event Poster", category: "Print & Posters",
    description: "A-format poster with date block.", width: 1240, height: 1754, duration: 4, accent: "#f59e0b",
    build() {
      const p = base(this, "Event Poster", "#fef3c7");
      const sun = makeLayer({ type: "ellipse", name: "Sun", x: 820, y: 120, width: 340, height: 340, fill: "#f59e0b" });
      const title = makeLayer({ type: "text", name: "Festival Name", text: "SOLSTICE\nFEST 2026", x: 90, y: 560, width: 1060, height: 420, fill: "#1c1917", fontSize: 172, fontWeight: 700, lineHeight: 0.95, align: "left", fontFamily: "Bebas Neue", letterSpacing: 2 });
      const acts = makeLayer({ type: "text", name: "Lineup", text: "NOVA REY · THE FRACTALS · KAIRO · LUMEN\n+ 40 MORE ARTISTS", x: 90, y: 1040, width: 1060, height: 110, fill: "#44403c", fontSize: 34, fontWeight: 600, align: "left", fontFamily: "Inter", lineHeight: 1.5 });
      const dateBlock = makeLayer({ type: "rect", name: "Date Block", x: 90, y: 1300, width: 1060, height: 180, fill: "#1c1917" });
      const date = makeLayer({ type: "text", name: "Date", text: "JUN 19 — 21 · RIVERSIDE PARK", x: 90, y: 1362, width: 1060, height: 70, fill: "#fef3c7", fontSize: 46, fontWeight: 700, letterSpacing: 3 });
      const url = makeLayer({ type: "text", name: "URL", text: "solsticefest.example", x: 90, y: 1560, width: 1060, height: 44, fill: "#78716c", fontSize: 30, fontWeight: 600, fontFamily: "JetBrains Mono" });
      p.layers = [sun, title, acts, dateBlock, date, url];
      return p;
    },
  },
  {
    id: "podcast-cover", name: "Podcast Cover", category: "Social",
    description: "Square cover art with mic badge.", width: 1400, height: 1400, duration: 3, accent: "#22c55e",
    build() {
      const p = base(this, "Podcast Cover", "#052e16");
      p.backgroundGradient = { kind: "radial", stops: [{ offset: 0, color: "#14532d" }, { offset: 1, color: "#052e16" }] };
      const mic = makeLayer({ type: "text", name: "Mic", text: "🎙️", x: 450, y: 180, width: 500, height: 420, fill: "#ffffff", fontSize: 330 });
      const title = makeLayer({ type: "text", name: "Show Title", text: "SIGNAL &\nNOISE", x: 100, y: 640, width: 1200, height: 360, fill: "#ffffff", fontSize: 160, fontWeight: 700, lineHeight: 0.98 });
      const host = makeLayer({ type: "text", name: "Host", text: "WITH Alex Morgan · NEW EPISODES WEEKLY", x: 100, y: 1120, width: 1200, height: 50, fill: "#86efac", fontSize: 32, fontWeight: 600, letterSpacing: 3, fontFamily: "Inter" });
      p.layers = [mic, title, host];
      return p;
    },
  },
  {
    id: "web-banner", name: "SaaS Web Banner", category: "Ads",
    description: "Wide banner with CTA and proof point.", width: 1600, height: 600, duration: 4, accent: "#6366f1",
    build() {
      const p = base(this, "SaaS Web Banner", "#eef2ff");
      const headline = makeLayer({ type: "text", name: "Headline", text: "Ship motion graphics\n10× faster with AI", x: 80, y: 120, width: 900, height: 200, fill: "#1e1b4b", fontSize: 78, fontWeight: 700, align: "left", lineHeight: 1.05, keyframes: fadeUp(0.2, 120, 40, 0.7) });
      const sub = makeLayer({ type: "text", name: "Subhead", text: "★★★★★ Loved by 12,000+ design teams", x: 80, y: 350, width: 800, height: 44, fill: "#4f46e5", fontSize: 30, fontWeight: 600, align: "left", fontFamily: "Inter" });
      const cta = makeLayer({ type: "rect", name: "CTA", x: 1180, y: 240, width: 340, height: 110, cornerRadius: 24, fill: "#4f46e5", keyframes: [makeKeyframe({ time: 0.6, property: "scale", value: 0.7, easing: "linear" }), makeKeyframe({ time: 1.2, property: "scale", value: 1, easing: "easeOutBack" })] });
      const ctaT = makeLayer({ type: "text", name: "CTA Label", text: "Try free →", x: 1180, y: 272, width: 340, height: 50, fill: "#ffffff", fontSize: 36, fontWeight: 700 });
      p.layers = [headline, sub, cta, ctaT];
      return p;
    },
  },
  {
    id: "countdown", name: "Countdown Intro", category: "Intros",
    description: "3-2-1 countdown with scale punches.", width: 1920, height: 1080, duration: 4, accent: "#ef4444",
    build() {
      const p = base(this, "Countdown Intro", "#0b0b14");
      const nums = ["3", "2", "1"];
      p.layers = nums.map((n, i) => makeLayer({ type: "text", name: `Count ${n}`, text: n, x: 660, y: 300, width: 600, height: 480, fill: "#ffffff", fontSize: 420, fontWeight: 700, startTime: i * 0.9, duration: 0.9, keyframes: [makeKeyframe({ time: i * 0.9, property: "scale", value: 1.6, easing: "linear" }), makeKeyframe({ time: i * 0.9 + 0.7, property: "scale", value: 0.9, easing: "easeOutCubic" }), makeKeyframe({ time: i * 0.9, property: "opacity", value: 1, easing: "linear" }), makeKeyframe({ time: i * 0.9 + 0.8, property: "opacity", value: 0.15, easing: "easeIn" })] }));
      p.layers.push(makeLayer({ type: "text", name: "Go", text: "GO!", x: 460, y: 380, width: 1000, height: 320, fill: "#22c55e", fontSize: 280, fontWeight: 700, startTime: 2.7, duration: 1.3, keyframes: [makeKeyframe({ time: 2.7, property: "scale", value: 0.4, easing: "linear" }), makeKeyframe({ time: 3.3, property: "scale", value: 1, easing: "easeOutElastic" })] }));
      return p;
    },
  },
  {
    id: "minimal-quote-card", name: "Minimal Quote Card", category: "Social",
    description: "Editorial card for social feeds.", width: 1080, height: 1350, duration: 3, accent: "#0ea5e9",
    build() {
      const p = base(this, "Minimal Quote Card", "#ffffff");
      const rule = makeLayer({ type: "rect", name: "Rule", x: 90, y: 150, width: 90, height: 10, fill: "#0ea5e9" });
      const quote = makeLayer({ type: "text", name: "Quote", text: "Simplicity is the hardest feature to ship.", x: 90, y: 240, width: 900, height: 520, fill: "#0f172a", fontSize: 92, fontWeight: 600, align: "left", fontFamily: "Playfair Display", lineHeight: 1.25 });
      const author = makeLayer({ type: "text", name: "Author", text: "Alex Morgan — HEAD OF DESIGN", x: 90, y: 900, width: 900, height: 44, fill: "#64748b", fontSize: 28, fontWeight: 700, letterSpacing: 3, align: "left", fontFamily: "Inter" });
      const brand = makeLayer({ type: "text", name: "Brand", text: "◆ prism/studio", x: 90, y: 1180, width: 500, height: 44, fill: "#0ea5e9", fontSize: 30, fontWeight: 700, align: "left" });
      p.layers = [rule, quote, author, brand];
      return p;
    },
  },
];

export function getTemplate(id: string): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
