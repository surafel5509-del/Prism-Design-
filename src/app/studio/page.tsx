"use client";
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TopBar from "@/components/studio/TopBar";
import ToolRail from "@/components/studio/ToolRail";
import LeftPanel from "@/components/studio/LeftPanel";
import CanvasStage from "@/components/studio/CanvasStage";
import Timeline from "@/components/studio/Timeline";
import Inspector from "@/components/studio/Inspector";
import AIPanel from "@/components/studio/AIPanel";
import ExportDialog from "@/components/studio/ExportDialog";
import CommandPalette, { type PaletteCommand } from "@/components/studio/CommandPalette";
import { useEditor, type ToolId } from "@/lib/store";
import { emptyProject } from "@/lib/layers";
import { getTemplate } from "@/lib/templates";
import type { PrismProject } from "@/lib/types";

function StatusBar() {
  const { project, currentTime, playing, saveState, selectedIds } = useEditor();
  const [fps, setFps] = useState(60);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      frames++;
      if (now - last >= 1000) { setFps(Math.round((frames * 1000) / (now - last))); frames = 0; last = now; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <footer className="h-6 shrink-0 flex items-center gap-4 px-3 text-[10px] font-mono text-zinc-500 border-t border-white/[.06] bg-ink-900" aria-label="Status bar">
      <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${playing ? "bg-emerald-400 animate-pulseDot" : "bg-zinc-600"}`} />{playing ? "Playing" : "Paused"}</span>
      <span>{project.width}×{project.height}</span>
      <span>{project.duration}s · {project.fps}fps comp</span>
      <span>UI {fps}fps</span>
      <span className="hidden md:inline">{project.layers.length} layers · {project.layers.reduce((a, l) => a + l.keyframes.length, 0)} keyframes</span>
      {selectedIds[0] && <span className="hidden lg:inline text-violet-300">selected: {project.layers.find((l) => l.id === selectedIds[0])?.name}</span>}
      <span className="ml-auto">{saveState === "saved" ? "✓ autosaved locally + server" : "… autosaving"}</span>
      <span className="hidden sm:inline">t={currentTime.toFixed(2)}s</span>
    </footer>
  );
}

function StudioInner() {
  const params = useSearchParams();
  const store = useEditor();
  const [exportOpen, setExportOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- initial load: ?project= / ?template= / local draft
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const templateId = params.get("template");
    const projectId = params.get("project");
    (async () => {
      if (templateId && getTemplate(templateId)) {
        store.setProject(getTemplate(templateId)!.build(), false);
        return;
      }
      if (projectId) {
        try {
          const res = await fetch(`/api/projects?id=${projectId}`);
          const data = await res.json();
          if (data.project) { store.setProject(data.project as PrismProject, false); store.markSaved(); return; }
        } catch { /* fall through */ }
        try {
          const raw = localStorage.getItem(`prism:project:${projectId}`);
          if (raw) { store.setProject(JSON.parse(raw) as PrismProject, false); return; }
        } catch { /* noop */ }
      }
      try {
        const draft = localStorage.getItem("prism:draft");
        if (draft) { store.setProject(JSON.parse(draft) as PrismProject, false); return; }
      } catch { /* noop */ }
      // First-run showcase so the studio never opens empty.
      const showcase = getTemplate("neon-product-launch");
      if (showcase) store.setProject(showcase.build(), false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- playback loop
  useEffect(() => {
    if (!store.playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const s = useEditor.getState();
      const next = s.currentTime + dt;
      if (next >= s.project.duration) {
        if (s.loop) s.setTime(next % s.project.duration);
        else { s.setTime(s.project.duration); s.setPlaying(false); return; }
      } else s.setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.playing]);

  // --- autosave (local draft + server file store)
  useEffect(() => {
    if (store.saveState !== "dirty") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const p = useEditor.getState().project;
      try { localStorage.setItem("prism:draft", JSON.stringify(p)); localStorage.setItem(`prism:project:${p.id}`, JSON.stringify(p)); } catch { /* quota */ }
      try {
        await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project: p }) });
      } catch { /* server optional */ }
      useEditor.getState().markSaved();
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [store.project, store.saveState]);

  // --- keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable;
      const s = useEditor.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen((v) => !v); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); if (s.selectedIds[0]) s.duplicateLayer(s.selectedIds[0]); return; }
      if (typing) return;
      const key = e.key.toLowerCase();
      if (e.key === " ") { e.preventDefault(); s.setPlaying(!s.playing); }
      else if (e.key === "Delete" || e.key === "Backspace") { if (s.selectedIds[0]) { e.preventDefault(); s.deleteLayer(s.selectedIds[0]); } }
      else if (e.key === "Home") s.setTime(0);
      else if (e.key === "End") s.setTime(s.project.duration);
      else if (e.key === "ArrowLeft") { e.preventDefault(); s.setTime(s.currentTime - (e.shiftKey ? 1 : 1 / s.project.fps)); }
      else if (e.key === "ArrowRight") { e.preventDefault(); s.setTime(s.currentTime + (e.shiftKey ? 1 : 1 / s.project.fps)); }
      else if (e.key === "Escape") { s.select([]); setPaletteOpen(false); }
      else {
        const tools: Record<string, ToolId> = { v: "select", h: "hand", r: "rect", o: "ellipse", p: "polygon", s: "star", t: "text" };
        if (tools[key] && !e.metaKey && !e.ctrlKey) s.setTool(tools[key]);
        if (["arrowup", "arrowdown"].includes(key) && s.selectedIds[0]) {
          e.preventDefault();
          const l = s.project.layers.find((x) => x.id === s.selectedIds[0]);
          if (l) s.updateLayer(l.id, { y: l.y + (key === "arrowdown" ? 1 : -1) * (e.shiftKey ? 10 : 1) });
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const paletteExtras: PaletteCommand[] = [
    { id: "export", label: "Export… (video / GIF / PNG / SVG / Lottie)", run: () => setExportOpen(true) },
    { id: "blank-hd", label: "New HD 1920×1080 project", run: () => store.setProject(emptyProject({ id: store.project.id, width: 1920, height: 1080 })) },
    { id: "blank-ig", label: "New Instagram 1080×1080 project", run: () => store.setProject(emptyProject({ id: store.project.id, width: 1080, height: 1080 })) },
    { id: "blank-story", label: "New Story 1080×1920 project", run: () => store.setProject(emptyProject({ id: store.project.id, width: 1080, height: 1920 })) },
  ];

  const openExport = useCallback(() => setExportOpen(true), []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-ink-950">
      <TopBar onExport={openExport} onCommandPalette={() => setPaletteOpen(true)} />
      <div className="flex flex-1 min-h-0">
        <ToolRail />
        <LeftPanel />
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <CanvasStage />
          <Timeline />
        </main>
        <Inspector />
        {store.showAI && <AIPanel onExport={openExport} />}
      </div>
      <StatusBar />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} extras={paletteExtras} />
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-ink-950 text-zinc-400 text-sm">Loading Prism Studio…</div>}>
      <StudioInner />
    </Suspense>
  );
}
