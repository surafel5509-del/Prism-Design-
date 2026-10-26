import type { Effect, Gradient, Layer, Project, TextAnimator } from './types';
import { layerQuad, localMatrix, resolveLayer, textAnimatorState, worldMatrix } from './animation';

export interface ViewTransform { zoom: number; panX: number; panY: number }
export interface RenderOptions {
  showBackground?: boolean;
  showGuides?: boolean;
  pixelRatio?: number;
  quality?: number; // 0..1 multiplier for heavy effects during scrubbing
}

const imageCache = new Map<string, { img: HTMLImageElement; loaded: boolean; error: boolean }>();

export function getImage(src: string): HTMLImageElement | null {
  if (typeof window === 'undefined' || !src) return null;
  let entry = imageCache.get(src);
  if (!entry) {
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    const e = { img, loaded: false, error: false };
    img.onload = () => { e.loaded = true; };
    img.onerror = () => { e.error = true; };
    img.src = src;
    imageCache.set(src, e);
    entry = e;
  }
  return entry.loaded ? entry.img : null;
}

export function preloadImage(src: string) { getImage(src); }

// ── Manual cut-out cache (painted alpha masks from the background remover) ───
const cutoutCache = new Map<string, { canvas: HTMLCanvasElement; done: boolean }>();

function getCutout(layer: Layer): HTMLCanvasElement | null {
  if (!layer.cutout?.src || !layer.media?.src || typeof document === 'undefined') return null;
  const key = `${layer.media.src}::${layer.cutout.src}::${layer.cutout.mode}`;
  const hit = cutoutCache.get(key);
  if (hit && hit.done) return hit.canvas;
  const base = getImage(layer.media.src);
  const mask = getImage(layer.cutout.src);
  if (!base || !mask) return null;
  const entry = hit ?? { canvas: document.createElement('canvas'), done: false };
  cutoutCache.set(key, entry);
  const c = entry.canvas;
  c.width = base.width || 1;
  c.height = base.height || 1;
  const cctx = c.getContext('2d');
  if (!cctx) return null;
  cctx.clearRect(0, 0, c.width, c.height);
  if (layer.cutout.mode === 'keep') {
    cctx.drawImage(mask, 0, 0, c.width, c.height);
    cctx.globalCompositeOperation = 'source-in';
    cctx.drawImage(base, 0, 0, c.width, c.height);
  } else {
    cctx.drawImage(base, 0, 0, c.width, c.height);
    cctx.globalCompositeOperation = 'destination-out';
    cctx.drawImage(mask, 0, 0, c.width, c.height);
  }
  cctx.globalCompositeOperation = 'source-over';
  entry.done = true;
  return c;
}

// ── Video frame cache (image-to-motion, imports, precomps) ───────────────────
const videoCache = new Map<string, { el: HTMLVideoElement; ready: boolean }>();

export function getVideo(src: string): HTMLVideoElement | null {
  if (typeof window === 'undefined' || !src) return null;
  let entry = videoCache.get(src);
  if (!entry) {
    const el = document.createElement('video');
    el.crossOrigin = 'anonymous';
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.loop = true;
    const e = { el, ready: false };
    el.addEventListener('loadeddata', () => { e.ready = true; });
    el.src = src;
    videoCache.set(src, e);
    entry = e;
  }
  return entry.ready ? entry.el : null;
}

export function setVideosPlaying(playing: boolean) {
  for (const { el } of videoCache.values()) {
    if (playing) { el.play().catch(() => undefined); } else { el.pause(); }
  }
}

/** Advances a video element to the timeline time, seeking only when it drifts. */
function syncVideo(el: HTMLVideoElement, layer: Layer, time: number) {
  const trim = layer.media?.trimStart ?? 0;
  const rate = layer.media?.playbackRate ?? 1;
  const local = trim + Math.max(0, time - layer.startTime) * rate;
  const target = Number.isFinite(el.duration) && el.duration > 0 ? Math.min(local, el.duration - 0.03) : local;
  if (Math.abs(el.currentTime - target) > 0.28) {
    try { el.currentTime = Math.max(0, target); } catch { /* not seekable yet */ }
  }
}

// ───────────────────────────── Paint helpers ──────────────────────────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0];
}

export function withAlpha(color: string, alpha: number): string {
  if (!color) return `rgba(0,0,0,${alpha})`;
  if (color.startsWith('rgba') || color.startsWith('hsla')) return color;
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('');
}

export function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readableOn(hex: string) { return luminance(hex) > 0.45 ? '#0b0b12' : '#ffffff'; }

