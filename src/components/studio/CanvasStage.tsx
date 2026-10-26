"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, type ToolId } from "@/lib/store";
import { evaluateLayer, gradientCss } from "@/lib/easing";
import { makeLayer } from "@/lib/layers";
import type { EvaluatedLayer, Layer } from "@/lib/types";
import { cn, fileToDataUrl } from "@/lib/utils";

function effectCss(l: Layer): React.CSSProperties {
  const filters: string[] = [];
  const shadows: string[] = [];
  for (const fx of l.effects) {
    if (fx.type === "blur") filters.push(`blur(${fx.blur ?? 4}px)`);
    if (fx.type === "shadow") shadows.push(`drop-shadow(${fx.offsetX ?? 0}px ${fx.offsetY ?? 8}px ${fx.blur ?? 8}px ${fx.color ?? "#000"})`);
    if (fx.type === "glow") shadows.push(`drop-shadow(0 0 ${fx.blur ?? 24}px ${fx.color ?? "#7c3aed"})`);
  }
  return { filter: [...filters, ...shadows].join(" ") || undefined };
}

export function LayerView({ l, interactive }: { l: EvaluatedLayer; interactive?: boolean }) {
  const base: React.CSSProperties = {
    position: "absolute",
    left: l._x,
    top: l._y,
    width: l.width,
    height: l.height,
    opacity: l._opacity,
    transform: `rotate(${l._rotation}deg) scale(${l._scale * l._scaleX}, ${l._scale * l._scaleY})`,
    transformOrigin: "center center",
    mixBlendMode: l.blendMode as React.CSSProperties["mixBlendMode"],
    pointerEvents: interactive ? "auto" : "none",
    ...effectCss(l),
  };

  if (l.type === "text") {
    const outline = l.effects.find((e) => e.type === "outline");
    return (
      <div
        style={{
          ...base,
          fontFamily: `"${l.fontFamily ?? "Inter"}", sans-serif`,
          fontSize: l.fontSize,
          fontWeight: l.fontWeight,
          letterSpacing: l.letterSpacing,
          lineHeight: l.lineHeight,
          textAlign: l.align,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
          ...(l.gradient
            ? { backgroundImage: gradientCss(l.gradient), WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }
            : { color: l.fill }),
          ...(outline ? { WebkitTextStroke: `${Math.max(1, (l.fontSize ?? 64) * 0.03)}px ${outline.color ?? "#000"}` } : {}),
        }}
      >
        {l.text ?? ""}
      </div>
    );
  }
  if (l.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={l.src} alt={l.name} draggable={false} style={{ ...base, objectFit: "cover", borderRadius: l.cornerRadius }} />
    );
  }
  // shapes via SVG for crisp polygons/stars/gradients
  const gid = `g-${l.id}`;
  const fill = l.gradient ? `url(#${gid})` : l.fill;
  const grad = l.gradient && (
    <defs>
      {l.gradient.kind === "radial" ? (
        <radialGradient id={gid}>
          {l.gradient.stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
        </radialGradient>
      ) : (
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          {l.gradient.stops.map((s, i) => <stop key={i} offset={s.offset} stopColor={s.color} />)}
        </linearGradient>
      )}
    </defs>
  );
  const points = (n: number, star: boolean) => {
    const steps = star ? n * 2 : n;
    return Array.from({ length: steps }, (_, i) => {
      const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
      const r = star && i % 2 === 1 ? (l.innerRadius ?? 0.5) : 1;
      return `${50 + Math.cos(a) * 50 * r},${50 + Math.sin(a) * 50 * r}`;
    }).join(" ");
  };
  return (
    <svg style={base} viewBox="0 0 100 100" preserveAspectRatio="none" width={l.width} height={l.height} aria-hidden>
      {grad}
      {l.type === "rect" && <rect x={0} y={0} width={100} height={100} rx={(l.cornerRadius / Math.max(l.width, 1)) * 100} fill={fill} stroke={l.stroke} strokeWidth={l.strokeWidth ? (l.strokeWidth / Math.max(l.width, 1)) * 100 : 0} />}
      {l.type === "ellipse" && <ellipse cx={50} cy={50} rx={50} ry={50} fill={fill} stroke={l.stroke} strokeWidth={l.strokeWidth ? (l.strokeWidth / Math.max(l.width, 1)) * 100 : 0} />}
      {l.type === "polygon" && <polygon points={points(Math.max(3, l.points ?? 5), false)} fill={fill} stroke={l.stroke} strokeWidth={l.strokeWidth ? 2 : 0} />}
      {l.type === "star" && <polygon points={points(Math.max(3, l.points ?? 5), true)} fill={fill} stroke={l.stroke} strokeWidth={l.strokeWidth ? 2 : 0} />}
      {l.type === "line" && <line x1={0} y1={50} x2={100} y2={50} stroke={l.stroke !== "transparent" ? l.stroke : l.fill} strokeWidth={Math.max(1.5, (l.strokeWidth || 4) / Math.max(l.height, 1) * 100)} />}
    </svg>
  );
}

