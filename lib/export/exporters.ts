import type { Layer, Project } from '@/lib/engine/types';
import { drawScene, getImage } from '@/lib/engine/renderer';
import { resolveLayer, sampleChannel } from '@/lib/engine/animation';
import { downloadBlob, formatBytes } from '@/lib/utils';

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'gif' | 'webm' | 'mp4' | 'lottie' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  width: number;
  height: number;
  fps: number;
  transparent: boolean;
  quality: number;
  startTime: number;
  endTime: number;
  onProgress?: (pct: number, note?: string) => void;
  signal?: AbortSignal;
}

export interface ExportResult { blob: Blob; filename: string; width: number; height: number; format: ExportFormat; note?: string }

const cancelError = () => new DOMException('Export cancelled', 'AbortError');

export function renderFrame(project: Project, time: number, width: number, height: number, transparent = false): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(width / project.width, height / project.height);
  drawScene(ctx, project, time, { showBackground: !transparent, quality: 1 });
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), type, quality));
}

export function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

export async function exportStill(project: Project, opts: ExportOptions, time: number): Promise<ExportResult> {
  opts.onProgress?.(15, 'Rendering frame');
  const canvas = renderFrame(project, time, opts.width, opts.height, opts.transparent && opts.format === 'png');
  const base = `${project.name.replace(/[^\w\-]+/g, '-').toLowerCase()}-${time.toFixed(2)}s`;
  if (opts.format === 'png') {
    const blob = await toBlob(canvas, 'image/png');
    return { blob, filename: `${base}.png`, width: canvas.width, height: canvas.height, format: 'png' };
  }
  const blob = await toBlob(canvas, 'image/jpeg', opts.quality);
  return { blob, filename: `${base}.jpg`, width: canvas.width, height: canvas.height, format: 'jpg' };
}

type EncoderFrame = { image: Uint8Array; delay: number };
export async function exportGif(project: Project, opts: ExportOptions): Promise<ExportResult> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const fps = Math.min(24, Math.max(8, opts.fps));
  const frames = Math.max(2, Math.round((opts.endTime - opts.startTime) * fps));
  const work = document.createElement('canvas');
  const scale = Math.min(1, 600 / opts.width);
  work.width = Math.round(opts.width * scale);
  work.height = Math.round(opts.height * scale);
  const ctx = work.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unavailable');
  const enc = GIFEncoder();
  for (let i = 0; i < frames; i++) {
    if (opts.signal?.aborted) throw cancelError();
    const t = opts.startTime + (i / fps);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, work.width, work.height);
    ctx.scale(work.width / project.width, work.height / project.height);
    drawScene(ctx, project, t, { showBackground: !opts.transparent, quality: 0.75 });
    const { data } = ctx.getImageData(0, 0, work.width, work.height);
    const palette = quantize(data, 256, { format: 'rgba4444' });
    const index = applyPalette(data, palette, 'rgba4444');
    enc.writeFrame(index, work.width, work.height, { palette, delay: 1000 / fps, transparent: opts.transparent });
    opts.onProgress?.(5 + (i / frames) * 88, `Frame ${i + 1}/${frames}`);
    if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  enc.finish();
  const bytes = enc.bytes();
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'image/gif' });
  opts.onProgress?.(100, 'GIF ready');
  return { blob, filename: `${project.name.replace(/[^\w\-]+/g, '-').toLowerCase()}.gif`, width: work.width, height: work.height, format: 'gif', note: formatBytes(blob.size) };
}

export function pickVideoMime(preferMp4: boolean): { mime: string; ext: 'mp4' | 'webm'; note?: string } {
  const mp4Candidates = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4'];
  const webmCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  if (preferMp4) {
    for (const m of mp4Candidates) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return { mime: m, ext: 'mp4' };
    for (const m of webmCandidates) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return { mime: m, ext: 'webm', note: 'This browser cannot encode H.264 in-browser — exported WebM instead. Convert with ffmpeg for MP4.' };
    return { mime: 'video/webm', ext: 'webm', note: 'MediaRecorder unavailable; try Chrome or Edge.' };
  }
  for (const m of webmCandidates) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return { mime: m, ext: 'webm' };
  for (const m of mp4Candidates) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return { mime: m, ext: 'mp4' };
  return { mime: 'video/webm', ext: 'webm' };
}

