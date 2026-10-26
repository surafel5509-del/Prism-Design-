"use client";
import React, { useMemo, useRef, useState } from "react";
import { SkipBack, SkipForward, Play, Pause, Repeat, Plus, Diamond, ChevronDown, ChevronRight } from "lucide-react";
import { useEditor } from "@/lib/store";
import { makeKeyframe } from "@/lib/layers";
import { EASING_NAMES, evaluateLayer } from "@/lib/easing";
import type { AnimatableProperty, EasingName } from "@/lib/types";
import { cn, fmtTime } from "@/lib/utils";
import { IconBtn } from "@/components/ui";

const ANIM_PROPS: AnimatableProperty[] = ["x", "y", "scale", "rotation", "opacity"];
const TRACK_H = 26;

export default function Timeline() {
  const { project, currentTime, setTime, playing, setPlaying, loop, selectedIds, select, addKeyframe, removeKeyframe, updateLayer } = useEditor();
  const [pxPerSec, setPxPerSec] = useState(90);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const trackRef = useRef<HTMLDivElement>(null);
  const totalW = Math.max(600, project.duration * pxPerSec);

  const scrub = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTime(((clientX - rect.left + (trackRef.current?.scrollLeft ?? 0)) / pxPerSec));
  };

  const rulerTicks = useMemo(() => Array.from({ length: Math.ceil(project.duration) + 1 }, (_, i) => i), [project.duration]);

  return (
    <section className="border-t border-white/[.07] bg-ink-900 flex flex-col shrink-0" aria-label="Timeline">
      {/* transport */}
      <div className="flex items-center gap-1 px-3 h-11 border-b border-white/[.06]">
        <IconBtn title="Go to start (Home)" onClick={() => setTime(0)}><SkipBack size={15} /></IconBtn>
        <button
          onClick={() => setPlaying(!playing)}
          className="h-8 w-10 rounded-lg flex items-center justify-center text-white bg-gradient-to-r from-violet-600 to-fuchsia-500 shadow-glow hover:brightness-110 transition"
          aria-label={playing ? "Pause (Space)" : "Play (Space)"} title="Play/Pause (Space)"
        >
          {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <IconBtn title="Go to end (End)" onClick={() => setTime(project.duration)}><SkipForward size={15} /></IconBtn>
        <IconBtn title="Loop playback" active={loop} onClick={() => useEditor.setState({ loop: !loop })}><Repeat size={15} /></IconBtn>

        <div className="ml-2 font-mono text-[13px] tabular-nums">
          <span className="text-cyan-300">{fmtTime(currentTime)}</span>
          <span className="text-zinc-600"> / {fmtTime(project.duration)}</span>
          <span className="text-zinc-600 ml-2 hidden md:inline">frame {Math.round(currentTime * project.fps)}/{Math.round(project.duration * project.fps)} · {project.fps}fps</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold hidden sm:block">Zoom</label>
          <input type="range" min={30} max={260} value={pxPerSec} onChange={(e) => setPxPerSec(parseFloat(e.target.value))} className="w-24" aria-label="Timeline zoom" />
          <span className="text-[10px] text-zinc-500 font-mono w-14 text-right">{Math.round(pxPerSec)}px/s</span>
        </div>
      </div>

      <div className="flex overflow-hidden" style={{ height: 168 }}>
        {/* track headers */}
        <div className="w-48 shrink-0 border-r border-white/[.06] overflow-hidden bg-ink-900 z-10">
          <div className="h-6 border-b border-white/[.06] px-2 flex items-center text-[9px] font-bold uppercase tracking-[.14em] text-zinc-500">Tracks</div>
          <div className="overflow-y-auto" style={{ height: 142 }}>
            {[...project.layers].reverse().map((l) => (
              <React.Fragment key={l.id}>
                <button
                  onClick={() => select([l.id])}
                  className={cn("w-full flex items-center gap-1 px-1.5 text-left text-[11px] truncate", selectedIds.includes(l.id) ? "bg-violet-500/20 text-white" : "text-zinc-400 hover:bg-white/[.04]")}
                  style={{ height: TRACK_H }}
                >
                  <span
                    role="button" tabIndex={0} aria-label={expanded[l.id] ? "Collapse keyframes" : "Expand keyframes"}
                    onClick={(e) => { e.stopPropagation(); setExpanded({ ...expanded, [l.id]: !expanded[l.id] }); }}
                    onKeyDown={(e) => e.key === "Enter" && setExpanded({ ...expanded, [l.id]: !expanded[l.id] })}
                    className="text-zinc-500 hover:text-white shrink-0"
                  >
                    {expanded[l.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: l.gradient ? l.gradient.stops[0]?.color : l.fill }} />
                  <span className="truncate">{l.name}</span>
                  <span className="ml-auto text-zinc-600 font-mono text-[9px]">{l.keyframes.length}◆</span>
                </button>
                {expanded[l.id] && ANIM_PROPS.map((prop) => (
                  <div key={prop} className="flex items-center pl-8 pr-2 text-[10px] text-zinc-500" style={{ height: 18 }}>
                    <span className="capitalize">{prop}</span>
                    <button
                      className="ml-auto text-zinc-500 hover:text-cyan-300" title={`Add ${prop} keyframe at playhead`}
                      aria-label={`Add ${prop} keyframe`}
                      onClick={() => {
                        const ev = evaluateLayer(l, currentTime);
                        const v = prop === "x" ? ev._x : prop === "y" ? ev._y : prop === "scale" ? ev._scale : prop === "rotation" ? ev._rotation : ev._opacity;
                        addKeyframe(l.id, makeKeyframe({ time: Math.round(currentTime * 100) / 100, property: prop, value: v, easing: "easeOutCubic" }));
                      }}
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                ))}
              </React.Fragment>
            ))}
            {project.layers.length === 0 && <p className="px-3 py-4 text-[11px] text-zinc-600">No layers yet. Add one from the tool rail or ask the agent.</p>}
          </div>
        </div>

        {/* track lanes */}
        <div
          ref={trackRef}
          className="flex-1 overflow-auto relative cursor-crosshair"
          onPointerDown={(e) => {
            scrub(e.clientX);
            const move = (ev: PointerEvent) => scrub(ev.clientX);
            const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
        >
          <div className="relative" style={{ width: totalW, minHeight: "100%" }}>
            {/* ruler */}
            <div className="h-6 border-b border-white/[.06] relative sticky top-0 bg-ink-900 z-10">
              {rulerTicks.map((s) => (
                <span key={s} className="absolute top-1 text-[9px] font-mono text-zinc-500 border-l border-white/10 pl-1 h-4" style={{ left: s * pxPerSec }}>{s}s</span>
              ))}
            </div>
            {[...project.layers].reverse().map((l) => (
              <React.Fragment key={l.id}>
                <div className={cn("relative border-b border-white/[.04]", selectedIds.includes(l.id) && "bg-violet-500/[.06]")} style={{ height: TRACK_H }}>
                  <div
                    className="absolute top-[3px] h-5 rounded-md bg-gradient-to-r from-violet-600/70 to-fuchsia-500/50 border border-violet-300/30 flex items-center px-1.5 overflow-hidden"
                    style={{ left: l.startTime * pxPerSec, width: Math.max(14, l.duration * pxPerSec) }}
                    title={`${l.name} · ${l.startTime.toFixed(1)}s → ${(l.startTime + l.duration).toFixed(1)}s (drag edges in Inspector to trim)`}
                  >
                    <span className="text-[9px] font-medium text-white/90 truncate">{l.name}</span>
                  </div>
                </div>
                {expanded[l.id] && ANIM_PROPS.map((prop) => (
                  <div key={prop} className="relative border-b border-white/[.03]" style={{ height: 18 }}>
                    {l.keyframes.filter((k) => k.property === prop).map((k) => (
                      <button
                        key={k.id}
                        title={`${prop} = ${Math.round(k.value * 100) / 100} @ ${k.time.toFixed(2)}s · ${k.easing} — alt+click cycles easing, right-click deletes`}
                        aria-label={`Keyframe ${prop} at ${k.time.toFixed(2)} seconds`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-amber-300 hover:text-amber-100"
                        style={{ left: k.time * pxPerSec }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          if (e.altKey) {
                            const idx = EASING_NAMES.indexOf(k.easing);
                            const nextEasing = EASING_NAMES[(idx + 1) % EASING_NAMES.length] as EasingName;
                            updateLayer(l.id, { keyframes: l.keyframes.map((x) => (x.id === k.id ? { ...x, easing: nextEasing } : x)) });
                          } else setTime(k.time);
                        }}
                        onContextMenu={(e) => { e.preventDefault(); removeKeyframe(l.id, k.id); }}
                      >
                        <Diamond size={11} className="kf-diamond" fill="currentColor" />
                      </button>
                    ))}
                  </div>
                ))}
              </React.Fragment>
            ))}
            {/* playhead */}
            <div className="absolute top-0 bottom-0 w-px bg-cyan-300 pointer-events-none z-20" style={{ left: currentTime * pxPerSec }}>
              <span className="absolute -top-0 -left-[5px] h-3 w-[11px] bg-cyan-300 rounded-b-sm" style={{ clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
