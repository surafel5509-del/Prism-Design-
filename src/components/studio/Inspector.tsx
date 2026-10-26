"use client";
import React from "react";
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Diamond, Settings2, Trash2, Type as TypeIcon, SlidersHorizontal } from "lucide-react";
import { useEditor } from "@/lib/store";
import { BLEND_MODES, CANVAS_PRESETS, FONT_FAMILIES, makeKeyframe } from "@/lib/layers";
import { EASING_NAMES } from "@/lib/easing";
import type { AnimatableProperty } from "@/lib/types";
import { Button, ColorField, Field, NumberField, SectionTitle, SelectField, SliderField, inputCls } from "@/components/ui";
import { cn } from "@/lib/utils";

export default function Inspector() {
  const { project, selectedIds, updateLayer, patchProject, currentTime, addKeyframe, removeKeyframe } = useEditor();
  const layer = project.layers.find((l) => l.id === selectedIds[0]);

  if (!layer) {
    return (
      <aside className="w-[260px] shrink-0 border-l border-white/[.07] bg-ink-900 overflow-y-auto min-h-0" aria-label="Inspector">
        <SectionTitle icon={<Settings2 size={12} />}>Composition</SectionTitle>
        <div className="px-3 space-y-3 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" value={project.width} onChange={(v) => patchProject({ width: Math.max(64, v) })} suffix="px" />
            <NumberField label="Height" value={project.height} onChange={(v) => patchProject({ height: Math.max(64, v) })} suffix="px" />
            <NumberField label="Duration" value={project.duration} onChange={(v) => patchProject({ duration: Math.max(0.5, v) })} step={0.5} suffix="s" />
            <NumberField label="FPS" value={project.fps} onChange={(v) => patchProject({ fps: Math.max(12, Math.min(60, v)) })} />
          </div>
          <SelectField
            label="Canvas preset" value=""
            onChange={(v) => { const p = CANVAS_PRESETS.find((x) => x.id === v); if (p) patchProject({ width: p.width, height: p.height }); }}
            options={[{ value: "", label: "Choose preset…" }, ...CANVAS_PRESETS.map((p) => ({ value: p.id, label: p.label }))]}
          />
          <ColorField label="Background" value={project.background} onChange={(v) => patchProject({ background: v, backgroundGradient: null })} />
          {project.backgroundGradient && (
            <Button variant="ghost" size="sm" onClick={() => patchProject({ backgroundGradient: null })}>Remove background gradient</Button>
          )}
          <div className="rounded-xl bg-white/[.03] ring-1 ring-white/[.07] p-3 text-[11px] text-zinc-500 leading-relaxed">
            Select a layer on the canvas to edit its transform, fill, typography, effects and keyframes. Press <kbd className="px-1 rounded bg-white/10 font-mono">⌘K</kbd> for commands.
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Project stats</span>
            <dl className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="rounded-lg bg-white/[.03] px-2 py-1.5"><dt className="text-zinc-500">Layers</dt><dd className="font-mono text-sm">{project.layers.length}</dd></div>
              <div className="rounded-lg bg-white/[.03] px-2 py-1.5"><dt className="text-zinc-500">Keyframes</dt><dd className="font-mono text-sm">{project.layers.reduce((a, l) => a + l.keyframes.length, 0)}</dd></div>
              <div className="rounded-lg bg-white/[.03] px-2 py-1.5"><dt className="text-zinc-500">Frames</dt><dd className="font-mono text-sm">{Math.round(project.duration * project.fps)}</dd></div>
              <div className="rounded-lg bg-white/[.03] px-2 py-1.5"><dt className="text-zinc-500">Est. GIF</dt><dd className="font-mono text-sm">~{Math.max(1, Math.round((project.width * project.height * project.duration) / 900_000))} MB</dd></div>
            </dl>
          </div>
        </div>
      </aside>
    );
  }

  const set = (patch: Partial<typeof layer>) => updateLayer(layer.id, patch);
  const align = (mode: "left" | "centerH" | "right" | "top" | "centerV" | "bottom") => {
    const map = {
      left: { x: 0 }, centerH: { x: (project.width - layer.width) / 2 }, right: { x: project.width - layer.width },
      top: { y: 0 }, centerV: { y: (project.height - layer.height) / 2 }, bottom: { y: project.height - layer.height },
    } as const;
    updateLayer(layer.id, map[mode], true);
  };
  const kfAtPlayhead = (prop: AnimatableProperty) => {
    const value = prop === "x" ? layer.x : prop === "y" ? layer.y : prop === "scale" ? layer.scale : prop === "rotation" ? layer.rotation : layer.opacity;
    addKeyframe(layer.id, makeKeyframe({ time: Math.round(currentTime * 100) / 100, property: prop, value, easing: "easeOutCubic" }));
  };

  return (
    <aside className="w-[260px] shrink-0 border-l border-white/[.07] bg-ink-900 overflow-y-auto min-h-0" aria-label="Inspector">
      <SectionTitle icon={<SlidersHorizontal size={12} />}>{layer.type} layer</SectionTitle>
      <div className="px-3 space-y-3">
        <Field label="Name"><input value={layer.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={layer.x} onChange={(v) => set({ x: v })} />
          <NumberField label="Y" value={layer.y} onChange={(v) => set({ y: v })} />
          <NumberField label="Width" value={layer.width} onChange={(v) => set({ width: Math.max(1, v) })} />
          <NumberField label="Height" value={layer.height} onChange={(v) => set({ height: Math.max(1, v) })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Rotation" value={layer.rotation} onChange={(v) => set({ rotation: v })} suffix="°" />
          <NumberField label="Scale" value={layer.scale} onChange={(v) => set({ scale: v })} step={0.05} />
        </div>
        <SliderField label="Opacity" value={layer.opacity} min={0} max={1} onChange={(v) => set({ opacity: v })} format={(v) => `${Math.round(v * 100)}%`} />

        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">Align to canvas</span>
          <div className="flex gap-1">
            {([["left", <AlignStartVertical key="l" size={14} />], ["centerH", <AlignCenterVertical key="ch" size={14} />], ["right", <AlignEndVertical key="r" size={14} />], ["top", <AlignStartHorizontal key="t" size={14} />], ["centerV", <AlignCenterHorizontal key="cv" size={14} />], ["bottom", <AlignEndHorizontal key="b" size={14} />]] as const).map(([mode, icon]) => (
              <button key={mode} onClick={() => align(mode)} title={`Align ${mode}`} aria-label={`Align ${mode}`} className="h-8 flex-1 rounded-lg bg-white/[.04] hover:bg-violet-500/25 flex items-center justify-center text-zinc-300 transition">{icon}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Starts at" value={layer.startTime} step={0.1} onChange={(v) => set({ startTime: Math.max(0, v) })} suffix="s" />
          <NumberField label="Duration" value={layer.duration} step={0.1} onChange={(v) => set({ duration: Math.max(0.1, v) })} suffix="s" />
        </div>
      </div>

      <SectionTitle>Fill &amp; stroke</SectionTitle>
      <div className="px-3 space-y-3">
        <ColorField label="Fill" value={layer.fill} onChange={(v) => set({ fill: v })} />
        <div className="grid grid-cols-2 gap-2">
          <ColorField label="Stroke" value={layer.stroke === "transparent" ? "#000000" : layer.stroke} onChange={(v) => set({ stroke: v })} />
          <NumberField label="Stroke width" value={layer.strokeWidth} onChange={(v) => set({ strokeWidth: Math.max(0, v) })} />
        </div>
        <SliderField label="Corner radius" value={layer.cornerRadius} min={0} max={300} step={1} onChange={(v) => set({ cornerRadius: v })} format={(v) => `${Math.round(v)}px`} />
        <SelectField label="Blend mode" value={layer.blendMode} onChange={(v) => set({ blendMode: v })} options={BLEND_MODES.map((b) => ({ value: b, label: b }))} />
        {layer.gradient && <Button variant="ghost" size="sm" onClick={() => set({ gradient: null })}>Remove gradient fill</Button>}
        {(layer.type === "polygon" || layer.type === "star") && (
          <SliderField label="Points" value={layer.points ?? 5} min={3} max={16} step={1} onChange={(v) => set({ points: Math.round(v) })} format={(v) => `${Math.round(v)}`} />
        )}
      </div>

      {layer.type === "text" && (
        <>
          <SectionTitle icon={<TypeIcon size={12} />}>Typography</SectionTitle>
          <div className="px-3 space-y-3">
            <Field label="Content">
              <textarea value={layer.text ?? ""} onChange={(e) => set({ text: e.target.value })} rows={3} className={cn(inputCls, "h-auto py-2 resize-y")} />
            </Field>
            <SelectField label="Font" value={layer.fontFamily ?? "Inter"} onChange={(v) => set({ fontFamily: v })} options={FONT_FAMILIES.map((f) => ({ value: f, label: f }))} />
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Size" value={layer.fontSize ?? 64} onChange={(v) => set({ fontSize: Math.max(6, v) })} />
              <SelectField label="Weight" value={String(layer.fontWeight ?? 700)} onChange={(v) => set({ fontWeight: parseInt(v) })} options={[100, 300, 400, 500, 600, 700, 800, 900].map((w) => ({ value: String(w), label: String(w) }))} />
              <NumberField label="Tracking" value={layer.letterSpacing ?? 0} step={0.5} onChange={(v) => set({ letterSpacing: v })} />
              <NumberField label="Leading" value={layer.lineHeight ?? 1.1} step={0.05} onChange={(v) => set({ lineHeight: v })} />
            </div>
            <div className="flex gap-1" role="group" aria-label="Text alignment">
              {(["left", "center", "right"] as const).map((a) => (
                <button key={a} onClick={() => set({ align: a })} className={cn("h-8 flex-1 rounded-lg text-[11px] font-semibold capitalize transition", layer.align === a ? "bg-violet-600 text-white" : "bg-white/[.05] text-zinc-300 hover:bg-white/[.1]")}>{a}</button>
              ))}
            </div>
          </div>
        </>
      )}

      <SectionTitle icon={<Diamond size={12} />}>Keyframes @ {currentTime.toFixed(2)}s</SectionTitle>
      <div className="px-3">
        <div className="flex flex-wrap gap-1">
          {(["x", "y", "scale", "rotation", "opacity"] as const).map((prop) => (
            <Button key={prop} size="sm" variant="subtle" onClick={() => kfAtPlayhead(prop)} title={`Keyframe ${prop} at playhead`}>
              <Diamond size={10} /> {prop}
            </Button>
          ))}
        </div>
        <ul className="mt-2 space-y-1">
          {[...layer.keyframes].sort((a, b) => a.time - b.time).map((k) => (
            <li key={k.id} className="flex items-center gap-1.5 rounded-lg bg-white/[.03] px-2 py-1 text-[10px] font-mono">
              <Diamond size={9} className="text-amber-300 shrink-0" fill="currentColor" />
              <span className="text-zinc-300">{k.property}</span>
              <span className="text-zinc-500">{k.time.toFixed(2)}s → {Math.round(k.value * 100) / 100}</span>
              <select
                value={k.easing} aria-label="Easing"
                onChange={(e) => updateLayer(layer.id, { keyframes: layer.keyframes.map((x) => (x.id === k.id ? { ...x, easing: e.target.value as typeof k.easing } : x)) })}
                className="ml-auto bg-ink-800 border border-white/10 rounded px-1 h-5 text-[9px]"
              >
                {EASING_NAMES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={() => removeKeyframe(layer.id, k.id)} className="text-zinc-500 hover:text-red-300" aria-label="Delete keyframe"><Trash2 size={11} /></button>
            </li>
          ))}
          {layer.keyframes.length === 0 && <li className="text-[11px] text-zinc-600 py-1">No keyframes. Move the playhead, set a value, hit a ◆ button — or use Effects presets.</li>}
        </ul>
      </div>

      <SectionTitle>Effects ({layer.effects.length})</SectionTitle>
      <div className="px-3 pb-5">
        <ul className="space-y-1">
          {layer.effects.map((fx) => (
            <li key={fx.id} className="flex items-center gap-2 rounded-lg bg-white/[.03] px-2 py-1.5 text-[11px]">
              <span className="capitalize font-medium">{fx.type}</span>
              <span className="text-zinc-500 font-mono text-[10px]">{fx.color ?? ""} {fx.blur ? `${fx.blur}px` : ""}</span>
              <button className="ml-auto text-zinc-500 hover:text-red-300" aria-label="Remove effect" onClick={() => updateLayer(layer.id, { effects: layer.effects.filter((e) => e.id !== fx.id) }, true)}>
                <Trash2 size={12} />
              </button>
            </li>
          ))}
          {layer.effects.length === 0 && <li className="text-[11px] text-zinc-600">None — add from the Effects tab.</li>}
        </ul>
      </div>
    </aside>
  );
}
