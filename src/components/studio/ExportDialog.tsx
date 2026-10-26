"use client";
import React, { useState } from "react";
import { FileImage, Film, FileJson, Shapes, Loader2, CheckCircle2 } from "lucide-react";
import { useEditor } from "@/lib/store";
import { makeCanvas, projectToLottie, projectToSvg, renderFrame } from "@/lib/render";
import { downloadBlob } from "@/lib/utils";
import { Badge, Modal } from "@/components/ui";

type Job = { id: string; label: string; progress: number; done?: boolean; error?: string };

export default function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, currentTime } = useEditor();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [gifScale, setGifScale] = useState(0.5);
  const safeName = project.name.replace(/[^\w-]+/g, "-").toLowerCase() || "prism";

  const run = async (id: string, label: string, fn: (p: (n: number) => void) => Promise<void>) => {
    setJobs((j) => [{ id, label, progress: 0 }, ...j.filter((x) => x.id !== id)]);
    try {
      await fn((n) => setJobs((j) => j.map((x) => (x.id === id ? { ...x, progress: n } : x))));
      setJobs((j) => j.map((x) => (x.id === id ? { ...x, progress: 1, done: true } : x)));
    } catch (err) {
      setJobs((j) => j.map((x) => (x.id === id ? { ...x, error: err instanceof Error ? err.message : "Export failed" } : x)));
    }
  };

  const exportPng = () =>
    run("png", "PNG — current frame", async () => {
      const c = makeCanvas(project.width, project.height);
      await renderFrame(c, project, currentTime);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) throw new Error("Canvas encoding failed");
      downloadBlob(blob, `${safeName}@${currentTime.toFixed(1)}s.png`);
    });

  const exportSvg = () =>
    run("svg", "SVG — current frame", async () => {
      downloadBlob(new Blob([projectToSvg(project, currentTime)], { type: "image/svg+xml" }), `${safeName}.svg`);
    });

  const exportJson = () =>
    run("json", "Project JSON", async () => {
      downloadBlob(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }), `${safeName}.prism.json`);
    });

  const exportLottie = () =>
    run("lottie", "Lottie JSON", async () => {
      downloadBlob(new Blob([JSON.stringify(projectToLottie(project), null, 2)], { type: "application/json" }), `${safeName}.lottie.json`);
    });

  const exportGif = () =>
    run("gif", "Animated GIF", async (progress) => {
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      const w = Math.round(project.width * gifScale);
      const h = Math.round(project.height * gifScale);
      const full = makeCanvas(project.width, project.height);
      const small = makeCanvas(w, h);
      const sctx = small.getContext("2d", { willReadFrequently: true })!;
      const gif = GIFEncoder();
      const fps = 12;
      const frames = Math.max(2, Math.round(project.duration * fps));
      for (let i = 0; i <= frames; i++) {
        const t = (i / frames) * project.duration;
        await renderFrame(full, project, t);
        sctx.clearRect(0, 0, w, h);
        sctx.drawImage(full, 0, 0, w, h);
        const { data } = sctx.getImageData(0, 0, w, h);
        const palette = quantize(data, 256);
        const index = applyPalette(data, palette);
        gif.writeFrame(index, w, h, { palette, delay: Math.round(1000 / fps), repeat: 0 });
        progress(i / frames);
        await new Promise((r) => setTimeout(r, 0));
      }
      gif.finish();
      downloadBlob(new Blob([new Uint8Array(gif.bytes())], { type: "image/gif" }), `${safeName}.gif`);
    });

  const exportVideo = () =>
    run("video", "Video (MP4/WebM)", async (progress) => {
      const c = makeCanvas(project.width, project.height);
      const stream = c.captureStream(30);
      const candidates = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
      const mime = candidates.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
      if (!mime) throw new Error("MediaRecorder is not supported in this browser");
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
      rec.start(200);
      const start = performance.now();
      const totalMs = project.duration * 1000;
      await new Promise<void>((resolve) => {
        const tick = async () => {
          const elapsed = performance.now() - start;
          const t = Math.min(project.duration, elapsed / 1000);
          await renderFrame(c, project, t);
          progress(elapsed / totalMs);
          if (elapsed < totalMs) requestAnimationFrame(tick);
          else resolve();
        };
        tick();
      });
      rec.stop();
      await stopped;
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      downloadBlob(new Blob(chunks, { type: mime.split(";")[0] }), `${safeName}.${ext}`);
    });

  const cards = [
    { icon: <Film size={18} />, title: "Video", desc: "Real-time render · MP4 where supported, else WebM", tag: `${project.width}×${project.height} · ${project.duration}s`, action: exportVideo, id: "video" },
    { icon: <FileImage size={18} />, title: "Animated GIF", desc: "12fps, palette-quantized loop", tag: `${Math.round(project.width * gifScale)}px wide`, action: exportGif, id: "gif" },
    { icon: <FileImage size={18} />, title: "PNG frame", desc: "Full-resolution still at the playhead", tag: `${project.width}×${project.height}`, action: exportPng, id: "png" },
    { icon: <Shapes size={18} />, title: "SVG", desc: "Vector snapshot of the current frame", tag: "scalable", action: exportSvg, id: "svg" },
    { icon: <FileJson size={18} />, title: "Lottie JSON", desc: "Layer + transform keyframes for lottie players", tag: "beta", action: exportLottie, id: "lottie" },
    { icon: <FileJson size={18} />, title: "Project JSON", desc: "Full .prism.json — re-import via dashboard", tag: "lossless", action: exportJson, id: "json" },
  ];

  return (
    <Modal open={open} onClose={onClose} title={`Export — ${project.name}`} wide>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Badge tone="violet">{project.width}×{project.height}</Badge>
          <Badge>{project.duration}s · {project.fps}fps</Badge>
          <Badge>{project.layers.length} layers</Badge>
          <label className="ml-auto flex items-center gap-2 text-[11px] text-zinc-400">
            GIF scale
            <select value={gifScale} onChange={(e) => setGifScale(parseFloat(e.target.value))} className="bg-ink-800 border border-white/10 rounded-lg h-7 px-1.5 text-[11px]" aria-label="GIF export scale">
              <option value={1}>100%</option>
              <option value={0.5}>50%</option>
              <option value={0.33}>33%</option>
              <option value={0.25}>25%</option>
            </select>
          </label>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((c) => {
            const job = jobs.find((j) => j.id === c.id);
            const busy = job && !job.done && !job.error;
            return (
              <button key={c.id} onClick={c.action} disabled={!!busy} className="text-left rounded-2xl bg-white/[.03] hover:bg-violet-500/[.12] ring-1 ring-white/[.08] hover:ring-violet-400/50 p-4 transition disabled:opacity-60">
                <span className="text-violet-300">{busy ? <Loader2 size={18} className="animate-spin" /> : job?.done ? <CheckCircle2 size={18} className="text-emerald-400" /> : c.icon}</span>
                <span className="block font-semibold text-sm mt-2">{c.title}</span>
                <span className="block text-[11px] text-zinc-500 mt-0.5 leading-relaxed">{c.desc}</span>
                <span className="block text-[10px] font-mono text-zinc-600 mt-1.5">{c.tag}</span>
                {job && (
                  <span className="block mt-2">
                    {job.error ? (
                      <span className="text-[11px] text-red-300">{job.error}</span>
                    ) : (
                      <span className="block h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <span className="block h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${Math.round(job.progress * 100)}%` }} />
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-600 mt-4 leading-relaxed">
          Video renders in real time in your browser (canvas capture). For long/4K renders, deploy the optional FFmpeg render worker — see <span className="font-mono">docs/DEPLOYMENT.md</span>. GIFs are encoded locally with gifenc; nothing leaves your machine.
        </p>
      </div>
    </Modal>
  );
}
