'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Check, Download, FileArchive, FileCode2, FileJson2, FileText, Film, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Wand2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEditor } from '@/lib/store/editor';
import { runExport, downloadBlob, pickVideoMime, type ExportFormat, type ExportOptions, type ExportResult } from '@/lib/export/exporters';
import { smartReframeOps } from '@/lib/ai/skills';
import { applyOps } from '@/lib/engine/ops';
import { SceneCanvas } from '@/components/canvas/SceneCanvas';
import { cn } from '@/lib/utils';

type SizeId = 'project' | '1080p' | '4k' | 'ig-post' | 'ig-story' | 'tiktok' | 'youtube';

const FORMATS: { id: ExportFormat; label: string; hint: string; icon: React.ReactNode; group: 'video' | 'image' | 'data' }[] = [
  { id: 'mp4', label: 'MP4', hint: 'H.264 · social ready', icon: <Film className="h-3.5 w-3.5" />, group: 'video' },
  { id: 'webm', label: 'WebM', hint: 'VP9 · alpha capable', icon: <Film className="h-3.5 w-3.5" />, group: 'video' },
  { id: 'gif', label: 'GIF', hint: 'Looping · ≤600px', icon: <FileArchive className="h-3.5 w-3.5" />, group: 'video' },
  { id: 'png', label: 'PNG', hint: 'Transparent still', icon: <ImageIcon className="h-3.5 w-3.5" />, group: 'image' },
  { id: 'jpg', label: 'JPG', hint: 'Compressed photo', icon: <ImageIcon className="h-3.5 w-3.5" />, group: 'image' },
  { id: 'svg', label: 'SVG', hint: 'Vector frame', icon: <FileCode2 className="h-3.5 w-3.5" />, group: 'image' },
  { id: 'pdf', label: 'PDF', hint: 'Print / deck', icon: <FileText className="h-3.5 w-3.5" />, group: 'image' },
  { id: 'lottie', label: 'Lottie', hint: 'Motion JSON', icon: <FileJson2 className="h-3.5 w-3.5" />, group: 'data' },
  { id: 'json', label: 'Project', hint: 'Editable backup', icon: <FileJson2 className="h-3.5 w-3.5" />, group: 'data' },
];

const SIZES: { id: SizeId; label: string; dims?: [number, number] }[] = [
  { id: 'project', label: 'Project' },
  { id: '1080p', label: '1080p' },
  { id: '4k', label: '4K' },
  { id: 'ig-post', label: 'IG post', dims: [1080, 1080] },
  { id: 'ig-story', label: 'IG story', dims: [1080, 1920] },
  { id: 'tiktok', label: 'TikTok', dims: [1080, 1920] },
  { id: 'youtube', label: 'YouTube', dims: [1920, 1080] },
];