function makeGradient(ctx: CanvasRenderingContext2D, g: Gradient, w: number, h: number, alpha = 1): CanvasGradient | string {
  const stops = (g.stops ?? []).slice().sort((a, b) => a.offset - b.offset);
  if (stops.length === 0) return '#ffffff';
  if (g.type === 'radial') {
    const c = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.4);
    stops.forEach((s) => c.addColorStop(Math.max(0, Math.min(1, s.offset)), withAlpha(s.color, (s.opacity ?? 1) * alpha)));
    return c;
  }
  if (g.type === 'conic') {
    const c = ctx.createConicGradient(((g.angle ?? 0) * Math.PI) / 180, w / 2, h / 2);
    stops.forEach((s) => c.addColorStop(Math.max(0, Math.min(1, s.offset)), withAlpha(s.color, (s.opacity ?? 1) * alpha)));
    return c;
  }
  const angle = ((g.angle ?? 90) * Math.PI) / 180;
  const cx = w / 2, cy = h / 2;
  const len = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
  const dx = (Math.cos(angle) * len) / 2;
  const dy = (Math.sin(angle) * len) / 2;
  const c = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  stops.forEach((s) => c.addColorStop(Math.max(0, Math.min(1, s.offset)), withAlpha(s.color, (s.opacity ?? 1) * alpha)));
  return c;
}

export function roundRectPath(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(0, 0, w, h, radius);
  } else {
    ctx.moveTo(radius, 0);
    ctx.lineTo(w - radius, 0); ctx.arcTo(w, 0, w, radius, radius);
    ctx.lineTo(w, h - radius); ctx.arcTo(w, h, w - radius, h, radius);
    ctx.lineTo(radius, h); ctx.arcTo(0, h, 0, h - radius, radius);
    ctx.lineTo(0, radius); ctx.arcTo(0, 0, radius, 0, radius);
    ctx.closePath();
  }
}

function polygonPath(ctx: CanvasRenderingContext2D, w: number, h: number, sides: number, inner?: number) {
  const cx = w / 2, cy = h / 2;
  const rx = w / 2, ry = h / 2;
  const n = Math.max(3, Math.round(sides));
  ctx.beginPath();
  if (inner !== undefined && inner > 0) {
    const steps = n * 2;
    for (let i = 0; i < steps; i++) {
      const ang = (i / steps) * Math.PI * 2 - Math.PI / 2;
      const f = i % 2 === 0 ? 1 : inner;
      const px = cx + Math.cos(ang) * rx * f;
      const py = cy + Math.sin(ang) * ry * f;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(ang) * rx;
      const py = cy + Math.sin(ang) * ry;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

function starPath(ctx: CanvasRenderingContext2D, w: number, h: number, points: number, innerRatio: number) {
  const n = Math.max(3, Math.round(points));
  polygonPath(ctx, w, h, n, Math.max(0.05, Math.min(0.95, innerRatio)));
}


// ── Extended shape paths ────────────────────────────────────────────
function ringPath(ctx: CanvasRenderingContext2D, w: number, h: number, thickness: number) {
  const t = Math.max(0.05, Math.min(0.9, thickness));
  const rx = w / 2, ry = h / 2, cx = w / 2, cy = h / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, false);
  ctx.ellipse(cx, cy, rx * t, ry * t, 0, 0, Math.PI * 2, true);
}

function halfCirclePath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath();
  ctx.ellipse(w / 2, h, w / 2, h, 0, Math.PI, Math.PI * 2);
  ctx.closePath();
}

function quarterCirclePath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.ellipse(0, h, w, h, 0, -Math.PI / 2, 0);
  ctx.closePath();
}

function chevronPath(ctx: CanvasRenderingContext2D, w: number, h: number, notch: number) {
  const n = Math.max(0.1, Math.min(0.8, notch)) * w;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w - n, 0);
  ctx.lineTo(w, h / 2);
  ctx.lineTo(w - n, h);
  ctx.lineTo(0, h);
  ctx.lineTo(n, h / 2);
  ctx.closePath();
}

function crossPath(ctx: CanvasRenderingContext2D, w: number, h: number, arm: number) {
  const a = Math.max(0.12, Math.min(0.48, arm));
  const x0 = w * (0.5 - a / 2), x1 = w * (0.5 + a / 2);
  const y0 = h * (0.5 - a / 2), y1 = h * (0.5 + a / 2);
  ctx.beginPath();
  ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.lineTo(x1, y0); ctx.lineTo(w, y0);
  ctx.lineTo(w, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, h); ctx.lineTo(x0, h);
  ctx.lineTo(x0, y1); ctx.lineTo(0, y1); ctx.lineTo(0, y0); ctx.lineTo(x0, y0);
  ctx.closePath();
}

function quadPath(ctx: CanvasRenderingContext2D, w: number, h: number, topInset: number, bottomInset: number) {
  ctx.beginPath();
  ctx.moveTo(w * topInset, 0);
  ctx.lineTo(w * (1 - topInset), 0);
  ctx.lineTo(w * (1 - bottomInset), h);
  ctx.lineTo(w * bottomInset, h);
  ctx.closePath();
}

