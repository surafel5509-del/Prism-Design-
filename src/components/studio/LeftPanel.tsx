"use client";
import React, { useMemo, useRef, useState } from "react";
import { Layers, LayoutTemplate, Shapes, Palette, Sparkles, Eye, EyeOff, Lock, Unlock, Copy, Trash2, ArrowUp, ArrowDown, Search, Type, Image as ImageIcon, Circle, Square, Star, Triangle, Minus, Upload, Plus, Wand2 } from "lucide-react";
import { useEditor, type LeftTab } from "@/lib/store";
import { TEMPLATES } from "@/lib/templates";
import { makeLayer, makeKeyframe } from "@/lib/layers";
import type { Layer } from "@/lib/types";
import { cn, fileToDataUrl } from "@/lib/utils";
import { Badge, Button, ColorField, Field, SectionTitle, inputCls } from "@/components/ui";
import { nanoid } from "nanoid";

const TABS: { id: LeftTab; label: string; icon: React.ReactNode }[] = [
  { id: "layers", label: "Layers", icon: <Layers size={15} /> },
  { id: "templates", label: "Templates", icon: <LayoutTemplate size={15} /> },
  { id: "assets", label: "Assets", icon: <Shapes size={15} /> },
  { id: "brand", label: "Brand", icon: <Palette size={15} /> },
  { id: "effects", label: "Effects", icon: <Sparkles size={15} /> },
];

const typeIcon = (t: Layer["type"]) =>
  ({ text: <Type size={13} />, image: <ImageIcon size={13} />, ellipse: <Circle size={13} />, rect: <Square size={13} />, star: <Star size={13} />, polygon: <Triangle size={13} />, line: <Minus size={13} />, group: <Layers size={13} /> })[t];

const ANIM_PRESETS: { name: string; desc: string; apply: (l: Layer, t: number) => ReturnType<typeof makeKeyframe>[] }[] = [
  { name: "Fade Up", desc: "opacity + rise", apply: (l, t) => [makeKeyframe({ time: t, property: "opacity", value: 0, easing: "linear" }), makeKeyframe({ time: t + 0.7, property: "opacity", value: l.opacity, easing: "easeOutCubic" }), makeKeyframe({ time: t, property: "y", value: l.y + 56, easing: "linear" }), makeKeyframe({ time: t + 0.7, property: "y", value: l.y, easing: "easeOutCubic" })] },
  { name: "Pop In", desc: "elastic scale", apply: (l, t) => [makeKeyframe({ time: t, property: "scale", value: 0, easing: "linear" }), makeKeyframe({ time: t + 0.9, property: "scale", value: l.scale, easing: "easeOutElastic" }), makeKeyframe({ time: t, property: "opacity", value: 0, easing: "linear" }), makeKeyframe({ time: t + 0.3, property: "opacity", value: l.opacity, easing: "easeOut" })] },
  { name: "Slide Left", desc: "enter from right", apply: (l, t) => [makeKeyframe({ time: t, property: "x", value: l.x + 340, easing: "linear" }), makeKeyframe({ time: t + 0.8, property: "x", value: l.x, easing: "easeOutCubic" }), makeKeyframe({ time: t, property: "opacity", value: 0, easing: "linear" }), makeKeyframe({ time: t + 0.5, property: "opacity", value: l.opacity, easing: "easeOut" })] },
  { name: "Spin In", desc: "rotate + scale", apply: (l, t) => [makeKeyframe({ time: t, property: "rotation", value: l.rotation - 160, easing: "linear" }), makeKeyframe({ time: t + 0.9, property: "rotation", value: l.rotation, easing: "easeOutCubic" }), makeKeyframe({ time: t, property: "scale", value: 0.4, easing: "linear" }), makeKeyframe({ time: t + 0.9, property: "scale", value: l.scale, easing: "easeOutBack" })] },
  { name: "Pulse", desc: "breathing loop", apply: (l, t) => [0, 1, 2].flatMap((i) => [makeKeyframe({ time: t + i, property: "scale", value: l.scale, easing: "easeInOut" }), makeKeyframe({ time: t + i + 0.5, property: "scale", value: l.scale * 1.07, easing: "easeInOut" })]) },
  { name: "Float", desc: "gentle hover", apply: (l, t) => [0, 1, 2].flatMap((i) => [makeKeyframe({ time: t + i * 1.4, property: "y", value: l.y, easing: "easeInOut" }), makeKeyframe({ time: t + i * 1.4 + 0.7, property: "y", value: l.y - 18, easing: "easeInOut" })]) },
];

