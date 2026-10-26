/** Manual cut-out toolkit — all local canvas work, no model calls, no hidden magic.
 *  The user paints or picks exactly what disappears (or what stays). */
export type CutoutTool = 'erase' | 'restore' | 'wand' | 'key' | 'rect';

export interface StrokePoint { x: number; y: number }

export interface CutoutSettings {
  brushSize: number;
  softness: number;
  tolerance: number;
  contiguous: boolean;
}

export function makeMask(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Stamp a soft round brush along a stroke. `erase` removes paint, `paint` adds it. */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  size: number,
  softness: number,
  mode: 'paint' | 'erase',
) {
  if (!points.length) return;
  const r = Math.max(1, size / 2);
  const hard = Math.max(0, 1 - Math.min(1, Math.max(0, softness)));
  ctx.save();
  ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
  const stamp = (p: StrokePoint) => {
    const g = ctx.createRadialGradient(p.x, p.y, r * hard, p.x, p.y, r);
    if (mode === 'erase') {
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
    } else {
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  stamp(points[0]);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.35)));
    for (let s = 1; s <= steps; s++) {
      stamp({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
    }
  }
  ctx.restore();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0];
}

function dist2(r: number, g: number, b: number, tr: number, tg: number, tb: number) {
  const dr = r - tr, dg = g - tg, db = b - tb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Global colour key: every pixel within `tolerance` of `color` becomes mask paint. */
export function keyColourMask(
  source: ImageData,
  color: string,
  tolerance: number,
): ImageData {
  const [tr, tg, tb] = hexToRgb(color);
  const out = new ImageData(source.width, source.height);
  const src = source.data;
  const dst = out.data;
  const limit = Math.max(0, Math.min(255, tolerance)) * 1.8;
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] === 0) { dst[i + 3] = 0; continue; }
    const d = dist2(src[i], src[i + 1], src[i + 2], tr, tg, tb);
    if (d <= limit) {
      dst[i] = 255; dst[i + 1] = 255; dst[i + 2] = 255;
      dst[i + 3] = Math.round(255 * (1 - d / Math.max(1, limit)));
    }
  }
  return out;
}

/** Magic wand: contiguous flood from one point, bounded by colour distance. */
export function floodSelect(
  source: ImageData,
  x: number,
  y: number,
  tolerance: number,
): ImageData {
  const { width: w, height: h, data: src } = source;
  const out = new ImageData(w, h);
  const dst = out.data;
  const idx = (px: number, py: number) => (py * w + px) * 4;
  const sx = Math.max(0, Math.min(w - 1, Math.round(x)));
  const sy = Math.max(0, Math.min(h - 1, Math.round(y)));
  const sr = src[idx(sx, sy)], sg = src[idx(sx, sy) + 1], sb = src[idx(sx, sy) + 2], sa = src[idx(sx, sy) + 3];
  const limit = Math.max(0, Math.min(255, tolerance)) * 1.8;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [sx, sy];
  while (stack.length) {
    const py = stack.pop()!;
    const px = stack.pop()!;
    if (px < 0 || py < 0 || px >= w || py >= h) continue;
    const p = py * w + px;
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    const d = dist2(src[i], src[i + 1], src[i + 2], sr, sg, sb);
    if (d > limit || Math.abs(src[i + 3] - sa) > 40) continue;
    dst[i] = 255; dst[i + 1] = 255; dst[i + 2] = 255; dst[i + 3] = 255;
    stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
  }
  return out;
}

/** Feather the mask edge with a separable box blur so the cut-out doesn't look cut. */
export function featherMask(data: ImageData, radius: number): ImageData {
  const r = Math.max(0, Math.round(radius));
  if (!r) return data;
  const { width: w, height: h } = data;
  const src = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) src[i] = data.data[i * 4 + 3];
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) sum += src[row + Math.max(0, Math.min(w - 1, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / (r * 2 + 1);
      sum -= src[row + Math.max(0, Math.min(w - 1, x - r))];
      sum += src[row + Math.max(0, Math.min(w - 1, x + r + 1))];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / (r * 2 + 1);
      sum -= tmp[Math.max(0, Math.min(h - 1, y - r)) * w + x];
      sum += tmp[Math.max(0, Math.min(h - 1, y + r + 1)) * w + x];
    }
  }
  const res = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const a = Math.max(0, Math.min(255, out[i]));
    res.data[i * 4] = 255; res.data[i * 4 + 1] = 255; res.data[i * 4 + 2] = 255; res.data[i * 4 + 3] = a;
  }
  return res;
}

/** Composite the original against the mask, honouring remove/keep semantics. */
export function composeCutout(
  base: HTMLImageElement | HTMLCanvasElement,
  mask: HTMLCanvasElement,
  mode: 'remove' | 'keep',
): HTMLCanvasElement {
  const out = makeMask(mask.width, mask.height);
  const ctx = out.getContext('2d')!;
  if (mode === 'keep') {
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(base, 0, 0, out.width, out.height);
  } else {
    ctx.drawImage(base, 0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(mask, 0, 0);
  }
  ctx.globalCompositeOperation = 'source-over';
  return out;
}

/** Render just the painted silhouette against a checkerboard (for store thumbnails). */
export function maskPreview(mask: HTMLCanvasElement, mode: 'remove' | 'keep'): string {
  const out = makeMask(mask.width, mask.height);
  const ctx = out.getContext('2d')!;
  const s = 8;
  for (let y = 0; y < out.height; y += s) {
    for (let x = 0; x < out.width; x += s) {
      ctx.fillStyle = ((x / s + y / s) | 0) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.28)';
      ctx.fillRect(x, y, s, s);
    }
  }
  ctx.globalAlpha = mode === 'keep' ? 0.9 : 0.55;
  ctx.drawImage(mask, 0, 0);
  return out.toDataURL('image/png');
}
