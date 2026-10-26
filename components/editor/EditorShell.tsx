'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, PanelRightClose, PanelRightOpen, Sparkles } from 'lucide-react';
import type { Project } from '@/lib/engine/types';
import { useEditor, persistProject } from '@/lib/store/editor';
import { useAgent } from '@/lib/store/agent';
import { usePlayback } from '@/lib/hooks/use-playback';
import { onAgentAction } from '@/lib/ai/bus';
import { TopBar } from '@/components/editor/TopBar';
import { ToolRail } from '@/components/editor/ToolRail';
import { LeftPanel } from '@/components/editor/LeftPanel';
import { CanvasStage } from '@/components/editor/CanvasStage';
import { Timeline } from '@/components/editor/Timeline';
import { Inspector } from '@/components/editor/Inspector';
import { AIPanel } from '@/components/editor/AIPanel';
import { StatusBar } from '@/components/editor/StatusBar';
import { CommandPalette } from '@/components/editor/CommandPalette';
import { Onboarding } from '@/components/editor/Onboarding';
import { PreviewDialog } from '@/components/editor/dialogs/PreviewDialog';
import { ExportDialog } from '@/components/editor/dialogs/ExportDialog';
import { BackgroundRemoverDialog } from '@/components/editor/dialogs/BackgroundRemoverDialog';
import { HistoryDialog } from '@/components/editor/dialogs/HistoryDialog';
import { ShareDialog } from '@/components/editor/dialogs/ShareDialog';
import { PrismLogo } from '@/components/brand/PrismLogo';
import { cn } from '@/lib/utils';

const AI_WIDTH_KEY = 'prism:ai-width';
const CLOUD_SAVE_MS = 25_000;

