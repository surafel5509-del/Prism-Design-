"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useEditor } from "@/lib/store";
import { TEMPLATES } from "@/lib/templates";
import { emptyProject, makeLayer } from "@/lib/layers";
import { cn } from "@/lib/utils";

export interface PaletteCommand { id: string; label: string; hint?: string; run: () => void }

export default function CommandPalette({ open, onClose, extras }: { open: boolean; onClose: () => void; extras: PaletteCommand[] }) {
  const store = useEditor();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  const commands: PaletteCommand[] = useMemo(() => {
    const p = store.project;
    const base: PaletteCommand[] = [
      { id: "play", label: store.playing ? "Pause playback" : "Play preview", hint: "Space", run: () => store.setPlaying(!store.playing) },
      { id: "ai", label: "Toggle AI Agent panel", run: () => store.setShowAI(!store.showAI) },
      { id: "new", label: "New blank project", run: () => store.setProject(emptyProject({ id: p.id })) },
      { id: "add-text", label: "Add text layer", hint: "T", run: () => store.addLayer(makeLayer({ type: "text", text: "HEADLINE", x: p.width / 2 - 400, y: p.height / 2 - 60, width: 800, height: 120, fontSize: Math.round(p.width * 0.06), fill: "#fff", duration: p.duration })) },
      { id: "add-rect", label: "Add rectangle", hint: "R", run: () => store.addLayer(makeLayer({ type: "rect", x: p.width / 2 - 200, y: p.height / 2 - 120, width: 400, height: 240, duration: p.duration })) },
      { id: "center", label: "Center selected layer", run: () => { const l = p.layers.find((x) => x.id === store.selectedIds[0]); if (l) store.updateLayer(l.id, { x: (p.width - l.width) / 2, y: (p.height - l.height) / 2 }, true); } },
      { id: "undo", label: "Undo", hint: "⌘Z", run: () => store.undo() },
      { id: "redo", label: "Redo", hint: "⌘⇧Z", run: () => store.redo() },
      { id: "settings", label: "Open Settings · AI Providers", run: () => (window.location.href = "/settings") },
      { id: "dash", label: "Go to Dashboard", run: () => (window.location.href = "/") },
      ...TEMPLATES.map<PaletteCommand>((t) => ({ id: `tpl-${t.id}`, label: `Template: ${t.name}`, hint: t.category, run: () => store.setProject({ ...t.build(), id: p.id, templateId: t.id }) })),
      ...extras,
    ];
    return base.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, store.project, store.playing, store.showAI, extras]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center pt-[14vh] p-4" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass rounded-2xl shadow-pop w-full max-w-xl overflow-hidden animate-rise">
        <div className="flex items-center gap-2 px-4 border-b border-white/[.07]">
          <Search size={16} className="text-zinc-500" />
          <input
            ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            placeholder="Type a command or search templates…"
            className="flex-1 h-12 bg-transparent outline-none text-sm placeholder:text-zinc-600"
            aria-label="Search commands"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx(Math.min(idx + 1, commands.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx(Math.max(idx - 1, 0)); }
              if (e.key === "Enter" && commands[idx]) { commands[idx].run(); onClose(); }
              if (e.key === "Escape") onClose();
            }}
          />
          <kbd className="text-[10px] font-mono text-zinc-500 bg-white/[.06] px-1.5 py-0.5 rounded">esc</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1.5" role="listbox">
          {commands.map((c, i) => (
            <li key={c.id}>
              <button
                role="option" aria-selected={i === idx}
                onMouseEnter={() => setIdx(i)}
                onClick={() => { c.run(); onClose(); }}
                className={cn("w-full flex items-center gap-2 px-4 py-2 text-left text-[13px] transition", i === idx ? "bg-violet-500/20 text-white" : "text-zinc-300")}
              >
                <span className="flex-1 truncate">{c.label}</span>
                {c.hint && <span className="text-[10px] font-mono text-zinc-500">{c.hint}</span>}
              </button>
            </li>
          ))}
          {commands.length === 0 && <li className="px-4 py-6 text-sm text-zinc-600 text-center">No matching commands</li>}
        </ul>
      </div>
    </div>
  );
}