function burstPath(ctx: CanvasRenderingContext2D, w: number, h: number, points: number, innerRatio: number, seed = 3) {
  const n = Math.max(4, Math.round(points));
  const jitter = (i: number) => {
    const v = Math.sin((i + 1) * 12.9898 + (seed || 1) * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  const cx = w / 2, cy = h / 2;
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const ang = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const outer = i % 2 === 0;
    const f = outer ? 1 : Math.max(0.12, Math.min(0.9, innerRatio)) * (0.82 + jitter(i) * 0.34);
    const px = cx + Math.cos(ang) * (w / 2) * f;
    const py = cy + Math.sin(ang) * (h / 2) * f;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const x = 0, y = h * 0.08;
  ctx.beginPath();
  ctx.moveTo(w / 2, y + h * 0.22);
  ctx.bezierCurveTo(w * 0.18, y - h * 0.12, x - w * 0.06, y + h * 0.42, w / 2, h);
  ctx.bezierCurveTo(w * 1.06, y + h * 0.42, w * 0.82, y - h * 0.12, w / 2, y + h * 0.22);
  ctx.closePath();
}

function cloudPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath();
  ctx.arc(w * 0.28, h * 0.62, h * 0.3, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(w * 0.48, h * 0.42, h * 0.34, Math.PI * 1.05, Math.PI * 1.85);
  ctx.arc(w * 0.7, h * 0.56, h * 0.28, Math.PI * 1.4, Math.PI * 0.42);
  ctx.arc(w * 0.52, h * 0.72, h * 0.24, Math.PI * 0.05, Math.PI * 0.95);
  ctx.closePath();
}

function wavePath(ctx: CanvasRenderingContext2D, w: number, h: number, cycles: number) {
  const n = Math.max(1, Math.round(cycles));
  const steps = 48;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = h / 2 - Math.sin(t * Math.PI * 2 * n) * (h * 0.42);
    ctx.lineTo(t * w, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
}

function pillArrowPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = h / 2;
  const headW = Math.min(w * 0.34, h * 0.9);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - headW, 0);
  ctx.lineTo(w - headW, -h * 0.22);
  ctx.lineTo(w, h / 2);
  ctx.lineTo(w - headW, h * 1.22);
  ctx.lineTo(w - headW, h);
  ctx.lineTo(r, h);
  ctx.arc(0, r, r, Math.PI / 2, Math.PI * 1.5, true);
  ctx.closePath();
}

// ───────────────────────────── Effects ──────────────────────────────

export function motionFx(layer: Layer, time: number) {
  let scale = 1, x = 0, y = 0;
  for (const e of layer.effects ?? []) {
    if (!e.enabled) continue;
    const a = e.amount;
    const speed = e.speed ?? 1;
    if (e.type === 'wiggle') {
      x += Math.sin(time * speed * 3.1) * (a / 100) * 42;
      y += Math.cos(time * speed * 2.6) * (a / 100) * 28;
    } else if (e.type === 'drift') {
      x += Math.sin(time * speed * 0.9) * (a / 100) * 90;
      y += Math.cos(time * speed * 0.7) * (a / 100) * 60;
    } else if (e.type === 'beatPulse') {
      const beat = Math.max(0, Math.sin(time * speed * Math.PI * 2));
      scale *= 1 + beat * (a / 100) * 0.24;
    }
  }
  return { scale, x, y };
}

function buildFilter(layer: Layer, effects: Effect[], time: number, quality: number): string {
  const parts: string[] = [];
  const r = resolveLayer(layer, time);
  if (r.blur > 0) parts.push(`blur(${(r.blur * quality).toFixed(2)}px)`);
  if (r.brightness !== 100) parts.push(`brightness(${r.brightness}%)`);
  if (r.saturate !== 100) parts.push(`saturate(${r.saturate}%)`);
  if (r.hue) parts.push(`hue-rotate(${r.hue}deg)`);
  for (const e of effects) {
    if (!e.enabled) continue;
    const a = e.amount;
    const pulse = 0.6 + 0.4 * Math.sin(time * (e.speed ?? 1) * 2);
    switch (e.type) {
      case 'blur': parts.push(`blur(${(a / 10).toFixed(2)}px)`); break;
      case 'brightness': parts.push(`brightness(${100 + a}%)`); break;
      case 'contrast': parts.push(`contrast(${100 + a}%)`); break;
      case 'saturate': parts.push(`saturate(${100 + a}%)`); break;
      case 'hue': parts.push(`hue-rotate(${a * 3.6}deg)`); break;
      case 'grayscale': parts.push(`grayscale(${Math.min(100, a)}%)`); break;
      case 'sepia': parts.push(`sepia(${Math.min(100, a)}%)`); break;
      case 'invert': parts.push(`invert(${Math.min(100, a)}%)`); break;
      case 'pixelate': parts.push(`contrast(${100 + a / 2}%) blur(${(a / 30) * pulse}px)`); break;
      case 'bloom': parts.push(`brightness(${100 + a / 3}%) saturate(${120 + a / 2}%)`); break;
      case 'thermal': parts.push(`hue-rotate(${180 + a * 1.2}deg) saturate(${160 + a}%) contrast(${115 + a / 3}%)`); break;
      case 'posterize': parts.push(`contrast(${100 + a * 1.4}%) saturate(${100 + a / 2}%) brightness(${100 + a / 5}%)`); break;
      case 'hologram': parts.push(`saturate(${140 + a / 2}%) hue-rotate(${160 + a}deg) brightness(${104 + a / 6}%)`); break;
      case 'vhs': parts.push(`saturate(${115 + a / 4}%) contrast(${102 + a / 8}%)`); break;
      default: break;
    }
  }
  return parts.length ? parts.join(' ') : 'none';
}

// Deterministic particles
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawParticles(ctx: CanvasRenderingContext2D, layer: Layer, time: number, w: number, h: number) {
  const p = layer.particles;
  if (!p) return;
  const rand = mulberry32(p.seed ?? 1337);
  const count = Math.max(1, Math.min(600, p.count));
  for (let i = 0; i < count; i++) {
    const sx = rand(), sy = rand(), sv = 0.4 + rand() * 0.9, size = p.size * (0.4 + rand() * 1.2);
    const drift = (time * p.speed * sv) % (h + 100);
    const px = ((sx * w + Math.sin(time * sv + i) * p.spread) % w + w) % w;
    const py = (sy * h + drift + time * p.gravity * 40 * sv) % (h + 100);
    ctx.globalAlpha = 0.25 + rand() * 0.6;
    ctx.fillStyle = p.color;
    if (p.shape === 'square') ctx.fillRect(px, py - 100, size, size);
    else if (p.shape === 'star') {
      ctx.save(); ctx.translate(px, py - 100); starPath(ctx, size * 2, size * 2, 5, 0.45); ctx.fill(); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(px, py - 100, size / 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawEffectOverlays(ctx: CanvasRenderingContext2D, layer: Layer, time: number, w: number, h: number, quality: number) {
  for (const e of layer.effects) {
    if (!e.enabled) continue;
    switch (e.type) {
      case 'glow': {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.min(1, e.amount / 60);
        ctx.shadowColor = e.color || layer.fill || '#8b5cf6';
        ctx.shadowBlur = (e.blur ?? 24) * quality;
        ctx.fillStyle = e.color || layer.fill;
        ctx.fillRect(w * 0.1, h * 0.1, w * 0.8, h * 0.8);
        ctx.restore();
        break;
      }
      case 'lightSweep': {
        const sweep = ((time * (e.speed ?? 0.5)) % 2) - 0.5;
        const gx = w * sweep;
        const grad = ctx.createLinearGradient(gx, 0, gx + w * 0.5, h);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, withAlpha(e.color ?? '#ffffff', Math.min(0.85, e.amount / 100)));
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        break;
      }
      case 'vignette': {
        const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, e.amount / 100)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        break;
      }
      case 'duotone': {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, e.color || '#8b5cf6');
        g.addColorStop(1, e.color2 || '#22d3ee');
        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.globalAlpha = Math.min(1, e.amount / 70);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = Math.min(0.5, e.amount / 220);
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        break;
      }
      case 'hologram': {
        ctx.save();
        const sheen = ((time * (e.speed ?? 0.6)) % 1);
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, 'rgba(34,211,238,0.10)');
        g.addColorStop(Math.max(0, sheen - 0.12), 'rgba(232,121,249,0.05)');
        g.addColorStop(Math.min(1, sheen), `rgba(255,255,255,${Math.min(0.5, e.amount / 160)})`);
        g.addColorStop(1, 'rgba(34,211,238,0.06)');
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = 'rgba(0,0,0,1)';
        const gap = Math.max(2, 6 - e.amount / 22);
        for (let y = (time * 18) % gap; y < h; y += gap) ctx.fillRect(0, y, w, 1);
        ctx.restore();
        break;
      }
      case 'vhs': {
        ctx.save();
        ctx.globalAlpha = Math.min(0.35, e.amount / 260);
        ctx.fillStyle = '#000';
        for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
        const bandY = (time * (e.speed ?? 40) * 6) % (h + 120) - 60;
        ctx.globalAlpha = Math.min(0.22, e.amount / 340);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, bandY, w, 18);
        ctx.globalAlpha = Math.min(0.16, e.amount / 500);
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(0, bandY + 4, w, 3);
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(0, bandY + 9, w, 2);
        ctx.restore();
        break;
      }
      case 'halftone': {
        ctx.save();
        ctx.globalAlpha = Math.min(0.55, e.amount / 160);
        ctx.fillStyle = e.color || '#0b0b12';
        const step = Math.max(3, 12 - e.amount / 12);
        for (let y = 0; y < h; y += step) {
          for (let x = (Math.round(y / step) % 2) * (step / 2); x < w; x += step) {
            const r = (step / 2) * (0.4 + 0.5 * Math.abs(Math.sin(x * 0.05 + y * 0.04 + time * 0.6)));
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
        break;
      }
      case 'spotlight': {
        const ang = time * (e.speed ?? 0.4);
        const cx = w * (0.5 + Math.cos(ang) * 0.32);
        const cy = h * (0.5 + Math.sin(ang * 1.3) * 0.3);
        const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.04, cx, cy, Math.max(w, h) * 0.72);
        const strength = Math.min(0.95, e.amount / 100);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.35})`);
        g.addColorStop(1, `rgba(0,0,0,${strength})`);
        ctx.save();
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        break;
      }
      case 'noise': case 'grain': {
        const rand = mulberry32(Math.floor((e.type === 'grain' ? time * (e.speed ?? 12) : 1) * 97));
        const density = Math.min(0.5, e.amount / 500);
        ctx.save();
        ctx.globalAlpha = e.type === 'grain' ? density * 2 : density;
        for (let i = 0; i < Math.min(1400, (w * h) / 900); i++) {
          const x = rand() * w, y = rand() * h;
          ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000';
          ctx.fillRect(x, y, 1.4, 1.4);
        }
        ctx.restore();
        break;
      }
      case 'scanlines': {
        ctx.save();
        ctx.globalAlpha = Math.min(0.6, e.amount / 120);
        ctx.fillStyle = e.color || '#000000';
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
        ctx.restore();
        break;
      }
      case 'chromatic': {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ff0044'; ctx.fillRect(-e.amount / 8, 0, w, h);
        ctx.fillStyle = '#00ffee'; ctx.fillRect(e.amount / 8, 0, w, h);
        ctx.restore();
        break;
      }
      default: break;
    }
  }
}

// ───────────────────────────── Text ──────────────────────────────

export interface TextLine { text: string; width: number }

export function layoutText(ctx: CanvasRenderingContext2D, content: string, maxWidth: number, font: string, letterSpacing: number): TextLine[] {
  ctx.font = font;
  const paragraphs = String(content ?? '').split('\n');
  const lines: TextLine[] = [];
  const measure = (s: string) => ctx.measureText(s).width + Math.max(0, s.length - 1) * letterSpacing;
  for (const para of paragraphs) {
    if (maxWidth <= 0) { lines.push({ text: para, width: measure(para) }); continue; }
    const words = para.split(/(\s+)/);
    let line = '';
    for (const word of words) {
      const test = line + word;
      if (measure(test) > maxWidth && line.trim().length > 0) {
        lines.push({ text: line.replace(/\s+$/, ''), width: measure(line) });
        line = word.replace(/^\s+/, '');
      } else line = test;
    }
    lines.push({ text: line, width: measure(line) });
  }
  return lines;
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: Layer, time: number, w: number, h: number) {
  const t = layer.text;
  if (!t) return;
  const size = layer.keyframes.fontSize ? resolveLayer(layer, time).fontSize : t.fontSize;
  const ls = layer.keyframes.letterSpacing ? resolveLayer(layer, time).letterSpacing : t.letterSpacing;
  const weight = t.fontWeight ?? 600;
  const style = t.fontStyle ?? 'normal';
  const font = `${style} ${weight} ${size}px ${t.fontFamily}, Inter, system-ui, sans-serif`;
  const pad = t.padding ?? 0;
  const content = t.uppercase ? t.content.toUpperCase() : t.content;
  const lines = layoutText(ctx, content, Math.max(10, w - pad * 2), font, ls);
  const lh = size * (t.lineHeight ?? 1.2);
  const totalH = lines.length * lh;
  const anim = textAnimatorState(layer, time);
  const animType = t.animator?.type;

  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = t.align === 'center' ? 'center' : t.align === 'right' ? 'right' : 'left';
  const alignX = t.align === 'center' ? w / 2 : t.align === 'right' ? w - pad : pad;

  const fillStyle: string | CanvasGradient = t.gradient ? makeGradient(ctx, t.gradient, w, h) : t.color || '#ffffff';

  const drawRun = (text: string, x: number, y: number, alpha: number, dy = 0, scale = 1, blur = 0) => {
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (blur > 0) ctx.filter = `blur(${blur}px)`;
    ctx.translate(x, y + dy);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, 0, 0);
    if (t.stroke && (t.strokeWidth ?? 0) > 0) {
      ctx.strokeStyle = t.stroke;
      ctx.lineWidth = t.strokeWidth ?? 1;
      ctx.strokeText(text, 0, 0);
    }
    ctx.restore();
  };

  const drawCharSpaced = (text: string, x: number, y: number, alpha: number, perChar?: (i: number) => { dy: number; scale: number; alpha: number; blur: number }) => {
    if (ls === 0 && !perChar) { drawRun(text, x, y, alpha); return; }
    const chars = Array.from(text);
    let cx = 0;
    const widths = chars.map((c) => ctx.measureText(c).width + ls);
    const full = widths.reduce((a, b) => a + b, 0) - (chars.length ? ls : 0);
    let origin = 0;
    if (t.align === 'center') origin = -full / 2;
    else if (t.align === 'right') origin = -full;
    chars.forEach((c, i) => {
      const extra = perChar ? perChar(i) : { dy: 0, scale: 1, alpha: 1, blur: 0 };
      drawRun(c, origin + cx, y, alpha * extra.alpha, extra.dy, extra.scale, extra.blur);
      cx += widths[i];
    });
  };

  lines.forEach((line, li) => {
    const y = li * lh + lh / 2 + pad;
    if (!anim || !animType) { drawCharSpaced(line.text, alignX, y, 1); return; }
    const chars = Array.from(line.text);
    const total = Math.max(1, chars.length);
    const stagger = t.animator?.stagger ?? 0.03;
    const local = Math.max(0, Math.min(1, (anim.progress * (t.animator?.duration ?? 0.6) - li * stagger) / Math.max(0.001, t.animator?.duration ?? 0.6)));
    switch (animType) {
      case 'typewriter': {
        const visible = Math.floor(total * anim.progress);
        drawCharSpaced(chars.slice(0, visible).join(''), alignX, y, 1);
        break;
      }
      case 'wordReveal': {
        const words = line.text.split(' ');
        const per = words.length ? anim.progress * words.length : 0;
        let wx = 0;
        const totalW = words.reduce((a, wd) => a + ctx.measureText(wd + ' ').width + ls, 0);
        if (t.align === 'center') wx = -totalW / 2; else if (t.align === 'right') wx = -totalW;
        words.forEach((wd, wi) => {
          const a = Math.max(0, Math.min(1, per - wi));
          if (a > 0) drawRun(wd, alignX + wx, y, a);
          wx += ctx.measureText(wd + ' ').width + ls;
        });
        break;
      }
      case 'charRise':
        drawCharSpaced(line.text, alignX, y, 1, (i) => {
          const p = Math.max(0, Math.min(1, local * total - i));
          return { dy: (1 - p) * size * 0.7, scale: 1, alpha: p, blur: (1 - p) * 6 };
        });
        break;
      case 'slideUp': {
        drawRun(line.text, alignX, y, local, (1 - local) * lh, 1, (1 - local) * 8);
        break;
      }
      case 'blurIn':
        drawRun(line.text, alignX, y, local, 0, 1, (1 - local) * 18);
        break;
      case 'scaleIn':
        drawCharSpaced(line.text, alignX, y, local, () => ({ dy: 0, scale: 0.7 + 0.3 * local, alpha: 1, blur: (1 - local) * 4 }));
        break;
      default: drawCharSpaced(line.text, alignX, y, 1);
    }
  });

  if (t.underline) {
    lines.forEach((line, li) => {
      const y = li * lh + lh / 2 + pad + size * 0.6;
      const startX = t.align === 'center' ? alignX - line.width / 2 : t.align === 'right' ? alignX - line.width : alignX;
      ctx.fillStyle = fillStyle;
      ctx.fillRect(startX, y, line.width, Math.max(1, size * 0.06));
    });
  }
  void totalH;
}

// ───────────────────────────── Layer drawing ──────────────────────────────

export function drawLayer(ctx: CanvasRenderingContext2D, project: Project, layer: Layer, time: number, opts: RenderOptions = {}) {
  const r = resolveLayer(layer, time);
  if (!r.visible) return;
  const quality = opts.quality ?? 1;
  ctx.save();
  ctx.globalAlpha = r.opacity;
  ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
  const m = localMatrix(layer, time);
  const fx = motionFx(layer, time);
  ctx.transform(m[0] * fx.scale, m[1], m[2], m[3] * fx.scale, m[4] + fx.x, m[5] + fx.y);
  if (r.skewX || r.skewY) { /* skew baked into matrix */ }
  const filter = buildFilter(layer, layer.effects, time, quality);
  if (filter !== 'none') ctx.filter = filter;

  if (layer.mask) {
    ctx.beginPath();
    if (layer.mask.type === 'ellipse') ctx.ellipse(r.w / 2, r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
    else if (layer.mask.type === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, 0, r.h);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, r.w, r.h);
      ctx.beginPath(); ctx.rect(0, 0, r.w, r.h);
    } else ctx.rect(0, 0, r.w, r.h);
    ctx.clip();
  }

  const paint = layer.fillGradient ? makeGradient(ctx, layer.fillGradient, r.w, r.h) : layer.fill;

  if (layer.type === 'group') {
    // root group passes: draw children already handled by scene order
  } else if (layer.type === 'text') {
    drawTextLayer(ctx, { ...layer, w: r.w, h: r.h }, time, r.w, r.h);
  } else if (layer.type === 'image' || layer.type === 'video' || layer.type === 'lottie') {
    const video = layer.type === 'video' && layer.media?.src ? getVideo(layer.media.src) : null;
    const img = !video && layer.media?.src ? getImage(layer.media.src) : null;
    const cut = video ? null : getCutout(layer);
    const source: CanvasImageSource | null = cut ?? video ?? img;
    if (source) {
      if (video) syncVideo(video, layer, time);
      ctx.save();
      roundRectPath(ctx, r.w, r.h, r.cornerRadius);
      ctx.clip();
      const sw = cut ? cut.width : video ? (video.videoWidth || r.w) : (img as HTMLImageElement).width;
      const sh = cut ? cut.height : video ? (video.videoHeight || r.h) : (img as HTMLImageElement).height;
      const fit = layer.media?.fit ?? 'cover';
      const scale = fit === 'contain' ? Math.min(r.w / sw, r.h / sh) : fit === 'fill' ? 1 : Math.max(r.w / sw, r.h / sh);
      const dw = fit === 'fill' ? r.w : sw * scale;
      const dh = fit === 'fill' ? r.h : sh * scale;
      ctx.drawImage(source, (r.w - dw) / 2, (r.h - dh) / 2, dw, dh);
      ctx.restore();
    } else {
      roundRectPath(ctx, r.w, r.h, r.cornerRadius);
      ctx.fillStyle = 'rgba(139,92,246,0.14)';
      ctx.fill();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = 'rgba(139,92,246,0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `500 ${Math.max(12, Math.min(28, r.w / 20))}px Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(layer.name || 'Media', r.w / 2, r.h / 2);
      ctx.textAlign = 'left';
    }
  } else if (layer.type === 'particles') {
    drawParticles(ctx, layer, time, r.w, r.h);
  } else if (layer.type === 'path' && layer.path) {
    const p = new Path2D(layer.path);
    ctx.fillStyle = paint;
    ctx.fill(p);
    if (layer.stroke) { ctx.strokeStyle = layer.stroke; ctx.lineWidth = r.strokeWidth || 1; ctx.stroke(p); }
  } else {
    // shapes
    const kind = layer.shape ?? 'rect';
    switch (kind) {
      case 'ellipse': ctx.beginPath(); ctx.ellipse(r.w / 2, r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2); break;
      case 'polygon': case 'triangle': polygonPath(ctx, r.w, r.h, kind === 'triangle' ? 3 : layer.points ?? 6); break;
      case 'hexagon': polygonPath(ctx, r.w, r.h, 6); break;
      case 'diamond': polygonPath(ctx, r.w, r.h, 4); break;
      case 'star': starPath(ctx, r.w, r.h, layer.points ?? 5, layer.innerRadius ?? 0.45); break;
      case 'line': ctx.beginPath(); ctx.moveTo(0, r.h / 2); ctx.lineTo(r.w, r.h / 2); break;
      case 'arrow': {
        ctx.beginPath();
        const shaft = r.h * 0.34;
        const headW = Math.min(r.w * 0.32, r.h * 1.2);
        ctx.moveTo(0, r.h / 2 - shaft / 2);
        ctx.lineTo(r.w - headW, r.h / 2 - shaft / 2);
        ctx.lineTo(r.w - headW, 0);
        ctx.lineTo(r.w, r.h / 2);
        ctx.lineTo(r.w - headW, r.h);
        ctx.lineTo(r.w - headW, r.h / 2 + shaft / 2);
        ctx.lineTo(0, r.h / 2 + shaft / 2);
        ctx.closePath();
        break;
      }
      case 'roundedRect': roundRectPath(ctx, r.w, r.h, r.cornerRadius ?? Math.min(r.w, r.h) * 0.18); break;
      case 'capsule': roundRectPath(ctx, r.w, r.h, Math.min(r.w, r.h) / 2); break;
      case 'squircle': roundRectPath(ctx, r.w, r.h, Math.min(r.w, r.h) * 0.34); break;
      case 'octagon': polygonPath(ctx, r.w, r.h, 8); break;
      case 'pentagon': polygonPath(ctx, r.w, r.h, 5); break;
      case 'ring': ringPath(ctx, r.w, r.h, layer.innerRadius ?? 0.55); break;
      case 'halfCircle': halfCirclePath(ctx, r.w, r.h); break;
      case 'quarterCircle': quarterCirclePath(ctx, r.w, r.h); break;
      case 'chevron': chevronPath(ctx, r.w, r.h, layer.innerRadius ?? 0.4); break;
      case 'cross': crossPath(ctx, r.w, r.h, layer.innerRadius ?? 0.34); break;
      case 'parallelogram': quadPath(ctx, r.w, r.h, 0.22, 0.22); break;
      case 'trapezoid': quadPath(ctx, r.w, r.h, 0.18, -0.18); break;
      case 'burst': burstPath(ctx, r.w, r.h, layer.points ?? 12, layer.innerRadius ?? 0.62, layer.meta?.seed as number | undefined); break;
      case 'heart': heartPath(ctx, r.w, r.h); break;
      case 'cloud': cloudPath(ctx, r.w, r.h); break;
      case 'wave': wavePath(ctx, r.w, r.h, layer.points ?? 4); break;
      case 'pillArrow': pillArrowPath(ctx, r.w, r.h); break;
      default: roundRectPath(ctx, r.w, r.h, 0);
    }
    if (kind === 'line') {
      ctx.strokeStyle = layer.stroke || (typeof paint === 'string' ? paint : '#ffffff');
      ctx.lineWidth = Math.max(1, r.strokeWidth || layer.h || 2);
      ctx.lineCap = 'round';
      ctx.stroke();
    } else {
      ctx.fillStyle = paint;
      ctx.fill();
      if (layer.stroke && (r.strokeWidth ?? 0) > 0) {
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = r.strokeWidth;
        ctx.stroke();
      }
    }
  }

  drawEffectOverlays(ctx, layer, time, r.w, r.h, quality);
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, project: Project, time: number, opts: RenderOptions = {}) {
  const { width, height, background, backgroundGradient, layers } = project;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  if (opts.showBackground !== false) {
    ctx.fillStyle = backgroundGradient ? makeGradient(ctx, backgroundGradient, width, height) : background || '#0b0b12';
    ctx.fillRect(0, 0, width, height);
  }
  const byParent = new Map<string, Layer[]>();
  for (const l of layers) {
    const key = l.parentId ?? '__root__';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(l);
  }
  // Children of a group live in the group's local coordinate space.
  const drawChildren = (parentId: string) => {
    for (const l of byParent.get(parentId) ?? []) {
      drawLayer(ctx, project, l, time, opts);
      if (l.type === 'group') {
        ctx.save();
        const m = localMatrix(l, time);
        ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        drawChildren(l.id);
        ctx.restore();
      }
    }
  };
  drawChildren('__root__');
  ctx.restore();
}

