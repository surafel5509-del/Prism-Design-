"use client";
import React, { useRef } from "react";
import { MousePointer2, Hand, Square, Circle, Triangle, Star, Type, ImagePlus, Sparkles } from "lucide-react";
import { useEditor, type ToolId } from "@/lib/store";
import { makeLayer } from "@/lib/layers";
import { IconBtn } from "@/components/ui";
import { fileToDataUrl } from "@/lib/utils";

const TOOLS: { id: ToolId; label: string; kbd: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Select / Move", kbd: "V", icon: <MousePointer2 size={17} /> },
  { id: "hand", label: "Hand (pan canvas)", kbd: "H", icon: <Hand size={17} /> },
  { id: "rect", label: "Rectangle", kbd: "R", icon: <Square size={17} /> },
  { id: "ellipse", label: "Ellipse", kbd: "O", icon: <Circle size={17} /> },
  { id: "polygon", label: "Polygon", kbd: "P", icon: <Triangle size={17} /> },
  { id: "star", label: "Star", kbd: "S", icon: <Star size={17} /> },
  { id: "text", label: "Text", kbd: "T", icon: <Type size={17} /> },
];

export default function ToolRail() {
  const { tool, setTool, showAI, setShowAI, project, addLayer } = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);

  const addImages = async (files: FileList | null) => {
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
    <nav className="w-12 shrink-0 border-r border-white/[.07] bg-ink-900 flex flex-col items-center py-2 gap-1" aria-label="Tools">
      {TOOLS.map((t) => (
        <IconBtn key={t.id} title={`${t.label} (${t.kbd})`} active={tool === t.id} onClick={() => setTool(t.id)}>{t.icon}</IconBtn>
      ))}
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} aria-label="Add image layer" />
      <IconBtn title="Add image (I)" onClick={() => fileRef.current?.click()}><ImagePlus size={17} /></IconBtn>
      <div className="h-px w-6 bg-white/10 my-1.5" />
      <IconBtn title="AI Agent panel" active={showAI} onClick={() => setShowAI(!showAI)}>
        <Sparkles size={17} />
      </IconBtn>
    </nav>
  );
}