export function EditorShell({ projectId }: { projectId: string }) {
  const hydrated = useEditor((s) => s.hydrated);
  const timelineOpen = useEditor((s) => s.timelineOpen);
  const aiOpen = useEditor((s) => s.aiOpen);
  const toggle = useEditor((s) => s.toggle);
  const project = useEditor((s) => s.project);
  const [aiWidth, setAiWidth] = useState(348);
  const aiWidthRef = useRef(348);
  const [exportRequest, setExportRequest] = useState<{ format?: string; preset?: string } | null>(null);
  const cloudAt = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  usePlayback();

  // ── restore width ────────────────────────────────────────────────────────
  useEffect(() => {
    const stored = Number(localStorage.getItem(AI_WIDTH_KEY));
    if (stored >= 300 && stored <= 560) { setAiWidth(stored); aiWidthRef.current = stored; }
  }, []);

  useEffect(() => { aiWidthRef.current = aiWidth; }, [aiWidth]);

  // ── load the requested project ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await useEditor.getState().hydrate();
      if (cancelled) return;
      const current = useEditor.getState().project;
      if (!projectId || projectId === current.id) return;
      try {
        const { idbGet } = await import('@/lib/store/idb');
        const local = await idbGet<Project>('projects', projectId);
        if (local && !cancelled) { useEditor.getState().loadProject(local, { keepHistory: false }); return; }
      } catch { /* idb unavailable */ }
      try {
        const res = await fetch(`/api/projects?id=${encodeURIComponent(projectId)}`, { cache: 'no-store' });
        if (res.ok) {
          const json = (await res.json()) as { project?: { data?: Project } };
          if (json.project?.data && !cancelled) { useEditor.getState().loadProject(json.project.data, { keepHistory: false }); return; }
        }
      } catch { /* offline */ }
      if (!cancelled) {
        toast.message('Starting a fresh document', { description: 'That project was not found locally or in the cloud.' });
        useEditor.getState().newProject({ name: 'Untitled project' });
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // ── autosave: local immediately-ish, cloud throttled ────────────────────
  useEffect(() => {
    const unsub = useEditor.subscribe((state, prev) => {
      if (state.project === prev.project) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const doc = useEditor.getState().project;
        void persistProject(doc).then(() => useEditor.getState().markSaved()).catch(() => undefined);
        if (Date.now() - cloudAt.current > CLOUD_SAVE_MS) {
          cloudAt.current = Date.now();
          void fetch('/api/projects', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ project: { ...doc, layers: doc.layers.slice(0, 300) } }),
          }).catch(() => undefined);
        }
      }, 900);
    });
    return () => { unsub(); if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  // ── agent action bus ────────────────────────────────────────────────────
  useEffect(() => onAgentAction((action) => {
    if (action.type === 'plan') toast.message('Plan ready', { description: action.summary });
    else if (action.type === 'ask') {
      if (action.kind === 'approval') toast.message('Plan needs approval', { description: 'Review the plan in the Agent panel, then approve or edit it.' });
    } else if (action.type === 'cutout') {
      const state = useEditor.getState();
      const id = action.layerId || state.selection[0] || state.project.layers.find((l) => l.type === 'image')?.id;
      if (id) state.openCutout(id);
      toast.message('Cut-out studio ready', { description: 'Paint or colour-pick what to erase, then apply.' });
    } else if (action.type === 'preview') {
      useEditor.getState().setPreviewOpen(true);
      if (action.autoplay) useEditor.getState().setPlaying(true);
    } else if (action.type === 'export') {
      setExportRequest({ format: action.options.format, preset: action.options.preset });
      useEditor.getState().setExportOpen(true);
    } else if (action.type === 'saved') {
      toast.success('Saved to your cloud projects');
    }
  }), []);

  // ── version history ──────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    const open = () => setHistoryOpen(true);
    window.addEventListener('prism:open-history', open);
    return () => window.removeEventListener('prism:open-history', open);
  }, []);

  // ── open-preview event from the AI panel ────────────────────────────────
  useEffect(() => {
    const handler = () => useEditor.getState().setPreviewOpen(true);
    window.addEventListener('prism:open-preview', handler);
    return () => window.removeEventListener('prism:open-preview', handler);
  }, []);

  const saveNow = useCallback(async () => {
    const doc = useEditor.getState().project;
    await persistProject(doc, { versionLabel: 'Manual save', forceVersion: true });
    useEditor.getState().markSaved();
    void fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project: { ...doc, layers: doc.layers.slice(0, 300) } }) })
      .then(() => toast.success('Saved locally and to your cloud library'))
      .catch(() => toast.success('Saved locally'));
  }, []);

  // ── keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.tagName === 'SELECT');
      const mod = e.metaKey || e.ctrlKey;
      const ed = useEditor.getState();

      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void saveNow(); return; }
      if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); ed.setExportOpen(true); return; }
      if (mod && e.key === 'Enter') { e.preventDefault(); ed.setPreviewOpen(true); return; }
      if (mod && e.key.toLowerCase() === 'j') { e.preventDefault(); ed.toggle('aiOpen'); setTimeout(() => window.dispatchEvent(new CustomEvent('prism:focus-ai')), 80); return; }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); ed.setPaletteOpen(!ed.paletteOpen); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) ed.redo(); else ed.undo(); return; }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); ed.selectAll(); return; }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); ed.duplicateLayers(); return; }
      if (mod && e.key.toLowerCase() === 'g') { e.preventDefault(); if (e.shiftKey) ed.ungroup(); else ed.groupSelected(); return; }
      if (mod && e.key.toLowerCase() === 'c') { e.preventDefault(); ed.copySelection(); return; }
      if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); ed.paste(); return; }
      if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); ed.zoomAt(1.15, ed.viewport.w / 2, ed.viewport.h / 2); return; }
      if (mod && e.key === '-') { e.preventDefault(); ed.zoomAt(1 / 1.15, ed.viewport.w / 2, ed.viewport.h / 2); return; }
      if (mod && e.key === '0') { e.preventDefault(); ed.setView({ zoom: 1 }); return; }

      if (e.key === ' ') { e.preventDefault(); ed.togglePlay(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (ed.selection.length) { e.preventDefault(); ed.deleteLayers(); } return; }
      if (e.key === 'Escape') { ed.select([]); return; }
      if (e.key === '?' ) { ed.setOnboardingStep(0); return; }
      if (e.key === '[') { ed.stepFrames(-1); return; }
      if (e.key === ']') { ed.stepFrames(1); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (!ed.selection.length) return;
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        ed.selection.forEach((id) => {
          const layer = ed.project.layers.find((l) => l.id === id);
          if (layer) ed.updateLayer(id, { x: layer.x + dx, y: layer.y + dy }, { history: false });
        });
        return;
      }
      const tools: Record<string, Parameters<typeof ed.setTool>[0]> = { v: 'select', h: 'hand', r: 'shape', t: 'text', p: 'pen', z: 'zoom', i: 'image' };
      if (tools[e.key.toLowerCase()] && !e.altKey) { ed.setTool(tools[e.key.toLowerCase()]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveNow]);

  // ── first-run provider nudge ────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch('/api/ai/providers', { cache: 'no-store' });
        const json = await res.json();
        if ((json.connectedCount ?? 0) === 0 && !sessionStorage.getItem('prism:key-nudge')) {
          sessionStorage.setItem('prism:key-nudge', '1');
          toast.message('The agent needs a model', {
            description: 'Add an API key for OpenAI, Anthropic, Google or any compatible endpoint to bring the agent online.',
            action: { label: 'Connect', onClick: () => window.open('/settings/ai', '_blank') },
            duration: 9000,
          });
        }
      } catch { /* offline */ }
    }, 4500);
    return () => clearTimeout(t);
  }, []);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = aiWidth;
    const move = (ev: PointerEvent) => {
      const next = Math.max(300, Math.min(560, startW - (ev.clientX - startX)));
      setAiWidth(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      try { localStorage.setItem(AI_WIDTH_KEY, String(aiWidthRef.current)); } catch { /* noop */ }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (!hydrated) {
    return (
      <div className="grid h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <PrismLogo className="h-12 w-12" />
            <span className="absolute inset-0 animate-ping rounded-2xl bg-violet-500/10" />
          </div>
          <p className="prism-text text-[13px] font-semibold tracking-tight">Opening Prism Studio</p>
          <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Restoring your canvas…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ToolRail />
        <LeftPanel />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <div className="relative min-w-0 flex-1">
              <CanvasStage />
            </div>

            <div className="hidden shrink-0 lg:flex">
              <Inspector />
            </div>

            {aiOpen && (
              <>
                <div
                  onPointerDown={startResize}
                  className="group relative w-1 shrink-0 cursor-col-resize bg-border/60 transition-colors hover:bg-violet-400/50"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize agent panel"
                >
                  <span className="absolute inset-y-0 -left-1 -right-1" />
                </div>
                <div style={{ width: aiWidth }} className="shrink-0">
                  <AIPanel />
                </div>
              </>
            )}

            {!aiOpen && (
              <button
                onClick={() => toggle('aiOpen')}
                className="group hidden w-8 shrink-0 flex-col items-center gap-2 border-l border-border/70 bg-panel/50 py-3 text-muted-foreground transition-colors hover:bg-violet-500/[0.06] hover:text-violet-200 sm:flex"
                title="Open Prism Agent (⌘J)"
                aria-label="Open agent panel"
              >
                <PanelRightOpen className="h-3.5 w-3.5" />
                <span className="mt-1 [writing-mode:vertical-rl] text-[9px] uppercase tracking-[0.18em]">Agent</span>
                <Sparkles className="mt-auto h-3 w-3 text-violet-400/70" />
              </button>
            )}
          </div>
          {timelineOpen && <Timeline />}
        </div>
      </div>
      <StatusBar />

      {aiOpen && (
        <button
          onClick={() => toggle('aiOpen')}
          className="sr-only"
          aria-label="Close agent panel"
        ><PanelRightClose /></button>
      )}

      <CommandPalette />
      <PreviewDialog
        onExport={() => { useEditor.getState().setPreviewOpen(false); setExportRequest(null); useEditor.getState().setExportOpen(true); }}
        onShare={() => { useEditor.getState().setPreviewOpen(false); useEditor.getState().setShareOpen(true); }}
      />
      <ExportDialog request={exportRequest} onDone={() => setExportRequest(null)} />
      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
      <ShareDialog />
      <BackgroundRemoverDialog />
      <Onboarding />

      <div className={cn('fixed inset-0 z-[140] hidden place-items-center bg-background p-6 text-center max-lg:grid')} aria-hidden="true">
        <div className="max-w-sm">
          <PrismLogo className="mx-auto h-10 w-10" />
          <p className="prism-text mt-3 text-[15px] font-semibold">Prism Studio is built for the desktop</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">The canvas, timeline and agent need room to breathe. Open this project on a screen at least 1024px wide — your work is autosaved.</p>
        </div>
      </div>
    </div>
  );
}