export async function exportVideo(project: Project, opts: ExportOptions, preferMp4: boolean): Promise<ExportResult> {
  const { mime, ext, note } = pickVideoMime(preferMp4);
  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const stream = canvas.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.round(Math.min(16_000_000, opts.width * opts.height * 4)) });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<Blob>((resolve) => { recorder.onstop = () => resolve(new Blob(chunks, { type: mime })); });
  recorder.start(100);
  const duration = Math.max(0.2, opts.endTime - opts.startTime);
  const started = performance.now();
  await new Promise<void>((resolve, reject) => {
    const step = () => {
      if (opts.signal?.aborted) { recorder.stop(); reject(cancelError()); return; }
      const elapsed = (performance.now() - started) / 1000;
      const t = opts.startTime + Math.min(duration, elapsed);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(opts.width / project.width, opts.height / project.height);
      drawScene(ctx, project, t, { showBackground: !opts.transparent, quality: 1 });
      track.requestFrame();
      opts.onProgress?.(5 + (elapsed / duration) * 90, `Recording ${t.toFixed(2)}s / ${(opts.startTime + duration).toFixed(2)}s`);
      if (elapsed >= duration) { setTimeout(() => { recorder.stop(); resolve(); }, 180); return; }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  const blob = await done;
  stream.getTracks().forEach((tr) => tr.stop());
  opts.onProgress?.(100, 'Video ready');
  return { blob, filename: `${project.name.replace(/[^\w\-]+/g, '-').toLowerCase()}.${ext}`, width: canvas.width, height: canvas.height, format: ext === 'mp4' ? 'mp4' : 'webm', note };
}

// ── SVG (vector export of the resolved frame) ──────────────────────────────
export async function exportSvg(project: Project, opts: ExportOptions, time: number): Promise<ExportResult> {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const grad = (layer: Layer, id: string) => {
    const g = layer.fillGradient;
    if (!g) return '';
    const stops = g.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('');
    return g.type === 'radial'
      ? `<radialGradient id="${id}">${stops}</radialGradient>`
      : `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`;
  };
  const defs: string[] = [];
  const body: string[] = [];
  const ordered = project.layers.filter((l) => !l.parentId);
  for (const layer of ordered) {
    if (!layer.visible) continue;
    const r = resolveLayer(layer, time);
    if (!r.visible) continue;
    const gid = `g-${layer.id}`;
    const fill = layer.fillGradient ? `url(#${gid})` : layer.fill || 'none';
    const gd = grad(layer, gid);
    if (gd) defs.push(gd);
    const opacity = r.opacity;
    const transform = `translate(${r.x.toFixed(2)} ${r.y.toFixed(2)}) rotate(${r.rotation} ${(layer.anchorX * r.w).toFixed(2)} ${(layer.anchorY * r.h).toFixed(2)}) scale(${r.scaleX} ${r.scaleY})`;
    if (layer.type === 'text' && layer.text) {
      const t = layer.text;
      const size = r.fontSize;
      const lines = t.content.split('\n');
      const lh = size * t.lineHeight;
      const anchor = t.align === 'center' ? 'middle' : t.align === 'right' ? 'end' : 'start';
      const ax = t.align === 'center' ? r.w / 2 : t.align === 'right' ? r.w : 0;
      const tgid = `tg-${layer.id}`;
      if (t.gradient) {
        defs.push(`<linearGradient id="${tgid}" x1="0" y1="0" x2="1" y2="1">${t.gradient.stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('')}</linearGradient>`);
      }
      body.push(`<g transform="${transform}" opacity="${opacity}" style="mix-blend-mode:${layer.blendMode}">${lines.map((line, i) => `<text x="${ax}" y="${size * 0.9 + i * lh}" font-family="${esc(t.fontFamily)}" font-size="${size}" font-weight="${t.fontWeight}" fill="${t.gradient ? `url(#${tgid})` : t.color}" text-anchor="${anchor}" letter-spacing="${t.letterSpacing}">${esc(t.uppercase ? line.toUpperCase() : line)}</text>`).join('')}</g>`);
    } else if (layer.type === 'image' || layer.type === 'video') {
      const src = layer.media?.src;
      if (src) {
        let href = src;
        let w = r.w, h = r.h;
        const img = getImage(src);
        if (img) {
          const scale = layer.media?.fit === 'contain' ? Math.min(r.w / img.width, r.h / img.height) : Math.max(r.w / img.width, r.h / img.height);
          w = img.width * scale; h = img.height * scale;
        }
        if (src.startsWith('data:') || src.startsWith('http')) {
          body.push(`<g transform="${transform}" opacity="${opacity}"><image href="${esc(href)}" x="${((r.w - w) / 2).toFixed(2)}" y="${((r.h - h) / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" preserveAspectRatio="xMidYMid slice"/></g>`);
        }
      }
    } else if (layer.type === 'shape') {
      const stroke = layer.stroke && layer.strokeWidth ? `stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}"` : '';
      const shape = layer.shape ?? 'rect';
      if (shape === 'ellipse') body.push(`<ellipse cx="${r.w / 2}" cy="${r.h / 2}" rx="${r.w / 2}" ry="${r.h / 2}" fill="${fill}" ${stroke}/>`);
      else if (shape === 'polygon' || shape === 'triangle' || shape === 'hexagon' || shape === 'star' || shape === 'diamond') {
        const sides = shape === 'triangle' ? 3 : shape === 'diamond' ? 4 : shape === 'star' ? (layer.points ?? 5) * 2 : (layer.points ?? 6);
        const inner = shape === 'star' ? layer.innerRadius ?? 0.45 : 1;
        const pts = Array.from({ length: sides }, (_, i) => {
          const ang = (i / sides) * Math.PI * 2 - Math.PI / 2;
          const f = shape === 'star' && i % 2 ? inner : 1;
          return `${(r.w / 2 + Math.cos(ang) * (r.w / 2) * f).toFixed(2)},${(r.h / 2 + Math.sin(ang) * (r.h / 2) * f).toFixed(2)}`;
        }).join(' ');
        body.push(`<polygon points="${pts}" fill="${fill}" ${stroke}/>`);
      } else body.push(`<rect width="${r.w}" height="${r.h}" rx="${r.cornerRadius}" fill="${fill}" ${stroke}/>`);
      if (layer.type === 'shape') {
        const last = body.pop();
        body.push(`<g transform="${transform}" opacity="${opacity}" style="mix-blend-mode:${layer.blendMode}">${last}</g>`);
      }
    }
    if (layer.particles) {
      body.push(`<g opacity="${opacity}" transform="translate(${r.x} ${r.y})"><rect width="${r.w}" height="${r.h}" fill="none"/><text x="8" y="18" fill="${layer.particles.color}" font-size="10">particles · ${layer.particles.count}</text></g>`);
    }
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${project.width} ${project.height}">\n<defs>${defs.join('')}</defs>\n${opts.transparent ? '' : `<rect width="${project.width}" height="${project.height}" fill="${project.background}"/>`}\n${body.join('\n')}\n</svg>`;
  opts.onProgress?.(100, 'SVG ready');
  return { blob: new Blob([svg], { type: 'image/svg+xml' }), filename: `${project.name.replace(/[^\w\-]+/g, '-').toLowerCase()}.svg`, width: project.width, height: project.height, format: 'svg', note: 'Editable vectors — particles and some effects are approximated.' };
}

// ── Minimal PDF writer (embeds a JPEG frame) ───────────────────────────────
export async function exportPdf(project: Project, opts: ExportOptions, time: number): Promise<ExportResult> {
  const canvas = renderFrame(project, time, opts.width, opts.height, false);
  const jpegBlob = await toBlob(canvas, 'image/jpeg', 0.92);
  const jpeg = new Uint8Array(await jpegBlob.arrayBuffer());
  const enc = new TextEncoder();
  const header = enc.encode('%PDF-1.4\n');
  const objects: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = header.length;
  const addObj = (body: string, stream?: Uint8Array) => {
    offsets.push(pos);
    const head = enc.encode(body);
    const mid = stream ? enc.encode('stream\n') : new Uint8Array();
    const tail = stream ? enc.encode('\nendstream\n') : new Uint8Array();
    const end = enc.encode('endobj\n');
    const chunk = [head, mid, stream ?? new Uint8Array(), tail, end];
    const len = chunk.reduce((a, c) => a + c.length, 0);
    objects.push(...chunk);
    pos += len;
  };
  const w = opts.width, h = opts.height;
  addObj(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\n`);
  addObj(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n`);
  addObj(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\n`);
  addObj(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${Math.round(w)} /Height ${Math.round(h)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\n`, jpeg);
  const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
  addObj(`5 0 obj\n<< /Length ${content.length} >>\n`, enc.encode(content));
  const xrefPos = pos;
  const xref = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  const xrefBytes = enc.encode(xref);
  const rowParts: BlobPart[] = [header, ...objects, xrefBytes].map((u) => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength) as ArrayBuffer);
  const blob = new Blob(rowParts, { type: 'application/pdf' });
  opts.onProgress?.(100, 'PDF ready');
  return { blob, filename: `${project.name.replace(/[^\w\-]+/g, '-').toLowerCase()}.pdf`, width: w, height: h, format: 'pdf', note: 'Single-page PDF (JPEG embedded).' };
}

// ── Lottie (shape + text layers with transform keyframes) ──────────────────
export async function exportLottie(project: Project, opts: ExportOptions): Promise<ExportResult> {
  const fps = opts.fps;
  const ip = Math.round(opts.startTime * fps);
  const op = Math.round(opts.endTime * fps);
  const layers = project.layers.map((layer, idx) => {
    const r = resolveLayer(layer, opts.startTime);
    const ks: Record<string, unknown> = {
      o: { a: 1, k: keyframesFor(layer, 'opacity', opts, 1) },
      r: { a: 1, k: keyframesFor(layer, 'rotation', opts, 0) },
      p: { a: 1, k: keyframesForPair(layer, 'x', 'y', opts, r.x, r.y) },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 1, k: keyframesForPair(layer, 'scaleX', 'scaleY', opts, r.scaleX * 100, r.scaleY * 100) },
    };
    const transform = { ty: 'tr', p: ks.p, a: ks.a, s: ks.s, r: ks.r, o: ks.o, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 } };
    const shapes: unknown[] = [];
    if (layer.type === 'shape') {
      const fillColor = hexToLottie(layer.fill);
      if (layer.shape === 'ellipse') shapes.push({ ty: 'el', p: { a: 0, k: [r.w / 2, r.h / 2] }, s: { a: 0, k: [r.w, r.h] } });
      else shapes.push({ ty: 'rc', p: { a: 0, k: [r.w / 2, r.h / 2] }, s: { a: 0, k: [r.w, r.h] }, r: { a: 0, k: layer.radius ?? 0 } });
      shapes.push({ ty: 'fl', c: { a: 0, k: fillColor }, o: { a: 0, k: 100 } });
      shapes.push(transform);
      return { ddd: 0, ind: idx, ty: 4, nm: layer.name, sr: 1, ks, ao: 0, shapes, ip, op, st: Math.round(layer.startTime * fps), bm: 0 };
    }
    if (layer.type === 'text' && layer.text) {
      return {
        ddd: 0, ind: idx, ty: 5, nm: layer.name, sr: 1, ks, ao: 0, ip, op, st: 0, bm: 0,
        t: {
          d: { k: [{ s: { s: layer.text.fontSize, f: `'${layer.text.fontFamily}'`, t: layer.text.content, j: layer.text.align === 'center' ? 2 : layer.text.align === 'right' ? 1 : 0, tr: layer.text.letterSpacing * 10, lh: layer.text.fontSize * layer.text.lineHeight, fc: hexToLottie(layer.text.color) }, t: 0 }] },
          a: [], p: {}, m: { g: 1, a: { a: 0, k: [0, 0] } },
        },
      };
    }
    return { ddd: 0, ind: idx, ty: 3, nm: layer.name, sr: 1, ks, ao: 0, ip, op, st: 0, bm: 0 };
  });
  const lottie = {
    v: '5.7.4', fr: fps, ip, op, w: project.width, h: project.height, nm: project.name, ddd: 0, assets: [], layers,
  };
  opts.onProgress?.(100, 'Lottie ready');
  return {
    blob: new Blob([JSON.stringify(lottie, null, 2)], { type: 'application/json' }),
    filename: `${project.name.replace(/[^\w\-]+/g, '-').toLowerCase()}.json`,
    width: project.width, height: project.height, format: 'lottie', note: 'Lottie 5.7 — shapes + transform animation. Effects are not representable.',
  };
}