type DragState =
  | { kind: "move"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize"; id: string; startX: number; startY: number; origW: number; origH: number }
  | { kind: "rotate"; id: string; cx: number; cy: number }
  | { kind: "draw"; tool: ToolId; x0: number; y0: number }
  | { kind: "pan" }
  | null;

export default function CanvasStage() {
  const { project, currentTime, selectedIds, select, updateLayer, addLayer, tool, setTool, zoom, setZoom, showGrid, snap, pushHistory } = useEditor();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 900, h: 600 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<DragState>(null);
  const [drawPreview, setDrawPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useMemo(() => {
    const pad = 72;
    const s = Math.min((viewport.w - pad) / project.width, (viewport.h - pad) / project.height);
    return Math.max(0.02, s);
  }, [viewport, project.width, project.height]);
  const scale = fit * zoom;

  const origin = useMemo(
    () => ({
      x: (viewport.w - project.width * scale) / 2 + pan.x,
      y: (viewport.h - project.height * scale) / 2 + pan.y,
    }),
    [viewport, project.width, project.height, scale, pan],
  );

  const toCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      // +20 accounts for the ruler strips the artboard is offset by.
      return { x: (clientX - rect.left - origin.x - 20) / scale, y: (clientY - rect.top - origin.y - 20) / scale };
    },
    [origin, scale],
  );

  const snapVal = useCallback(
    (v: number, guides: number[]) => {
      if (!snap) return v;
      for (const g of guides) if (Math.abs(v - g) < 8 / scale) return g;
      return Math.round(v);
    },
    [snap, scale],
  );

  const evaluated = useMemo(() => project.layers.map((l) => evaluateLayer(l, currentTime)), [project.layers, currentTime]);
  const selected = evaluated.find((l) => l.id === selectedIds[0]);

  const onLayerPointerDown = (e: React.PointerEvent, l: EvaluatedLayer) => {
    if (tool === "hand") return;
    if (l.locked) return;
    e.stopPropagation();
    const additive = e.shiftKey;
    select(additive ? Array.from(new Set([...selectedIds, l.id])) : [l.id]);
    const raw = project.layers.find((x) => x.id === l.id);
    if (!raw) return;
    pushHistory();
    setDrag({ kind: "move", id: l.id, startX: e.clientX, startY: e.clientY, origX: raw.x, origY: raw.y });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    if (e.button === 1 || tool === "hand") {
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      setDrag({ kind: "pan" });
      return;
    }
    const drawTools: ToolId[] = ["rect", "ellipse", "polygon", "star", "text"];
    if (drawTools.includes(tool)) {
      const p = toCanvas(e.clientX, e.clientY);
      setDrag({ kind: "draw", tool, x0: p.x, y0: p.y });
      setDrawPreview({ x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }
    select([]);
    setEditingId(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    if (drag.kind === "pan") {
      setPan({ x: panStart.current.panX + (e.clientX - panStart.current.x), y: panStart.current.panY + (e.clientY - panStart.current.y) });
      return;
    }
    if (drag.kind === "move") {
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      const layer = project.layers.find((l) => l.id === drag.id);
      if (!layer) return;
      const xg = [0, project.width / 2 - layer.width / 2, project.width - layer.width];
      const yg = [0, project.height / 2 - layer.height / 2, project.height - layer.height];
      updateLayer(drag.id, { x: snapVal(drag.origX + dx, xg), y: snapVal(drag.origY + dy, yg) });
      return;
    }
    if (drag.kind === "resize") {
      const dx = (e.clientX - drag.startX) / scale;
      const dy = (e.clientY - drag.startY) / scale;
      updateLayer(drag.id, { width: Math.max(8, drag.origW + dx), height: Math.max(8, drag.origH + dy) });
      return;
    }
    if (drag.kind === "rotate") {
      const p = toCanvas(e.clientX, e.clientY);
      const ang = (Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180) / Math.PI + 90;
      updateLayer(drag.id, { rotation: Math.round(ang) });
      return;
    }
    if (drag.kind === "draw") {
      const p = toCanvas(e.clientX, e.clientY);
      setDrawPreview({ x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0) });
    }
  };

  const onPointerUp = () => {
    if (drag?.kind === "draw" && drawPreview) {
      const { x, y, w, h } = drawPreview;
      const W = Math.max(w, 80);
      const H = Math.max(h, drag.tool === "text" ? 60 : 80);
      const dur = project.duration;
      if (drag.tool === "text") {
        const l = makeLayer({ type: "text", text: "Double-click to edit", x, y, width: Math.max(W, 420), height: H, fontSize: Math.max(24, Math.round(project.width * 0.04)), fill: "#ffffff", duration: dur });
        addLayer(l);
        setEditingId(l.id);
      } else {
        addLayer(makeLayer({ type: drag.tool as Layer["type"], x, y, width: W, height: H, duration: dur, points: drag.tool === "polygon" ? 6 : 5 }));
      }
      setTool("select");
    }
    setDrag(null);
    setDrawPreview(null);
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? 1.08 : 0.92));
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    const p = toCanvas(e.clientX, e.clientY);
    let i = 0;
    for (const f of files.slice(0, 6)) {
      const url = await fileToDataUrl(f);
      const img = new Image();
      img.src = url;
      await new Promise((r) => (img.onload = r));
      const maxW = project.width * 0.6;
      const ratio = img.height / Math.max(1, img.width);
      const w = Math.min(img.width, maxW);
      addLayer(makeLayer({ type: "image", name: f.name, src: url, x: p.x + i * 30, y: p.y + i * 30, width: w, height: w * ratio, duration: project.duration }), i === 0);
      i++;
    }
  };

  const textLayer = editingId ? evaluated.find((l) => l.id === editingId && l.type === "text") : undefined;

  return (
    <div
      ref={wrapRef}
      className={cn("relative flex-1 overflow-hidden bg-[#0a0a12]", tool === "hand" ? "cursor-grab active:cursor-grabbing" : "cursor-default")}
      onPointerDown={onStagePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      role="application"
      aria-label="Design canvas"
    >
      {/* backdrop dots */}
      <div className="absolute inset-0 opacity-[.35]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.14) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />

      {/* rulers */}
      <div className="absolute top-0 left-0 right-0 h-5 bg-ink-900/90 border-b border-white/[.06] z-20 overflow-hidden" aria-hidden>
        {Array.from({ length: Math.ceil(project.width / 100) + 1 }, (_, i) => (
          <span key={i} className="absolute top-0.5 text-[8px] font-mono text-zinc-500" style={{ left: origin.x + i * 100 * scale }}>
            {i * 100}
          </span>
        ))}
      </div>
      <div className="absolute top-5 left-0 bottom-0 w-5 bg-ink-900/90 border-r border-white/[.06] z-20 overflow-hidden" aria-hidden>
        {Array.from({ length: Math.ceil(project.height / 100) + 1 }, (_, i) => (
          <span key={i} className="absolute left-0.5 text-[8px] font-mono text-zinc-500" style={{ top: origin.y - 20 + i * 100 * scale, writingMode: "vertical-rl" }}>
            {i * 100}
          </span>
        ))}
      </div>

      {/* artboard */}
      <div
        className="absolute shadow-[0_24px_80px_rgba(0,0,0,.65)] ring-1 ring-white/10"
        style={{
          left: origin.x + 20,
          top: origin.y + 20,
          width: project.width * scale,
          height: project.height * scale,
          background: project.backgroundGradient ? gradientCss(project.backgroundGradient) : project.background,
        }}
      >
        <div className="absolute inset-0 origin-top-left" style={{ width: project.width, height: project.height, transform: `scale(${scale})` }}>
          {evaluated.filter((l) => l._active).map((l) => (
            <div key={l.id} onPointerDown={(e) => onLayerPointerDown(e, l)} onDoubleClick={() => l.type === "text" && setEditingId(l.id)} style={{ display: "contents" }}>
              <LayerView l={l} interactive />
            </div>
          ))}
          {drawPreview && (
            <div className="absolute border-2 border-dashed border-cyan-300 bg-cyan-400/10" style={{ left: drawPreview.x, top: drawPreview.y, width: drawPreview.w, height: drawPreview.h }} />
          )}
        </div>

        {showGrid && <div className="absolute inset-0 grid-bg pointer-events-none" />}

        {/* selection chrome */}
        {selected && selected._active && !selected.locked && (
          <div
            className="absolute border-2 border-violet-400 pointer-events-none z-10"
            style={{
              left: selected._x * scale, top: selected._y * scale,
              width: selected.width * scale, height: selected.height * scale,
              transform: `rotate(${selected._rotation}deg)`,
            }}
          >
            <span className="absolute -top-5 left-0 text-[10px] font-mono bg-violet-600 text-white px-1.5 py-0.5 rounded">
              {selected.name} · {Math.round(selected.width)}×{Math.round(selected.height)}
            </span>
            <button
              aria-label="Resize layer"
              className="absolute -bottom-2 -right-2 h-4 w-4 bg-white border-2 border-violet-500 rounded-sm pointer-events-auto cursor-nwse-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                const raw = project.layers.find((x) => x.id === selected.id)!;
                pushHistory();
                setDrag({ kind: "resize", id: selected.id, startX: e.clientX, startY: e.clientY, origW: raw.width, origH: raw.height });
              }}
            />
            <button
              aria-label="Rotate layer"
              className="absolute -top-9 left-1/2 -translate-x-1/2 h-4 w-4 bg-white border-2 border-cyan-400 rounded-full pointer-events-auto cursor-grab"
              onPointerDown={(e) => {
                e.stopPropagation();
                pushHistory();
                setDrag({ kind: "rotate", id: selected.id, cx: selected._x + selected.width / 2, cy: selected._y + selected.height / 2 });
              }}
            />
          </div>
        )}

        {/* inline text editor */}
        {textLayer && (
          <textarea
            autoFocus
            aria-label="Edit text"
            value={project.layers.find((x) => x.id === textLayer.id)?.text ?? ""}
            onChange={(e) => updateLayer(textLayer.id, { text: e.target.value })}
            onBlur={() => setEditingId(null)}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute z-20 bg-black/40 backdrop-blur-sm border-2 border-cyan-300 rounded outline-none resize-none"
            style={{
              left: textLayer._x * scale, top: textLayer._y * scale,
              width: textLayer.width * scale, height: Math.max(48, textLayer.height * scale),
              fontSize: Math.max(12, (textLayer.fontSize ?? 64) * scale),
              fontFamily: `"${textLayer.fontFamily}"`, fontWeight: textLayer.fontWeight,
              color: "#fff", textAlign: textLayer.align, lineHeight: textLayer.lineHeight,
            }}
          />
        )}
      </div>

      {project.layers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center max-w-sm px-6">
            <p className="font-display text-xl font-semibold text-zinc-200">Blank canvas, infinite spectrum</p>
            <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
              Describe anything in the AI panel and watch the agent build it — or pick a tool and draw, drop an image, or start from Templates.
            </p>
            <p className="text-[11px] text-zinc-600 mt-3 font-mono">V select · T text · R rectangle · Space play · ⌘K commands</p>
          </div>
        </div>
      )}
    </div>
  );
}
