import type { EvaluatedLayer, GradientFill, PrismProject } from "./types";
import { evaluateLayer } from "./easing";

/**
 * Deterministic 2D-canvas renderer shared by PNG/GIF/video export and
 * dashboard thumbnails. Mirrors the DOM stage rendering as closely as
 * canvas allows so what you export is what you saw.
 */

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src)!);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function makeGradient(ctx: CanvasRenderingContext2D, g: GradientFill, w: number, h: number): CanvasGradient {
  let grad: CanvasGradient;
  if (g.kind === "radial") {
    grad = ctx.createRadialGradient(w / 2, h * 0.4, Math.min(w, h) * 0.05, w / 2, h / 2, Math.max(w, h) * 0.75);
  } else if (g.kind === "conic" && "createConicGradient" in ctx) {
    grad = ctx.createConicGradient(((g.angle ?? 0) * Math.PI) / 180, w / 2, h / 2);
  } else {
    const rad = (((g.angle ?? 135) - 90) * Math.PI) / 180;
    const dx = Math.cos(rad) * w;
    const dy = Math.sin(rad) * h;
    grad = ctx.createLinearGradient(w / 2 - dx / 2, h / 2 - dy / 2, w / 2 + dx / 2, h / 2 + dy / 2);
  }
  for (const s of g.stops) grad.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color);
  return grad;
}

function fillStyle(ctx: CanvasRenderingContext2D, layer: EvaluatedLayer): string | CanvasGradient {
  if (layer.gradient) return makeGradient(ctx, layer.gradient, layer.width, layer.height);
  return layer.fill;
}