export function ExportDialog({ request, onDone }: { request: { format?: string; preset?: string } | null; onDone: () => void }) {
  const open = useEditor((s) => s.exportOpen);
  const setOpen = useEditor((s) => s.setExportOpen);
  const project = useEditor((s) => s.project);
  const time = useEditor((s) => s.time);

  const [format, setFormat] = useState<ExportFormat>('mp4');
  const [size, setSize] = useState<SizeId>('project');
  const [fps, setFps] = useState(project.fps);
  const [quality, setQuality] = useState(0.92);
  const [transparent, setTransparent] = useState(false);
  const [poster, setPoster] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isVideo = format === 'mp4' || format === 'webm' || format === 'gif';
  const supportsAlpha = format === 'png' || format === 'gif' || format === 'webm';

  useEffect(() => {
    if (!open || !request) return;
    if (request.format && FORMATS.some((f) => f.id === request.format)) setFormat(request.format as ExportFormat);
    if (request.preset === 'ig-post' || request.preset === 'instagram-square') setSize('ig-post');
    if (request.preset === 'ig-story' || request.preset === 'instagram-portrait' || request.preset === 'tiktok') setSize('ig-story');
    if (request.preset === 'youtube') setSize('youtube');
    if (request.preset === '4k') setSize('4k');
    if (request.preset === '1080p') setSize('1080p');
  }, [open, request]);

  useEffect(() => { setFps(project.fps); }, [project.fps]);
  useEffect(() => {
    if (!open) { setBusy(false); setProgress(0); setNote(''); setError(null); setResult(null); abortRef.current?.abort(); }
  }, [open]);

  const dims = useMemo(() => {
    const preset = SIZES.find((s) => s.id === size);
    if (preset?.dims) return { w: preset.dims[0], h: preset.dims[1], label: `${preset.dims[0]}×${preset.dims[1]}` };
    if (size === '1080p' || size === '4k') {
      const long = size === '4k' ? 3840 : 1920;
      const s = long / Math.max(project.width, project.height);
      return { w: Math.round(project.width * s), h: Math.round(project.height * s), label: `${Math.round(project.width * s)}×${Math.round(project.height * s)}` };
    }
    return { w: project.width, h: project.height, label: `${project.width}×${project.height}` };
  }, [size, project.width, project.height]);

  const aspectMismatch = Math.abs(dims.w / dims.h - project.width / project.height) > 0.02;
  const mp4Info = useMemo(() => pickVideoMime(true), []);

  const reframe = () => {
    const frame = smartReframeOps(project, aspectToAspect(dims.w / dims.h));
    const res = applyOps(project, [
      { op: 'set_project', patch: { width: frame.width, height: frame.height } },
      ...frame.updates.map((u) => ({ op: 'update_layer' as const, id: u.id, patch: { x: u.x, y: u.y, w: u.w, h: u.h } })),
    ]);
    useEditor.getState().replaceProjectFromAgent(res.project);
    toast.success(`Reframed to ${frame.width}×${frame.height}`);
  };

  const start = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    setProgress(0);
    setNote('Preparing renderer');
    const controller = new AbortController();
    abortRef.current = controller;
    const opts: ExportOptions = {
      format, width: dims.w, height: dims.h, fps, transparent: transparent && supportsAlpha,
      quality, startTime: format === 'png' || format === 'jpg' || format === 'svg' || format === 'pdf' ? time : 0,
      endTime: project.duration,
      onProgress: (pct, n) => { setProgress(pct); if (n) setNote(n); },
      signal: controller.signal,
    };
    try {
      const out = await runExport(project, opts);
      setResult(out);
      setProgress(100);
      downloadBlob(out.blob, out.filename);
      toast.success(`Exported ${out.filename}`);
      if (poster && format !== 'png' && format !== 'jpg') {
        const still = await runExport(project, { ...opts, format: 'png', transparent: false, startTime: time });
        setTimeout(() => downloadBlob(still.blob, still.filename), 400);
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') toast.message('Export cancelled');
      else setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); if (!v) onDone(); } }}>
      <DialogContent className="max-w-[min(96vw,760px)] gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Export project</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500/25 to-violet-500/15 ring-1 ring-cyan-400/25">
            <Download className="h-3.5 w-3.5 text-cyan-200" />
          </span>
          <div>
            <p className="text-[12.5px] font-semibold tracking-tight">Export</p>
            <p className="text-[9.5px] text-muted-foreground">Rendered locally in this browser — your work never leaves the device unless you share it.</p>
          </div>
          {result && <Badge variant="success" className="ml-auto h-5">Done</Badge>}
        </div>

        <div className="grid max-h-[74vh] grid-cols-1 overflow-y-auto sm:grid-cols-[1fr_230px]">
          <div className="space-y-3 p-3.5">
            <section>
              <Label>Format</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    disabled={busy}
                    onClick={() => {
                      setFormat(f.id);
                      setTransparent(f.id === 'png' || f.id === 'gif' || f.id === 'webm');
                      setResult(null);
                    }}
                    className={cn(
                      'group relative flex flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-left transition-all disabled:opacity-50',
                      format === f.id ? 'border-violet-400/40 bg-violet-500/[0.12] shadow-[0_0_0_1px_rgba(139,92,246,.15)]' : 'border-border/70 bg-white/[0.02] hover:border-border hover:bg-white/[0.04]',
                    )}
                  >
                    <span className={cn('flex items-center gap-1.5 text-[11px] font-medium', format === f.id ? 'text-violet-100' : 'text-foreground/85')}>
                      {f.icon}{f.label}
                      {f.id === 'mp4' && mp4Info.ext === 'webm' && <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{f.hint}</span>
                    {format === f.id && <Check className="absolute right-1.5 top-1.5 h-2.5 w-2.5 text-violet-300" />}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <Label>Size</Label>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {SIZES.map((s) => (
                  <button
                    key={s.id}
                    disabled={busy}
                    onClick={() => setSize(s.id)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-[10px] transition-colors disabled:opacity-50',
                      size === s.id ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100' : 'border-border/70 text-muted-foreground hover:border-border hover:text-foreground',
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-mono text-foreground/80">{dims.label}</span>
                <span>· {isVideo ? `${project.duration.toFixed(1)}s @ ${fps}fps` : `frame at ${time.toFixed(2)}s`}</span>
              </div>
              {aspectMismatch && !isNaN(dims.w) && (
                <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-400/25 bg-amber-500/[0.07] px-2 py-1.5 text-[10px] text-amber-100/80">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                  <span>This aspect differs from the canvas, so content would stretch. Reframe first for a clean crop.</span>
                  <button onClick={reframe} disabled={busy} className="ml-auto shrink-0 rounded border border-amber-300/30 px-1.5 py-0.5 text-[9.5px] font-medium text-amber-100 hover:bg-amber-300/10">Reframe</button>
                </div>
              )}
            </section>

            <section className="grid grid-cols-2 gap-2">
              {(format !== 'png' && format !== 'svg' && format !== 'pdf' && format !== 'json' && format !== 'lottie') && (
                <div>
                  <Label>Frame rate</Label>
                  <div className="mt-1 flex gap-1">
                    {[24, 30, 60].map((f) => (
                      <button key={f} disabled={busy} onClick={() => setFps(f)} className={cn('flex-1 rounded-md border px-1 py-1 text-[10px] transition-colors disabled:opacity-50', fps === f ? 'border-violet-400/35 bg-violet-500/10 text-violet-100' : 'border-border/70 text-muted-foreground hover:text-foreground')}>{f}</button>
                    ))}
                  </div>
                </div>
              )}
              {(format === 'jpg' || format === 'mp4' || format === 'webm') && (
                <div>
                  <Label>Quality · {Math.round(quality * 100)}%</Label>
                  <input type="range" min={0.4} max={1} step={0.02} value={quality} disabled={busy} onChange={(e) => setQuality(Number(e.target.value))} className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-violet-400 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-300" />
                </div>
              )}
            </section>

            <section className="flex flex-wrap gap-2">
              <Toggle label="Transparent background" checked={transparent && supportsAlpha} disabled={!supportsAlpha || busy} onChange={setTransparent} />
              <Toggle label="Also export PNG poster" checked={poster} disabled={busy || format === 'png' || format === 'jpg'} onChange={setPoster} />
            </section>

            {isVideo && (
              <p className="text-[9.5px] leading-relaxed text-muted-foreground">
                {format === 'gif' ? 'GIF frames are rendered offline and quantized to 8-bit — best under 10s and 600px.' : `Video is captured in real time from the canvas using MediaRecorder${mp4Info.ext === 'webm' ? ' (this browser encodes WebM, not H.264)' : ''}. Keep this tab focused and visible during the capture.`}
              </p>
            )}

            {error && (
              <div className="flex items-start gap-1.5 rounded-lg border border-rose-400/25 bg-rose-500/[0.07] px-2 py-1.5 text-[10.5px] text-rose-200">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {error}
              </div>
            )}

            {busy && (
              <div className="rounded-lg border border-border/70 bg-black/25 p-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin text-violet-300" /> {note || 'Rendering…'}</span>
                  <span className="font-mono">{Math.round(progress)}%</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-cyan-400 to-fuchsia-400" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                </div>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-2 border-t border-border/70 bg-panel/50 p-3 sm:border-l sm:border-t-0">
            <div className="overflow-hidden rounded-lg border border-border/70 bg-black/40">
              <div className="relative" style={{ aspectRatio: `${project.width} / ${project.height}` }}>
                <ExportThumb />
              </div>
              <div className="px-2 py-1.5">
                <p className="truncate text-[10px] font-medium text-foreground/85">{project.name}</p>
                <p className="text-[9px] text-muted-foreground">{dims.label} · {format.toUpperCase()}</p>
              </div>
            </div>

            {result ? (
              <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/[0.07] p-2">
                <p className="text-[10px] font-medium text-emerald-200">Export complete</p>
                <p className="mt-0.5 truncate font-mono text-[9px] text-emerald-100/70">{result.filename}</p>
                <p className="text-[9px] text-emerald-100/60">{fmtBytes(result.blob.size)} · {result.format.toUpperCase()}</p>
                {result.note && <p className="mt-1 text-[9px] leading-snug text-amber-200/80">{result.note}</p>}
                <Button size="xs" variant="secondary" className="mt-1.5 h-6 w-full" onClick={() => downloadBlob(result.blob, result.filename)}>
                  <Download className="h-2.5 w-2.5" /> Download again
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-border/70 bg-white/[0.02] p-2 text-[9.5px] leading-relaxed text-muted-foreground">
                <Sparkles className="mb-1 h-3 w-3 text-violet-300" />
                Exports use the same renderer as the canvas, so what you see is exactly what you get — including keyframes, effects and gradients.
              </div>
            )}

            <div className="mt-auto space-y-1.5">
              {busy ? (
                <Button variant="secondary" className="w-full" onClick={() => { abortRef.current?.abort(); toast.message('Cancelling…'); }}>
                  <X className="h-3.5 w-3.5" /> Cancel export
                </Button>
              ) : (
                <Button variant="prism" className="w-full" onClick={start}>
                  {result ? <RefreshCw className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                  {result ? 'Export again' : 'Export now'}
                </Button>
              )}
              <button onClick={() => { if (!busy) { setOpen(false); onDone(); } }} className="w-full rounded-md py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground" disabled={busy}>Close</button>
            </div>

            {format === 'mp4' && <p className="text-center text-[8.5px] text-muted-foreground/60"><Wand2 className="mr-1 inline h-2.5 w-2.5" />H.265/ProRes need a desktop encoder</p>}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExportThumb() {
  const project = useEditor((s) => s.project);
  const time = useEditor((s) => s.time);
  return <SceneCanvas project={project} time={time} className="h-full w-full" ariaLabel="Export preview" />;
}

function aspectToAspect(ratio: number): '16:9' | '9:16' | '1:1' | '4:5' {
  if (ratio > 1.2) return '16:9';
  if (ratio < 0.7) return '9:16';
  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  return '4:5';
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/80">{children}</p>;
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition-colors disabled:opacity-40', checked ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100' : 'border-border/70 text-muted-foreground hover:text-foreground')}
    >
      <span className={cn('grid h-3 w-3 place-items-center rounded-[3px] border', checked ? 'border-cyan-300/60 bg-cyan-400/70 text-black' : 'border-muted-foreground/40')}>{checked && <Check className="h-2 w-2" />}</span>
      {label}
    </button>
  );
}

const fmtBytes = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
