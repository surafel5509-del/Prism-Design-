"use client";
import React from "react";
import Link from "next/link";
import { Undo2, Redo2, Download, Settings, Sparkles, Grid3X3, Magnet, ZoomIn, ZoomOut, Home, CheckCircle2, Loader2, Command } from "lucide-react";
import { useEditor } from "@/lib/store";
import { Button, IconBtn, PrismLogo } from "@/components/ui";

export default function TopBar({ onExport, onCommandPalette }: { onExport: () => void; onCommandPalette: () => void }) {
  const { project, patchProject, undo, redo, past, future, zoom, setZoom, showAI, setShowAI, showGrid, toggleGrid, snap, toggleSnap, saveState } = useEditor();

  return (
    <header className="h-12 shrink-0 flex items-center gap-2 px-3 border-b border-white/[.07] bg-ink-900 z-30">
      <Link href="/" className="flex items-center gap-2 mr-1" aria-label="Prism home">
        <PrismLogo size={24} />
        <span className="font-display font-bold tracking-[.18em] text-sm hidden sm:block">
          <span className="prism-text">PRISM</span>
        </span>
      </Link>
      <IconBtn title="Dashboard" onClick={() => (window.location.href = "/")}><Home size={15} /></IconBtn>

      <input
        value={project.name}
        onChange={(e) => patchProject({ name: e.target.value })}
        className="h-8 w-44 md:w-56 rounded-lg bg-transparent hover:bg-white/[.05] focus:bg-white/[.06] border border-transparent focus:border-violet-400/50 px-2 text-[13px] font-medium outline-none transition"
        aria-label="Project name"
      />
      <span className="flex items-center gap-1 text-[10px] text-zinc-500" role="status" aria-label={saveState === "saved" ? "All changes saved" : "Saving"}>
        {saveState === "saved" ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Loader2 size={12} className="animate-spin text-amber-300" />}
        <span className="hidden md:inline">{saveState === "saved" ? "Saved" : "Autosaving…"}</span>
      </span>

      <div className="h-5 w-px bg-white/10 mx-1 hidden md:block" />
      <IconBtn title="Undo (⌘Z)" onClick={undo} disabled={past.length === 0}><Undo2 size={15} /></IconBtn>
      <IconBtn title="Redo (⌘⇧Z)" onClick={redo} disabled={future.length === 0}><Redo2 size={15} /></IconBtn>

      <div className="h-5 w-px bg-white/10 mx-1 hidden lg:block" />
      <div className="hidden lg:flex items-center gap-1">
        <IconBtn title="Zoom out" onClick={() => setZoom(zoom * 0.85)}><ZoomOut size={15} /></IconBtn>
        <button onClick={() => setZoom(1)} className="text-[11px] font-mono text-zinc-400 hover:text-white w-12 text-center" title="Reset zoom to fit">{Math.round(zoom * 100)}%</button>
        <IconBtn title="Zoom in" onClick={() => setZoom(zoom * 1.18)}><ZoomIn size={15} /></IconBtn>
        <IconBtn title="Toggle grid" active={showGrid} onClick={toggleGrid}><Grid3X3 size={15} /></IconBtn>
        <IconBtn title="Toggle snapping" active={snap} onClick={toggleSnap}><Magnet size={15} /></IconBtn>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCommandPalette} title="Command palette (⌘K)">
          <Command size={13} /> <span className="hidden md:inline">⌘K</span>
        </Button>
        <Button variant={showAI ? "primary" : "outline"} size="sm" onClick={() => setShowAI(!showAI)} title="Toggle AI Agent panel">
          <Sparkles size={14} /> Agent
        </Button>
        <Link href="/settings" aria-label="Settings — AI providers">
          <IconBtn title="Settings · AI Providers"><Settings size={16} /></IconBtn>
        </Link>
        <Button size="sm" onClick={onExport} className="h-8">
          <Download size={14} /> Export
        </Button>
        <span className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[11px] font-bold text-white ml-1" title="Local profile — connect Supabase/Clerk for teams" aria-label="User profile">P</span>
      </div>
    </header>
  );
}