// ───────────────────────────── Overlay (selection / guides) ──────────────────────────────

export interface OverlayOptions {
  selectedIds: string[];
  hoverId?: string | null;
  showGuides?: boolean;
  project: Project;
  view: ViewTransform;
  width: number;
  height: number;
  snapLines?: { x?: number | null; y?: number | null };
}

export function drawOverlay(ctx: CanvasRenderingContext2D, project: Project, time: number, o: OverlayOptions) {
  const { width, height, view } = o;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(view.panX, view.panY);
  ctx.scale(view.zoom, view.zoom);

  if (o.hoverId) {
    const l = project.layers.find((x) => x.id === o.hoverId);
    if (l && !o.selectedIds.includes(l.id)) {
      const quad = layerQuad(l, project.layers, time);
      ctx.beginPath();
      quad.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.strokeStyle = 'rgba(139,92,246,0.8)';
      ctx.lineWidth = 1 / view.zoom;
      ctx.stroke();
    }
  }

  for (const id of o.selectedIds) {
    const l = project.layers.find((x) => x.id === id);
    if (!l) continue;
    const quad = layerQuad(l, project.layers, time);
    ctx.beginPath();
    quad.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.5 / view.zoom;
    ctx.setLineDash([]);
    ctx.stroke();

    if (o.selectedIds.length === 1 && l.type !== 'group') {
      const hs = 7 / view.zoom;
      quad.forEach(([x, y]) => {
        ctx.fillStyle = '#0b0b12';
        ctx.strokeStyle = '#a78bfa';
        ctx.lineWidth = 1.5 / view.zoom;
        ctx.beginPath();
        ctx.rect(x - hs / 2, y - hs / 2, hs, hs);
        ctx.fill(); ctx.stroke();
      });
      // midpoints
      for (let i = 0; i < 4; i++) {
        const a = quad[i], b = quad[(i + 1) % 4];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        ctx.beginPath();
        ctx.arc(mx, my, hs * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = '#0b0b12'; ctx.fill(); ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1.5 / view.zoom; ctx.stroke();
      }
      if (l.motionPath?.points?.length) {
        ctx.beginPath();
        l.motionPath.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = 'rgba(34,211,238,0.85)';
        ctx.setLineDash([6 / view.zoom, 4 / view.zoom]);
        ctx.lineWidth = 1.5 / view.zoom;
        ctx.stroke();
        ctx.setLineDash([]);
        l.motionPath.points.forEach(([x, y]) => {
          ctx.beginPath(); ctx.arc(x, y, 3.5 / view.zoom, 0, Math.PI * 2);
          ctx.fillStyle = '#22d3ee'; ctx.fill();
        });
      }
    }
  }

  if (o.snapLines?.x != null) {
    ctx.beginPath();
    ctx.moveTo(o.snapLines.x, -2000);
    ctx.lineTo(o.snapLines.x, 4000);
    ctx.strokeStyle = 'rgba(232,121,249,0.85)';
    ctx.lineWidth = 1 / view.zoom;
    ctx.setLineDash([5 / view.zoom, 4 / view.zoom]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (o.snapLines?.y != null) {
    ctx.beginPath();
    ctx.moveTo(-2000, o.snapLines.y);
    ctx.lineTo(4000, o.snapLines.y);
    ctx.strokeStyle = 'rgba(232,121,249,0.85)';
    ctx.lineWidth = 1 / view.zoom;
    ctx.setLineDash([5 / view.zoom, 4 / view.zoom]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // artboard border above everything
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(view.panX, view.panY, project.width * view.zoom, project.height * view.zoom);
  ctx.restore();
  void width; void height;
}
