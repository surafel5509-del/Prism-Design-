'use client';
import { useCallback, useEffect, useState } from 'react';
import { Clock, History, Loader2, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SceneCanvas } from '@/components/canvas/SceneCanvas';
import { useEditor, persistProject } from '@/lib/store/editor';
import { clearVersions, listVersions, countKeyframes, type VersionSnapshot } from '@/lib/store/versions';
import { cn } from '@/lib/utils';

export function HistoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const project = useEditor((s) => s.project);
  const [versions, setVersions] = useState<VersionSnapshot[] | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const load = useCallback(async () => {
    setVersions(null);
    setVersions(await listVersions(project.id));
  }, [project.id]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  const restore = async (version: VersionSnapshot) => {
    setRestoring(version.vid);
    try {
      const ed = useEditor.getState();
      ed.pushHistory();
      ed.loadProject({ ...version.project, updatedAt: Date.now() }, { keepHistory: true });
      await persistProject(useEditor.getState().project, { versionLabel: 'Restored' });
      useEditor.getState().markSaved();
      toast.success(`Restored ${new Date(version.at).toLocaleTimeString()} · ${version.layers} layers`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not restore that version');
    } finally { setRestoring(null); }
  };

  const wipe = async () => {
    await clearVersions(project.id);
    setVersions([]);
    toast.success('Version history cleared');
  };

  const current = countKeyframes(project);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0">
        <DialogTitle className="sr-only">Version history</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-500/12 text-violet-300"><History className="h-3.5 w-3.5" /></span>
          <div>
            <p className="text-[12.5px] font-semibold tracking-tight">Version history</p>
            <p className="text-[9.5px] text-muted-foreground">Local snapshots of “{project.name}”, newest first · up to 10 kept</p>
          </div>
          <button onClick={() => void wipe()} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9.5px] text-muted-foreground transition-colors hover:text-rose-300">
            <Trash2 className="h-2.5 w-2.5" /> Clear
          </button>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/[0.06] px-2.5 py-2">
            <Sparkles className="h-3.5 w-3.5 text-violet-300" />
            <div className="min-w-0">
              <p className="text-[10.5px] font-medium text-violet-100">Current · {project.layers.length} layers · {current} keyframes</p>
              <p className="text-[9px] text-muted-foreground">Autosaves a snapshot every 45 seconds and on manual save.</p>
            </div>
          </div>

          {versions === null && (
            <div className="grid gap-2 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[104px] animate-pulse rounded-xl border border-border/60 bg-white/[0.02]" />)}
            </div>
          )}

          {versions?.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/70 py-10 text-center">
              <Clock className="mx-auto h-5 w-5 text-muted-foreground/60" />
              <p className="mt-1.5 text-[11px] text-muted-foreground">No snapshots yet</p>
              <p className="text-[9.5px] text-muted-foreground/60">They appear as you edit and save.</p>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {versions?.map((v) => (
              <div key={v.vid} className="group overflow-hidden rounded-xl border border-border/70 bg-white/[0.015]">
                <div className="relative h-[84px] overflow-hidden border-b border-border/60 bg-black/40">
                  <SceneCanvas project={v.project} time={Math.min(0.6, v.project.duration / 3)} className="h-full w-full" quality={0.55} ariaLabel={`Version ${new Date(v.at).toLocaleTimeString()}`} />
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white/70 backdrop-blur">{v.label}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium">{new Date(v.at).toLocaleString()}</p>
                    <p className="text-[8.5px] text-muted-foreground">{v.layers} layers · {v.keyframes} keyframes</p>
                  </div>
                  <button
                    onClick={() => void restore(v)}
                    disabled={restoring !== null}
                    className={cn('ml-auto inline-flex h-6 items-center gap-1 rounded-md border border-border/70 px-1.5 text-[9.5px] transition-colors hover:border-violet-400/40 hover:text-violet-200 disabled:opacity-50')}
                  >
                    {restoring === v.vid ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RotateCcw className="h-2.5 w-2.5" />} Restore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border/70 px-4 py-2 text-[9px] text-muted-foreground">
          Snapshots live in this browser (IndexedDB). Restoring keeps your current state in the undo stack.
        </div>
      </DialogContent>
    </Dialog>
  );
}