function hexToLottie(hex: string): number[] {
  const h = (hex || '#ffffff').replace('#', '').padEnd(6, 'f');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, 1];
}

function keyframesFor(layer: Layer, prop: 'opacity' | 'rotation', opts: ExportOptions, fallback: number) {
  const keys = layer.keyframes[prop] ?? [];
  const fps = opts.fps;
  if (!keys.length) return [{ t: Math.round(opts.startTime * fps), s: [prop === 'opacity' ? fallback * 100 : fallback], e: [prop === 'opacity' ? fallback * 100 : fallback], i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } }];
  const mapped = keys.map((k) => {
    const val = typeof k.value === 'number' ? (prop === 'opacity' ? k.value * 100 : k.value) : fallback;
    return { t: Math.round(k.time * fps), s: [val] };
  });
  mapped.forEach((k, i) => {
    if (i < mapped.length - 1) (k as unknown as { e: number[] }).e = [mapped[i + 1].s[0]];
  });
  return mapped.length === 1 ? [{ t: mapped[0].t, s: mapped[0].s, e: mapped[0].s, i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } }] : mapped;
}

function keyframesForPair(layer: Layer, a: 'x' | 'y' | 'scaleX' | 'scaleY', b: 'x' | 'y' | 'scaleX' | 'scaleY', opts: ExportOptions, fallbackA: number, fallbackB: number) {
  const fps = opts.fps;
  const times = new Set<number>([0]);
  (layer.keyframes[a] ?? []).forEach((k) => times.add(k.time));
  (layer.keyframes[b] ?? []).forEach((k) => times.add(k.time));
  const scale = a.startsWith('scale');
  return Array.from(times).sort((x, y) => x - y).map((t) => {
    const va = sampleChannel(layer.keyframes[a], t, fallbackA).value;
    const vb = sampleChannel(layer.keyframes[b], t, fallbackB).value;
    return { t: Math.round(t * fps), s: scale ? [va * 100, vb * 100] : [va, vb] };
  });
}

export function projectToJson(project: Project) { return JSON.stringify({ format: 'prism-project', version: 1, exportedAt: new Date().toISOString(), project }, null, 2); }

export async function runExport(project: Project, opts: ExportOptions): Promise<ExportResult> {
  const time = opts.startTime;
  switch (opts.format) {
    case 'png': case 'jpg': return exportStill(project, opts, time);
    case 'gif': return exportGif(project, opts);
    case 'webm': return exportVideo(project, opts, false);
    case 'mp4': return exportVideo(project, opts, true);
    case 'svg': return exportSvg(project, opts, time);
    case 'pdf': return exportPdf(project, opts, time);
    case 'lottie': return exportLottie(project, opts);
    case 'json': return { blob: new Blob([projectToJson(project)], { type: 'application/json' }), filename: `${project.name.replace(/[^\w\-]+/g, '-').toLowerCase()}.prism.json`, width: project.width, height: project.height, format: 'json', note: 'Portable Prism project — re-importable.' };
    default: throw new Error(`Unsupported format ${opts.format}`);
  }
}

export { downloadBlob };