const FX_PRESETS = [
  { name: "Soft Shadow", fx: { type: "shadow" as const, color: "#000000", blur: 24, offsetX: 0, offsetY: 12, opacity: 0.5 } },
  { name: "Neon Glow", fx: { type: "glow" as const, color: "#7c3aed", blur: 36, opacity: 0.9 } },
  { name: "Cyan Halo", fx: { type: "glow" as const, color: "#06b6d4", blur: 28, opacity: 0.8 } },
  { name: "Dream Blur", fx: { type: "blur" as const, blur: 3, opacity: 1 } },
  { name: "Hard Offset", fx: { type: "shadow" as const, color: "#000000", blur: 0, offsetX: 8, offsetY: 8, opacity: 0.6 } },
  { name: "Outline Pop", fx: { type: "outline" as const, color: "#000000", blur: 0, opacity: 1 } },
];

export default function LeftPanel() {
  const store = useEditor();
  const { project, leftTab, setLeftTab, selectedIds, select, updateLayer, deleteLayer, duplicateLayer, reorderLayer, setProject, addLayer, currentTime, patchProject } = store;
  const [query, setQuery] = useState("");
  const [tplCat, setTplCat] = useState("All");
  const fileRef = useRef<HTMLInputElement>(null);

  const templates = useMemo(
    () => TEMPLATES.filter((t) => (tplCat === "All" || t.category === tplCat) && t.name.toLowerCase().includes(query.toLowerCase())),
    [tplCat, query],
  );
  const cats = useMemo(() => ["All", ...Array.from(new Set(TEMPLATES.map((t) => t.category)))], []);
  const selected = project.layers.find((l) => l.id === selectedIds[0]);

  const addImageFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files).slice(0, 6)) {
      const url = await fileToDataUrl(f);
      const img = new Image();
      img.src = url;
      await new Promise((r) => (img.onload = r));
      const w = Math.min(img.width || 600, project.width * 0.7);
      addLayer(makeLayer({ type: "image", name: f.name, src: url, x: (project.width - w) / 2, y: (project.height - (w * (img.height || 400)) / Math.max(1, img.width || 600)) / 2, width: w, height: (w * (img.height || 400)) / Math.max(1, img.width || 600), duration: project.duration }));
    }
  };

  return (
    <aside className="w-[248px] shrink-0 border-r border-white/[.07] bg-ink-900 flex flex-col min-h-0" aria-label="Left panel">
      <div className="flex border-b border-white/[.06] px-1 pt-1" role="tablist" aria-label="Panel tabs">
        {TABS.map((t) => (
          <button
            key={t.id} role="tab" aria-selected={leftTab === t.id}
            onClick={() => setLeftTab(t.id)}
            className={cn("flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-semibold uppercase tracking-wide rounded-t-lg transition", leftTab === t.id ? "text-white bg-white/[.05]" : "text-zinc-500 hover:text-zinc-200")}
          >
            {t.icon}
            <span className="hidden xl:block">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pb-3">
        {leftTab === "layers" && (
          <>
            <SectionTitle right={<Badge>{project.layers.length}</Badge>}>Layers</SectionTitle>
            <div className="px-1.5 space-y-0.5">
              {[...project.layers].reverse().map((l) => (
                <div
                  key={l.id}
                  onClick={() => select([l.id])}
                  className={cn("group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer text-[12px] transition", selectedIds.includes(l.id) ? "bg-violet-500/20 text-white ring-1 ring-violet-400/40" : "text-zinc-300 hover:bg-white/[.05]")}
                >
                  <span className="text-zinc-500 shrink-0">{typeIcon(l.type)}</span>
                  <span className="h-3 w-3 rounded shrink-0 ring-1 ring-white/15" style={{ background: l.gradient ? `linear-gradient(135deg,${l.gradient.stops.map((s) => s.color).join(",")})` : l.fill }} />
                  <span className="truncate flex-1">{l.name}</span>
                  <span className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button title="Bring forward" aria-label="Bring forward" className="p-0.5 text-zinc-400 hover:text-white" onClick={() => reorderLayer(l.id, 1)}><ArrowUp size={11} /></button>
                    <button title="Send backward" aria-label="Send backward" className="p-0.5 text-zinc-400 hover:text-white" onClick={() => reorderLayer(l.id, -1)}><ArrowDown size={11} /></button>
                    <button title="Duplicate" aria-label="Duplicate layer" className="p-0.5 text-zinc-400 hover:text-white" onClick={() => duplicateLayer(l.id)}><Copy size={11} /></button>
                    <button title="Delete" aria-label="Delete layer" className="p-0.5 text-zinc-400 hover:text-red-300" onClick={() => deleteLayer(l.id)}><Trash2 size={11} /></button>
                  </span>
                  <button aria-label={l.visible ? "Hide layer" : "Show layer"} className="shrink-0 text-zinc-400 hover:text-white" onClick={(e) => { e.stopPropagation(); updateLayer(l.id, { visible: !l.visible }); }}>
                    {l.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button aria-label={l.locked ? "Unlock layer" : "Lock layer"} className="shrink-0 text-zinc-400 hover:text-white" onClick={(e) => { e.stopPropagation(); updateLayer(l.id, { locked: !l.locked }); }}>
                    {l.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                </div>
              ))}
              {project.layers.length === 0 && <p className="text-[12px] text-zinc-600 px-2 py-3 leading-relaxed">Empty project. Draw with the tool rail, apply a template, or ask the Prism Agent to build something.</p>}
            </div>
          </>
        )}

        {leftTab === "templates" && (
          <>
            <div className="px-3 pt-3">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates…" className={cn(inputCls, "pl-8")} aria-label="Search templates" />
              </div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {cats.map((c) => (
                  <button key={c} onClick={() => setTplCat(c)} className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold transition", tplCat === c ? "bg-violet-600 text-white" : "bg-white/[.06] text-zinc-400 hover:text-white")}>{c}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 px-3 mt-3">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setProject({ ...t.build(), id: project.id, templateId: t.id })}
                  className="group text-left rounded-xl overflow-hidden ring-1 ring-white/10 hover:ring-violet-400/60 transition bg-ink-800"
                  title={`${t.description} — click to apply`}
                >
                  <div className="relative h-[68px]" style={{ background: `linear-gradient(135deg, ${t.accent}33, #0b0b14 70%)` }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-display font-bold text-[13px] px-2 text-center leading-tight" style={{ color: t.accent }}>{t.name.split(" ").slice(0, 2).join(" ")}</span>
                    </div>
                    <span className="absolute bottom-1 right-1 text-[8px] font-mono text-zinc-400 bg-black/50 px-1 rounded">{t.width}×{t.height}</span>
                  </div>
                  <div className="p-1.5">
                    <p className="text-[10px] font-semibold leading-tight truncate">{t.name}</p>
                    <p className="text-[9px] text-zinc-500">{t.category} · {t.duration}s</p>
                  </div>
                </button>
              ))}
            </div>
            <p className="px-3 mt-3 text-[10px] text-zinc-600 leading-relaxed">12 production templates included. Applying replaces the current composition (undo with ⌘Z).</p>
          </>
        )}

        {leftTab === "assets" && (
          <>
            <SectionTitle>Upload</SectionTitle>
            <div className="px-3">
              <input ref={fileRef} type="file" accept="image/*,.svg" multiple className="hidden" onChange={(e) => addImageFiles(e.target.files)} aria-label="Upload images" />
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}><Upload size={14} /> Upload images / SVG</Button>
              <p className="text-[10px] text-zinc-600 mt-1.5">…or drag &amp; drop files straight onto the canvas.</p>
            </div>
            <SectionTitle>Quick shapes</SectionTitle>
            <div className="grid grid-cols-4 gap-1.5 px-3">
              {([
                ["rect", <Square key="r" size={16} />, "Rectangle"],
                ["ellipse", <Circle key="e" size={16} />, "Ellipse"],
                ["polygon", <Triangle key="p" size={16} />, "Triangle"],
                ["star", <Star key="s" size={16} />, "Star"],
              ] as const).map(([type, icon, label]) => (
                <button
                  key={type} title={label} aria-label={`Add ${label}`}
                  onClick={() => addLayer(makeLayer({ type, x: project.width / 2 - 150, y: project.height / 2 - 100, width: 300, height: 220, points: type === "polygon" ? 3 : 5, duration: project.duration }))}
                  className="h-11 rounded-lg bg-white/[.04] hover:bg-violet-500/25 ring-1 ring-white/[.08] flex items-center justify-center text-zinc-300 hover:text-white transition"
                >
                  {icon}
                </button>
              ))}
            </div>
            <SectionTitle>Gradient presets</SectionTitle>
            <div className="grid grid-cols-4 gap-1.5 px-3">
              {[
                ["#7c3aed", "#06b6d4", "#d946ef"], ["#f97316", "#ef4444", "#ec4899"], ["#0ea5e9", "#22d3ee", "#2dd4bf"], ["#facc15", "#f97316", "#ef4444"],
                ["#a78bfa", "#f0abfc", "#fda4af"], ["#22c55e", "#a3e635", "#facc15"], ["#111827", "#374151", "#6b7280"], ["#f8fafc", "#cbd5e1", "#94a3b8"],
              ].map((cols, i) => (
                <button
                  key={i} title="Apply gradient to selected layer (or background)" aria-label={`Gradient preset ${i + 1}`}
                  onClick={() => {
                    const gradient = { kind: "linear" as const, angle: 135, stops: cols.map((c, j) => ({ offset: j / (cols.length - 1), color: c })) };
                    if (selected) updateLayer(selected.id, { gradient }, true);
                    else patchProject({ backgroundGradient: gradient, background: cols[0] });
                  }}
                  className="h-9 rounded-lg ring-1 ring-white/15 hover:scale-[1.04] transition"
                  style={{ background: `linear-gradient(135deg, ${cols.join(",")})` }}
                />
              ))}
            </div>
            <p className="px-3 mt-2 text-[10px] text-zinc-600">Tip: gradients apply to the selected layer, otherwise to the background.</p>
          </>
        )}

        {leftTab === "brand" && (
          <>
            <SectionTitle>Brand kit</SectionTitle>
            <div className="px-3 space-y-3">
              <Field label="Kit name">
                <input value={project.brandKit.name} onChange={(e) => patchProject({ brandKit: { ...project.brandKit, name: e.target.value } })} className={inputCls} />
              </Field>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Colors</span>
                <div className="flex gap-1.5 flex-wrap">
                  {project.brandKit.colors.map((c, i) => (
                    <div key={i} className="relative group">
                      <input
                        type="color" value={/^#[0-9a-f]{6}$/i.test(c) ? c : "#7c3aed"} aria-label={`Brand color ${i + 1}`}
                        onChange={(e) => patchProject({ brandKit: { ...project.brandKit, colors: project.brandKit.colors.map((x, j) => (j === i ? e.target.value : x)) } })}
                        className="h-9 w-9 rounded-lg cursor-pointer"
                      />
                      <button
                        className="absolute -top-1 -right-1 hidden group-hover:flex h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[8px] items-center justify-center"
                        aria-label="Remove color"
                        onClick={() => patchProject({ brandKit: { ...project.brandKit, colors: project.brandKit.colors.filter((_, j) => j !== i) } })}
                      >×</button>
                    </div>
                  ))}
                  <button aria-label="Add brand color" className="h-9 w-9 rounded-lg border border-dashed border-white/25 text-zinc-400 hover:text-white flex items-center justify-center" onClick={() => patchProject({ brandKit: { ...project.brandKit, colors: [...project.brandKit.colors, "#06b6d4"] } })}>
                    <Plus size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-zinc-600 mt-1">Click a swatch to also use it: select a layer first, then use Fill in the Inspector. The agent reads this kit.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Display font">
                  <input value={project.brandKit.fonts.display} onChange={(e) => patchProject({ brandKit: { ...project.brandKit, fonts: { ...project.brandKit.fonts, display: e.target.value } } })} className={inputCls} />
                </Field>
                <Field label="Body font">
                  <input value={project.brandKit.fonts.body} onChange={(e) => patchProject({ brandKit: { ...project.brandKit, fonts: { ...project.brandKit.fonts, body: e.target.value } } })} className={inputCls} />
                </Field>
              </div>
              <Field label="Brand voice">
                <input value={project.brandKit.voice} onChange={(e) => patchProject({ brandKit: { ...project.brandKit, voice: e.target.value } })} className={inputCls} placeholder="Bold, playful, premium…" />
              </Field>
              <Button
                variant="subtle" className="w-full"
                onClick={() => {
                  project.layers.filter((l) => l.type === "text").forEach((l, i) => updateLayer(l.id, { fontFamily: i === 0 ? project.brandKit.fonts.display : project.brandKit.fonts.body }));
                }}
              >
                <Wand2 size={13} /> Apply fonts to text layers
              </Button>
            </div>
          </>
        )}

        {leftTab === "effects" && (
          <>
            <SectionTitle>Animation presets</SectionTitle>
            <div className="px-3 space-y-1.5">
              {ANIM_PRESETS.map((p) => (
                <button
                  key={p.name} disabled={!selected}
                  onClick={() => selected && updateLayer(selected.id, { keyframes: [...selected.keyframes.filter((k) => k.time < currentTime - 0.001), ...p.apply(selected, Math.round(currentTime * 100) / 100).map((k) => ({ ...k, id: nanoid(8) }))] }, true)}
                  className="w-full text-left rounded-lg bg-white/[.04] hover:bg-violet-500/20 ring-1 ring-white/[.07] px-2.5 py-2 transition disabled:opacity-40"
                >
                  <span className="block text-[12px] font-semibold">{p.name}</span>
                  <span className="block text-[10px] text-zinc-500">{p.desc} · starts at playhead</span>
                </button>
              ))}
              {!selected && <p className="text-[11px] text-zinc-600">Select a layer to apply motion presets.</p>}
            </div>
            <SectionTitle>Layer effects</SectionTitle>
            <div className="px-3 grid grid-cols-2 gap-1.5">
              {FX_PRESETS.map((p) => (
                <button
                  key={p.name} disabled={!selected}
                  onClick={() => selected && updateLayer(selected.id, { effects: [...selected.effects, { id: nanoid(8), ...p.fx }] }, true)}
                  className="rounded-lg bg-white/[.04] hover:bg-cyan-500/20 ring-1 ring-white/[.07] px-2 py-2 text-[11px] font-medium text-left transition disabled:opacity-40"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