function traceShape(ctx: CanvasRenderingContext2D, layer: EvaluatedLayer) {
  const { width: w, height: h } = layer;
  ctx.beginPath();
  switch (layer.type) {
    case "rect": {
      const r = Math.min(layer.cornerRadius, w / 2, h / 2);
      ctx.roundRect(0, 0, w, h, r);
      break;
    }
    case "ellipse":
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case "polygon": {
      const n = Math.max(3, layer.points ?? 5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const px = w / 2 + (Math.cos(a) * w) / 2;
        const py = h / 2 + (Math.sin(a) * h) / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "star": {
      const n = Math.max(3, layer.points ?? 5);
      const inner = layer.innerRadius ?? 0.5;
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? 1 : inner;
        const px = w / 2 + (Math.cos(a) * w * rad) / 2;
        const py = h / 2 + (Math.sin(a) * h * rad) / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case "line":
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      break;
    default:
      ctx.rect(0, 0, w, h);
  }
}

async function drawLayer(ctx: CanvasRenderingContext2D, layer: EvaluatedLayer) {
  if (!layer._active || layer._opacity <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = layer._opacity;
  ctx.globalCompositeOperation = (layer.blendMode as GlobalCompositeOperation) || "source-over";
  const cx = layer._x + layer.width / 2;
  const cy = layer._y + layer.height / 2;
  ctx.translate(cx, cy);
  ctx.rotate((layer._rotation * Math.PI) / 180);
  ctx.scale(layer._scale * layer._scaleX, layer._scale * layer._scaleY);
  ctx.translate(-layer.width / 2, -layer.height / 2);

  for (const fx of layer.effects) {
    if (fx.type === "shadow" || fx.type === "glow") {
      ctx.shadowColor = fx.color ?? "#000";
      ctx.shadowBlur = fx.blur ?? 16;
      ctx.shadowOffsetX = fx.type === "glow" ? 0 : (fx.offsetX ?? 0);
      ctx.shadowOffsetY = fx.type === "glow" ? 0 : (fx.offsetY ?? 0);
    }
    if (fx.type === "blur") ctx.filter = `blur(${fx.blur ?? 4}px)`;
  }

  if (layer.type === "text") {
    const size = layer.fontSize ?? 64;
    ctx.font = `${layer.fontWeight ?? 700} ${size}px "${layer.fontFamily ?? "Inter"}", sans-serif`;
    ctx.fillStyle = fillStyle(ctx, layer);
    ctx.textBaseline = "top";
    const align = layer.align ?? "center";
    ctx.textAlign = align;
    const x = align === "left" ? 0 : align === "right" ? layer.width : layer.width / 2;
    const lines = (layer.text ?? "").split("\n");
    const lh = size * (layer.lineHeight ?? 1.1);
    lines.forEach((line, i) => ctx.fillText(line, x, i * lh, layer.width));
    for (const fx of layer.effects) {
      if (fx.type === "outline") {
        ctx.shadowBlur = 0;
        ctx.lineWidth = Math.max(1, size * 0.04);
        ctx.strokeStyle = fx.color ?? "#000";
        lines.forEach((line, i) => ctx.strokeText(line, x, i * lh, layer.width));
      }
    }
  } else if (layer.type === "image") {
    if (layer.src) {
      const img = await loadImage(layer.src);
      if (img) {
        if (layer.cornerRadius > 0) {
          ctx.beginPath();
          ctx.roundRect(0, 0, layer.width, layer.height, layer.cornerRadius);
          ctx.clip();
        }
        ctx.drawImage(img, 0, 0, layer.width, layer.height);
      }
    }
  } else {
    traceShape(ctx, layer);
    if (layer.type === "line") {
      ctx.strokeStyle = layer.stroke !== "transparent" ? layer.stroke : layer.fill;
      ctx.lineWidth = Math.max(1, layer.strokeWidth || 4);
      ctx.stroke();
    } else {
      if (layer.fill !== "transparent" || layer.gradient) {
        ctx.fillStyle = fillStyle(ctx, layer);
        ctx.fill();
      }
      if (layer.stroke !== "transparent" && layer.strokeWidth > 0) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = layer.strokeWidth;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export async function renderFrame(canvas: HTMLCanvasElement, project: PrismProject, time: number): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (project.backgroundGradient) {
    ctx.fillStyle = makeGradient(ctx, project.backgroundGradient, project.width, project.height);
  } else {
    ctx.fillStyle = project.background;
  }
  ctx.fillRect(0, 0, project.width, project.height);
  for (const layer of project.layers) {
    await drawLayer(ctx, evaluateLayer(layer, time));
  }
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** SVG serialization at a given time (static frame). */
export function projectToSvg(project: PrismProject, time: number): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${project.width}" height="${project.height}" viewBox="0 0 ${project.width} ${project.height}">`,
    `<rect width="100%" height="100%" fill="${project.background}"/>`,
  ];
  for (const raw of project.layers) {
    const l = evaluateLayer(raw, time);
    if (!l._active) continue;
    const tf = `transform="translate(${l._x + l.width / 2} ${l._y + l.height / 2}) rotate(${l._rotation}) scale(${l._scale * l._scaleX} ${l._scale * l._scaleY}) translate(${-l.width / 2} ${-l.height / 2})" opacity="${l._opacity.toFixed(3)}"`;
    if (l.type === "text") {
      const anchor = l.align === "left" ? "start" : l.align === "right" ? "end" : "middle";
      const x = l.align === "left" ? 0 : l.align === "right" ? l.width : l.width / 2;
      const tspans = (l.text ?? "")
        .split("\n")
        .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : (l.fontSize ?? 64) * (l.lineHeight ?? 1.1)}">${esc(line)}</tspan>`)
        .join("");
      parts.push(`<text ${tf} x="${x}" y="${(l.fontSize ?? 64) * 0.9}" font-family="${l.fontFamily}" font-size="${l.fontSize}" font-weight="${l.fontWeight}" fill="${l.fill}" text-anchor="${anchor}" letter-spacing="${l.letterSpacing ?? 0}">${tspans}</text>`);
    } else if (l.type === "image" && l.src) {
      parts.push(`<image ${tf} href="${esc(l.src)}" width="${l.width}" height="${l.height}" preserveAspectRatio="none"/>`);
    } else if (l.type === "ellipse") {
      parts.push(`<ellipse ${tf} cx="${l.width / 2}" cy="${l.height / 2}" rx="${l.width / 2}" ry="${l.height / 2}" fill="${l.fill}" stroke="${l.stroke}" stroke-width="${l.strokeWidth}"/>`);
    } else if (l.type === "polygon" || l.type === "star") {
      const n = Math.max(3, l.points ?? 5);
      const pts: string[] = [];
      const steps = l.type === "star" ? n * 2 : n;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
        const rad = l.type === "star" && i % 2 === 1 ? (l.innerRadius ?? 0.5) : 1;
        pts.push(`${(l.width / 2 + (Math.cos(a) * l.width * rad) / 2).toFixed(1)},${(l.height / 2 + (Math.sin(a) * l.height * rad) / 2).toFixed(1)}`);
      }
      parts.push(`<polygon ${tf} points="${pts.join(" ")}" fill="${l.fill}"/>`);
    } else if (l.type === "line") {
      parts.push(`<line ${tf} x1="0" y1="${l.height / 2}" x2="${l.width}" y2="${l.height / 2}" stroke="${l.stroke !== "transparent" ? l.stroke : l.fill}" stroke-width="${Math.max(1, l.strokeWidth || 4)}"/>`);
    } else {
      parts.push(`<rect ${tf} width="${l.width}" height="${l.height}" rx="${l.cornerRadius}" fill="${l.fill}" stroke="${l.stroke}" stroke-width="${l.strokeWidth}"/>`);
    }
  }
  parts.push("</svg>");
  return parts.join("\n");
}

/** Minimal-but-valid Lottie document: shape/text layers with transform keyframes. */
export function projectToLottie(project: PrismProject): object {
  const fr = project.fps;
  const out = Math.round(project.duration * fr);
  const anim = (layer: (typeof project.layers)[number], prop: "x" | "y" | "rotation" | "opacity" | "scale", base: number, mult = 1) => {
    const kfs = layer.keyframes.filter((k) => k.property === prop).sort((a, b) => a.time - b.time);
    if (kfs.length === 0) return { a: 0, k: base * mult, ix: 0 };
    return {
      a: 1,
      k: kfs.map((k, i) => ({ t: Math.round(k.time * fr), s: [k.value * mult], ...(i < kfs.length - 1 ? {} : {}) })),
      ix: 0,
    };
  };
  return {
    v: "5.7.4", fr, ip: 0, op: out, w: project.width, h: project.height, nm: project.name, ddd: 0, assets: [],
    layers: project.layers.map((l, idx) => ({
      ddd: 0, ind: idx + 1, ty: l.type === "text" ? 5 : 4, nm: l.name,
      sr: 1, ks: {
        o: anim(l, "opacity", l.opacity, 100),
        r: anim(l, "rotation", l.rotation),
        p: { a: 0, k: [l.x + l.width / 2, l.y + l.height / 2, 0], ix: 2 },
        a: { a: 0, k: [0, 0, 0], ix: 1 },
        s: { a: 0, k: [100, 100, 100], ix: 6 },
      },
      ao: 0,
      ...(l.type === "text"
        ? { t: { d: { k: [{ s: { s: l.fontSize ?? 64, f: l.fontFamily ?? "Inter", t: l.text ?? "", j: 2, tr: 0, lh: (l.fontSize ?? 64) * 1.2, ls: 0, fc: [1, 1, 1] }, t: 0 }] }, p: {}, m: {}, a: [] } }
        : { shapes: [] }),
      ip: Math.round(l.startTime * fr), op: Math.round((l.startTime + l.duration) * fr), st: 0, bm: 0,
    })),
    markers: [],
  };
}
