import { nanoid } from "nanoid";
import type { AgentOp } from "./types";
import { makeKeyframe, makeLayer } from "./layers";

/**
 * OFFLINE SCENE BUILDER — deterministic, rule-based, NOT AI.
 * Lets users exercise the full build → animate → preview pipeline before
 * connecting a provider key. It is always labeled as a template engine in
 * the UI; the Agent path only ever runs real provider API calls.
 */

export interface OfflineStep {
  narration: string;
  toolName: string;
  ops: AgentOp[];
}

const PALETTES: Record<string, { bg: string; bg2: string; a: string; b: string; c: string; fg: string }> = {
  neon: { bg: "#07070d", bg2: "#2e1065", a: "#7c3aed", b: "#06b6d4", c: "#d946ef", fg: "#ffffff" },
  sunset: { bg: "#1c0a00", bg2: "#7c2d12", a: "#f97316", b: "#facc15", c: "#ef4444", fg: "#fff7ed" },
  ocean: { bg: "#082f49", bg2: "#0c4a6e", a: "#0ea5e9", b: "#22d3ee", c: "#2dd4bf", fg: "#f0f9ff" },
  forest: { bg: "#052e16", bg2: "#14532d", a: "#22c55e", b: "#a3e635", c: "#34d399", fg: "#f0fdf4" },
  mono: { bg: "#fafafa", bg2: "#e5e5e5", a: "#111827", b: "#374151", c: "#6b7280", fg: "#111827" },
  candy: { bg: "#fdf2f8", bg2: "#fbcfe8", a: "#ec4899", b: "#a855f7", c: "#f472b6", fg: "#500724" },
};

function pickPalette(prompt: string) {
  const p = prompt.toLowerCase();
  if (/(sunset|warm|orange|autumn|coffee|summer)/.test(p)) return PALETTES.sunset;
  if (/(ocean|sea|blue|water|tech|saas|finance)/.test(p)) return PALETTES.ocean;
  if (/(forest|green|eco|nature|organic|health)/.test(p)) return PALETTES.forest;
  if (/(minimal|mono|clean|editorial|black and white|swiss)/.test(p)) return PALETTES.mono;
  if (/(pink|candy|beauty|fashion|playful|kids)/.test(p)) return PALETTES.candy;
  return PALETTES.neon;
}

function pickSize(prompt: string): { w: number; h: number; label: string } {
  const p = prompt.toLowerCase();
  if (/(story|reel|tiktok|vertical|9:16)/.test(p)) return { w: 1080, h: 1920, label: "Story 1080×1920" };
  if (/(instagram|ig post|square|1:1)/.test(p)) return { w: 1080, h: 1080, label: "Instagram 1080×1080" };
  if (/(thumbnail|youtube)/.test(p)) return { w: 1280, h: 720, label: "YouTube 1280×720" };
  if (/(poster|flyer|print|a4)/.test(p)) return { w: 1240, h: 1754, label: "Poster 1240×1754" };
  if (/(banner|header|cover)/.test(p)) return { w: 1600, h: 600, label: "Banner 1600×600" };
  return { w: 1920, h: 1080, label: "HD 1920×1080" };
}

function extractHeadline(prompt: string): { headline: string; sub: string; cta: string } {
  const quoted = prompt.match(/["“](.+?)["”]/);
  if (quoted) return { headline: quoted[1].toUpperCase(), sub: "Crafted with Prism Studio", cta: "LEARN MORE" };
  const p = prompt.toLowerCase();
  if (/sale|discount|off|promo/.test(p)) return { headline: "MEGA SALE", sub: "Up to 50% off — this week only", cta: "SHOP NOW" };
  if (/launch|introduc|new product|release/.test(p)) return { headline: "IT'S HERE", sub: "The next generation has arrived", cta: "DISCOVER" };
  if (/coffee/.test(p)) return { headline: "BREW BOLD", sub: "Small-batch roasts, delivered fresh", cta: "TASTE IT" };
  if (/fitness|gym|workout/.test(p)) return { headline: "TRAIN HARDER", sub: "Your first month is on us", cta: "START FREE" };
  if (/music|concert|festival/.test(p)) return { headline: "LIVE LOUD", sub: "One night only · Tickets on sale now", cta: "GET TICKETS" };
  if (/app|saas|software|startup/.test(p)) return { headline: "WORK SMARTER", sub: "The tool your team will actually love", cta: "TRY FREE" };
  return { headline: "MAKE IT MOVE", sub: "Design that demands attention", cta: "GET STARTED" };
}

