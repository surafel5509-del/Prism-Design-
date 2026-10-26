'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlignCenter, History, Command as CommandIcon, Download, Eye, Grid3x3, Image as ImageIcon, Layers, LayoutTemplate, Moon,
  MousePointer2, PanelLeft, PenTool, Play, Plus, Redo2, Ruler, Search, Settings2, Share2, Shapes, Sparkles, Square, Sun,
  Type, Undo2, Wand2, Zap, Scissors,
} from 'lucide-react';
import { useEditor } from '@/lib/store/editor';
import { useAgent } from '@/lib/store/agent';
import { useTheme } from '@/lib/hooks/use-theme';
import { getTemplates } from '@/lib/data/templates';
import { cn } from '@/lib/utils';
import { Kbd } from '@/components/ui/misc';

interface Cmd {
  id: string;
  label: string;
  group: string;
  hint?: string;
  icon?: React.ReactNode;
  keys?: string[];
  run: () => void;
}

export function CommandPalette() {
  const open = useEditor((s) => s.paletteOpen);
  const setOpen = useEditor((s) => s.setPaletteOpen);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { setTheme, resolved } = useTheme();

  useEffect(() => {
    // ⌘K is owned by EditorShell so the store flag stays the single source of truth.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 20); }
  }, [open]);

  const commands = useMemo<Cmd[]>(() => {
    const ed = () => useEditor.getState();
    const focusAI = () => { if (!ed().aiOpen) ed().toggle('aiOpen'); setTimeout(() => window.dispatchEvent(new CustomEvent('prism:focus-ai')), 60); };
    const base: Cmd[] = [
      { id: 'tool-select', label: 'Select tool', group: 'Tools', keys: ['V'], icon: <MousePointer2 className="h-3.5 w-3.5" />, run: () => ed().setTool('select') },
      { id: 'tool-hand', label: 'Hand tool', group: 'Tools', keys: ['H'], icon: <MousePointer2 className="h-3.5 w-3.5" />, run: () => ed().setTool('hand') },
      { id: 'tool-shape', label: 'Shape tool', group: 'Tools', keys: ['R'], icon: <Shapes className="h-3.5 w-3.5" />, run: () => ed().setTool('shape') },
      { id: 'tool-text', label: 'Text tool', group: 'Tools', keys: ['T'], icon: <Type className="h-3.5 w-3.5" />, run: () => ed().setTool('text') },
      { id: 'tool-pen', label: 'Pen tool', group: 'Tools', keys: ['P'], icon: <PenTool className="h-3.5 w-3.5" />, run: () => ed().setTool('pen') },
      { id: 'tool-zoom', label: 'Zoom tool', group: 'Tools', keys: ['Z'], icon: <Search className="h-3.5 w-3.5" />, run: () => ed().setTool('zoom') },
      { id: 'play', label: 'Play / pause timeline', group: 'Canvas', keys: ['Space'], icon: <Play className="h-3.5 w-3.5" />, run: () => ed().togglePlay() },
      { id: 'fit', label: 'Fit canvas to view', group: 'Canvas', keys: ['⇧', '1'], icon: <Square className="h-3.5 w-3.5" />, run: () => ed().fitView() },
      { id: 'grid', label: 'Toggle grid', group: 'Canvas', icon: <Grid3x3 className="h-3.5 w-3.5" />, run: () => ed().toggle('showGrid') },
      { id: 'rulers', label: 'Toggle rulers', group: 'Canvas', icon: <Ruler className="h-3.5 w-3.5" />, run: () => ed().toggle('showRulers') },
      { id: 'snap', label: 'Toggle snapping', group: 'Canvas', icon: <AlignCenter className="h-3.5 w-3.5" />, run: () => ed().toggle('snap') },
      { id: 'timeline', label: 'Toggle timeline', group: 'Panels', icon: <Layers className="h-3.5 w-3.5" />, run: () => ed().toggle('timelineOpen') },
      { id: 'left', label: 'Toggle left panel', group: 'Panels', icon: <PanelLeft className="h-3.5 w-3.5" />, run: () => ed().toggle('leftOpen') },
      { id: 'ai', label: 'Open Prism Agent', group: 'Panels', keys: ['⌘', 'J'], icon: <Sparkles className="h-3.5 w-3.5" />, run: focusAI },
      { id: 'undo', label: 'Undo', group: 'Edit', keys: ['⌘', 'Z'], icon: <Undo2 className="h-3.5 w-3.5" />, run: () => ed().undo() },
      { id: 'redo', label: 'Redo', group: 'Edit', keys: ['⇧', '⌘', 'Z'], icon: <Redo2 className="h-3.5 w-3.5" />, run: () => ed().redo() },
      { id: 'dup', label: 'Duplicate selection', group: 'Edit', keys: ['⌘', 'D'], icon: <Layers className="h-3.5 w-3.5" />, run: () => ed().duplicateLayers() },
      { id: 'group', label: 'Group selection', group: 'Edit', keys: ['⌘', 'G'], icon: <Layers className="h-3.5 w-3.5" />, run: () => ed().groupSelected() },
      { id: 'new', label: 'New project', group: 'Project', icon: <Plus className="h-3.5 w-3.5" />, run: () => ed().newProject() },
      { id: 'preview', label: 'Review preview', group: 'Project', icon: <Eye className="h-3.5 w-3.5" />, run: () => ed().setPreviewOpen(true) },
      { id: 'export', label: 'Export project', group: 'Project', keys: ['⌘', 'E'], icon: <Download className="h-3.5 w-3.5" />, run: () => ed().setExportOpen(true) },
      { id: 'share', label: 'Share link', group: 'Project', icon: <Share2 className="h-3.5 w-3.5" />, run: () => ed().setShareOpen(true) },
      { id: 'theme', label: `Switch to ${resolved === 'dark' ? 'light' : 'dark'} theme`, group: 'App', icon: resolved === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />, run: () => setTheme(resolved === 'dark' ? 'light' : 'dark') },
      { id: 'cutout', label: 'Remove background (manual cut-out)', group: 'Edit', hint: 'Brush or colour-pick what to erase', icon: <Scissors className="h-3.5 w-3.5" />, run: () => { const st = ed(); const id = st.selection[0] ?? st.project.layers.find((l) => l.type === 'image' && l.media?.src)?.id; if (id) st.openCutout(id); } },
      { id: 'history', label: 'Version history', group: 'Project', hint: 'Restore a snapshot', icon: <History className="h-3.5 w-3.5" />, run: () => window.dispatchEvent(new CustomEvent('prism:open-history')) },
      { id: 'settings', label: 'Open AI settings', group: 'App', icon: <Settings2 className="h-3.5 w-3.5" />, run: () => window.open('/settings/ai', '_blank') },
      { id: 'dashboard', label: 'Go to dashboard', group: 'App', icon: <LayoutTemplate className="h-3.5 w-3.5" />, run: () => { window.location.href = '/dashboard'; } },
    ];

    const templates = getTemplates();
    const tplCmds: Cmd[] = ['Poster', 'Social', 'Motion', 'Story', 'YouTube', 'Ad', 'Logo', 'Presentation'].map((cat) => {
      const t = templates.find((x) => x.category === cat);
      return {
        id: `tpl-${cat}`, label: `Insert ${cat.toLowerCase()} template`, group: 'Templates', hint: t?.name, icon: <LayoutTemplate className="h-3.5 w-3.5" />,
        run: () => { if (t) useEditor.getState().applyTemplate(t, 'replace'); },
      };
    });

    const aiCmds: Cmd[] = [
      { id: 'ai-motion', label: 'Ask agent: cinematic 8s promo', group: 'Agent', icon: <Zap className="h-3.5 w-3.5" />, run: () => { useAgent.getState().setDraftPrompt('Design and animate a cinematic 8-second promo. One bold headline, one supporting line, an accent shape that sweeps in, and a subtle grain finish.'); focusAI(); } },
      { id: 'ai-poster', label: 'Ask agent: bold event poster', group: 'Agent', icon: <ImageIcon className="h-3.5 w-3.5" />, run: () => { useAgent.getState().setDraftPrompt('Design a bold, editorial event poster with a strong typographic hierarchy, a duotone hero image and a clear CTA.'); focusAI(); } },
      { id: 'ai-animate', label: 'Ask agent: animate the current design', group: 'Agent', icon: <Wand2 className="h-3.5 w-3.5" />, run: () => { useAgent.getState().setDraftPrompt('Animate the current design: stagger the text entrances, add a slow parallax push on the imagery, and finish with a clean hold.'); focusAI(); } },
    ];

    return [...base, ...aiCmds, ...tplCmds];
  }, [resolved, setTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.group} ${c.label} ${c.hint ?? ''}`.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, commands]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const grouped = useMemo(() => {
    const map = new Map<string, Cmd[]>();
    filtered.forEach((c) => {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    });
    return [...map.entries()];
  }, [filtered]);

  const flat = grouped.flatMap(([, list]) => list);
  const run = (cmd: Cmd) => { setOpen(false); setTimeout(() => cmd.run(), 40); };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[120] flex items-start justify-center bg-black/55 px-4 pt-[14vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setOpen(false)}>
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={{ duration: 0.16 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-border bg-popover/95 shadow-[0_40px_120px_-30px_rgba(0,0,0,.9)] backdrop-blur-2xl"
          >
            <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
              <CommandIcon className="h-3.5 w-3.5 text-violet-300" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(flat.length - 1, a + 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
                  if (e.key === 'Enter' && flat[active]) { e.preventDefault(); run(flat[active]); }
                }}
                placeholder="Search commands, tools and templates…"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
              />
              <Kbd>esc</Kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
              {grouped.length === 0 && <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">No commands match “{query}”.</p>}
              {grouped.map(([group, list]) => (
                <div key={group} className="mb-1">
                  <p className="px-2 py-1 text-[8.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">{group}</p>
                  {list.map((cmd) => {
                    const index = flat.indexOf(cmd);
                    return (
                      <button
                        key={cmd.id}
                        data-index={index}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => run(cmd)}
                        className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors', index === active ? 'bg-violet-500/15 text-foreground' : 'text-foreground/75 hover:bg-white/[0.04]')}
                      >
                        <span className={cn('grid h-6 w-6 place-items-center rounded-md', index === active ? 'bg-violet-500/20 text-violet-200' : 'bg-white/[0.05] text-muted-foreground')}>{cmd.icon}</span>
                        <span className="min-w-0 flex-1 truncate text-[12px]">{cmd.label}</span>
                        {cmd.hint && <span className="hidden max-w-[130px] truncate text-[10px] text-muted-foreground sm:block">{cmd.hint}</span>}
                        {cmd.keys && <span className="flex shrink-0 items-center gap-0.5">{cmd.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 border-t border-border/70 px-3 py-1.5 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1"><Kbd>↑↓</Kbd> navigate</span>
              <span className="flex items-center gap-1"><Kbd>⏎</Kbd> run</span>
              <span className="ml-auto flex items-center gap-1"><Sparkles className="h-2.5 w-2.5 text-violet-300" /> {commands.length} commands</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