export function buildOfflineScene(prompt: string): OfflineStep[] {
  const pal = pickPalette(prompt);
  const { w, h, label } = pickSize(prompt);
  const copy = extractHeadline(prompt);
  const duration = 6;
  const steps: OfflineStep[] = [];

  steps.push({
    narration: `Creating project — ${label}, ${duration}s composition`,
    toolName: "create_project",
    ops: [{
      op: "create_project",
      project: {
        name: copy.headline.charAt(0) + copy.headline.slice(1).toLowerCase(),
        width: w, height: h, fps: 30, duration,
        background: pal.bg,
        backgroundGradient: { kind: "radial", stops: [{ offset: 0, color: pal.bg2 }, { offset: 1, color: pal.bg }] },
      },
    }],
  });

  const orb = makeLayer({
    id: `layer_${nanoid(8)}`, type: "ellipse", name: "Ambient Glow",
    x: w * 0.62, y: h * 0.08, width: w * 0.34, height: w * 0.34,
    fill: pal.a, opacity: 0.5, duration,
    effects: [{ id: nanoid(6), type: "glow", color: pal.a, blur: 80, opacity: 0.85 }],
    keyframes: [
      makeKeyframe({ time: 0, property: "scale", value: 0.5, easing: "linear" }),
      makeKeyframe({ time: 2.4, property: "scale", value: 1.1, easing: "easeOutCubic" }),
      makeKeyframe({ time: duration, property: "scale", value: 1, easing: "easeInOut" }),
    ],
  });
  const ring = makeLayer({
    id: `layer_${nanoid(8)}`, type: "ellipse", name: "Orbit Ring",
    x: w * 0.66, y: h * 0.14, width: w * 0.26, height: w * 0.26,
    fill: "transparent", stroke: pal.b, strokeWidth: Math.max(2, w * 0.003), opacity: 0.7, duration,
    keyframes: [
      makeKeyframe({ time: 0.4, property: "rotation", value: 0, easing: "linear" }),
      makeKeyframe({ time: duration, property: "rotation", value: 360, easing: "linear" }),
      makeKeyframe({ time: 0.4, property: "opacity", value: 0, easing: "linear" }),
      makeKeyframe({ time: 1.2, property: "opacity", value: 0.7, easing: "easeOutCubic" }),
    ],
  });
  steps.push({ narration: "Setting the scene — ambient glow and orbit ring", toolName: "add_shape", ops: [{ op: "add_layer", layer: orb }, { op: "add_layer", layer: ring }] });

  const kicker = makeLayer({
    id: `layer_${nanoid(8)}`, type: "text", name: "Kicker", text: "◆ PRISM STUDIO",
    x: w * 0.08, y: h * 0.3, width: w * 0.84, height: h * 0.05,
    fill: pal.b, fontSize: Math.round(w * 0.02), fontWeight: 600, letterSpacing: 8, align: "left", duration,
    keyframes: [
      makeKeyframe({ time: 0.3, property: "opacity", value: 0, easing: "linear" }),
      makeKeyframe({ time: 0.9, property: "opacity", value: 1, easing: "easeOutCubic" }),
    ],
  });
  const headline = makeLayer({
    id: `layer_${nanoid(8)}`, type: "text", name: "Headline", text: copy.headline,
    x: w * 0.08, y: h * 0.37, width: w * 0.84, height: h * 0.2,
    fill: pal.fg, fontSize: Math.round(w * 0.085), fontWeight: 700, align: "left", lineHeight: 1.02, duration,
    gradient: { kind: "linear", angle: 90, stops: [{ offset: 0, color: pal.fg }, { offset: 1, color: pal.b }] },
    keyframes: [
      makeKeyframe({ time: 0.5, property: "opacity", value: 0, easing: "linear" }),
      makeKeyframe({ time: 1.4, property: "opacity", value: 1, easing: "easeOutCubic" }),
      makeKeyframe({ time: 0.5, property: "y", value: h * 0.37 + h * 0.06, easing: "linear" }),
      makeKeyframe({ time: 1.4, property: "y", value: h * 0.37, easing: "easeOutCubic" }),
    ],
  });
  const sub = makeLayer({
    id: `layer_${nanoid(8)}`, type: "text", name: "Subhead", text: copy.sub,
    x: w * 0.08, y: h * 0.56, width: w * 0.7, height: h * 0.06,
    fill: pal.fg, opacity: 0.85, fontSize: Math.round(w * 0.024), fontWeight: 400, fontFamily: "Inter", align: "left", duration,
    keyframes: [
      makeKeyframe({ time: 1.1, property: "opacity", value: 0, easing: "linear" }),
      makeKeyframe({ time: 1.9, property: "opacity", value: 0.85, easing: "easeOutCubic" }),
    ],
  });
  steps.push({ narration: "Typesetting headline, kicker and subhead", toolName: "add_text", ops: [{ op: "add_layer", layer: kicker }, { op: "add_layer", layer: headline }, { op: "add_layer", layer: sub }] });

  const ctaW = w * 0.24;
  const ctaH = Math.max(44, h * 0.055);
  const cta = makeLayer({
    id: `layer_${nanoid(8)}`, type: "rect", name: "CTA Button",
    x: w * 0.08, y: h * 0.66, width: ctaW, height: ctaH, cornerRadius: ctaH / 2,
    fill: pal.a, gradient: { kind: "linear", angle: 90, stops: [{ offset: 0, color: pal.a }, { offset: 0.5, color: pal.b }, { offset: 1, color: pal.c }] },
    duration,
    keyframes: [
      makeKeyframe({ time: 1.5, property: "scale", value: 0.6, easing: "linear" }),
      makeKeyframe({ time: 2.2, property: "scale", value: 1, easing: "easeOutBack" }),
      makeKeyframe({ time: 1.5, property: "opacity", value: 0, easing: "linear" }),
      makeKeyframe({ time: 2.2, property: "opacity", value: 1, easing: "easeOutCubic" }),
    ],
  });
  const ctaText = makeLayer({
    id: `layer_${nanoid(8)}`, type: "text", name: "CTA Label", text: copy.cta,
    x: w * 0.08, y: h * 0.66 + ctaH * 0.28, width: ctaW, height: ctaH * 0.5,
    fill: "#ffffff", fontSize: Math.round(w * 0.018), fontWeight: 700, letterSpacing: 2, duration,
    keyframes: [
      makeKeyframe({ time: 1.6, property: "opacity", value: 0, easing: "linear" }),
      makeKeyframe({ time: 2.2, property: "opacity", value: 1, easing: "easeOutCubic" }),
    ],
  });
  steps.push({ narration: "Adding call-to-action with pop-in animation", toolName: "add_shape", ops: [{ op: "add_layer", layer: cta }, { op: "add_layer", layer: ctaText }] });

  steps.push({
    narration: "Committing brand palette for consistency",
    toolName: "generate_palette",
    ops: [{ op: "set_brand_kit", brandKit: { name: "Scene Palette", colors: [pal.a, pal.b, pal.c, pal.fg, pal.bg], fonts: { display: "Space Grotesk", body: "Inter" } } }],
  });

  return steps;
}
