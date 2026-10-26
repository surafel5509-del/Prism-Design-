'use client';
import * as React from 'react';
import Link from 'next/link';
import { useEditor } from '@/lib/store/editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/misc';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PrismLogo } from '@/components/brand/PrismLogo';
import { useTheme } from '@/lib/hooks/use-theme';
import {
  ChevronDown, Undo2, Redo2, Play, Share2, Download, Settings, Sparkles, Sun, Moon,
  FilePlus2, FolderOpen, Copy, Save, Keyboard, HelpCircle, Scissors, Rows3, LayoutGrid,
  Maximize, Minus, Plus, Cloud, CloudOff, Check, Command, Languages,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function TopBar() {
  const project = useEditor((s) => s.project);
  const dirty = useEditor((s) => s.dirty);
  const savedAt = useEditor((s) => s.savedAt);
  const zoom = useEditor((s) => s.view.zoom);
  const past = useEditor((s) => s.past.length);
  const future = useEditor((s) => s.future.length);
  const aiOpen = useEditor((s) => s.aiOpen);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const patchProject = useEditor((s) => s.patchProject);
  const newProject = useEditor((s) => s.newProject);
  const fitView = useEditor((s) => s.fitView);
  const setView = useEditor((s) => s.setView);
  const zoomAt = useEditor((s) => s.zoomAt);
  const setPreviewOpen = useEditor((s) => s.setPreviewOpen);
  const setExportOpen = useEditor((s) => s.setExportOpen);
  const setShareOpen = useEditor((s) => s.setShareOpen);
  const setPaletteOpen = useEditor((s) => s.setPaletteOpen);
  const setOnboardingStep = useEditor((s) => s.setOnboardingStep);
  const toggle = useEditor((s) => s.toggle);
  const viewport = useEditor((s) => s.viewport);
  const { resolved, toggle: toggleTheme } = useTheme();
  const [name, setName] = React.useState(project.name);
  const [editing, setEditing] = React.useState(false);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => { setName(project.name); }, [project.id, project.name]);
  React.useEffect(() => { const i = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(i); }, []);

  const commitName = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== project.name) patchProject({ name: trimmed }, { history: true });
    else setName(project.name);
  };

  const ago = savedAt ? Math.max(0, Math.round((now - savedAt) / 1000)) : null;
  const savedLabel = dirty ? 'Saving…' : savedAt ? ago! < 6 ? 'Saved' : `Saved ${ago! < 60 ? `${ago}s` : `${Math.round(ago! / 60)}m`} ago` : 'Local project';

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border/70 bg-panel/80 px-2.5 backdrop-blur-xl">
      <Link href="/" className="flex items-center gap-1.5 rounded-lg px-1 py-1 transition-opacity hover:opacity-90" aria-label="Prism home">
        <PrismLogo className="h-6 w-6" />
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Main menu"><Rows3 className="h-3.5 w-3.5" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel>Project</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => { newProject({ name: 'Untitled project' }); toast.success('New project created'); }}>
            <FilePlus2 className="h-3.5 w-3.5" /> New project <span className="ml-auto"><Kbd>⌘N</Kbd></span>
          </DropdownMenuItem>
          <DropdownMenuItem asChild><Link href="/dashboard"><FolderOpen className="h-3.5 w-3.5" /> Open project…</Link></DropdownMenuItem>
          <DropdownMenuItem onClick={() => { const p = useEditor.getState().project; useEditor.getState().newProject({ ...p, id: undefined, name: `${p.name} copy` }); toast.success('Project duplicated'); }}>
            <Copy className="h-3.5 w-3.5" /> Duplicate project <span className="ml-auto"><Kbd>⌘D</Kbd></span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { void import('@/lib/store/editor').then(({ persistProject }) => persistProject(useEditor.getState().project, { versionLabel: 'Manual save', forceVersion: true })).then(() => toast.success('Snapshot saved to version history')); }}>
            <Save className="h-3.5 w-3.5" /> Save snapshot <span className="ml-auto"><Kbd>⌘S</Kbd></span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('prism:open-history'))}>
            <History className="h-3.5 w-3.5" /> Version history…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Edit</DropdownMenuLabel>
          <DropdownMenuItem onClick={undo} disabled={!past}><Undo2 className="h-3.5 w-3.5" /> Undo <span className="ml-auto"><Kbd>⌘Z</Kbd></span></DropdownMenuItem>
          <DropdownMenuItem onClick={redo} disabled={!future}><Redo2 className="h-3.5 w-3.5" /> Redo <span className="ml-auto"><Kbd>⇧⌘Z</Kbd></span></DropdownMenuItem>
          <DropdownMenuItem onClick={() => useEditor.getState().selectAll()}><LayoutGrid className="h-3.5 w-3.5" /> Select all <span className="ml-auto"><Kbd>⌘A</Kbd></span></DropdownMenuItem>
          <DropdownMenuItem onClick={() => { useEditor.getState().deleteLayers(); }}><Scissors className="h-3.5 w-3.5" /> Delete selection <span className="ml-auto"><Kbd>⌫</Kbd></span></DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>View</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => toggle('showRulers')}>Rulers <span className="ml-auto text-[10px] text-muted-foreground">⇧R</span></DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggle('showGrid')}>Grid <span className="ml-auto text-[10px] text-muted-foreground">⇧G</span></DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggle('showSafe')}>Safe areas</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggle('snap')}>Snapping</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPaletteOpen(true)}><Command className="h-3.5 w-3.5" /> Command palette <span className="ml-auto"><Kbd>⌘K</Kbd></span></DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOnboardingStep(0)}><HelpCircle className="h-3.5 w-3.5" /> Product tour</DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.info('Shortcuts', { description: 'V select · R rect · T text · Space play · ⌘K palette · ⌘E export' })}><Keyboard className="h-3.5 w-3.5" /> Keyboard shortcuts</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href="/settings"><Settings className="h-3.5 w-3.5" /> Settings</Link></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mx-1 flex min-w-0 items-center gap-2">
        {editing ? (
          <Input
            autoFocus value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setName(project.name); setEditing(false); } }}
            className="h-7 w-52 text-xs"
            aria-label="Project name"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="group flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-foreground/90 transition-colors hover:bg-accent" title="Rename project">
            <span className="max-w-[220px] truncate font-medium">{project.name}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        )}
        <div className="hidden items-center gap-1.5 lg:flex">
          <Badge variant={dirty ? 'warning' : 'secondary'} className="gap-1 text-[9.5px]">
            {dirty ? <Cloud className="h-2.5 w-2.5" /> : savedAt ? <Cloud className="h-2.5 w-2.5" /> : <CloudOff className="h-2.5 w-2.5" />}
            {savedLabel}
          </Badge>
          <span className="rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">{project.width}×{project.height}</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="mr-1 hidden items-center rounded-lg border border-border/70 bg-background/40 p-0.5 md:flex">
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={undo} disabled={!past} aria-label="Undo"><Undo2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Undo <Kbd className="ml-1">⌘Z</Kbd></TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={redo} disabled={!future} aria-label="Redo"><Redo2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Redo <Kbd className="ml-1">⇧⌘Z</Kbd></TooltipContent></Tooltip>
        </div>

        <div className="mr-1 hidden items-center gap-0.5 rounded-lg border border-border/70 bg-background/40 px-0.5 py-0.5 lg:flex">
          <Button variant="ghost" size="icon-sm" onClick={() => zoomAt(0.85, viewport.w / 2, viewport.h / 2)} aria-label="Zoom out"><Minus className="h-3 w-3" /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="min-w-[46px] rounded px-1 py-0.5 font-mono text-[10px] tabular text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">{Math.round(zoom * 100)}%</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-40">
              <DropdownMenuItem onClick={fitView}>Zoom to fit <span className="ml-auto"><Kbd>⇧1</Kbd></span></DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView({ zoom: 1 })}>100%</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView({ zoom: 0.5 })}>50%</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView({ zoom: 0.25 })}>25%</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setView({ zoom: 2 })}>200%</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setView({ panX: 0, panY: 0, zoom: 1 })}><Maximize className="h-3 w-3" /> Actual size</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon-sm" onClick={() => zoomAt(1.18, viewport.w / 2, viewport.h / 2)} aria-label="Zoom in"><Plus className="h-3 w-3" /></Button>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={aiOpen ? 'prism' : 'soft'} size="sm" onClick={() => toggle('aiOpen')} className="gap-1.5" aria-pressed={aiOpen}>
              <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">AI</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>AI agent panel <Kbd className="ml-1">⌘J</Kbd></TooltipContent>
        </Tooltip>

        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={() => setPreviewOpen(true)} aria-label="Preview"><Play className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Preview <Kbd className="ml-1">⇧P</Kbd></TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={() => setShareOpen(true)} aria-label="Share"><Share2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Share</TooltipContent></Tooltip>
        <Button variant="default" size="sm" onClick={() => setExportOpen(true)} className="gap-1.5"><Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Export</span></Button>

        <div className="mx-1 h-6 w-px bg-border/70" />
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label="Toggle theme">{resolved === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}</Button></TooltipTrigger><TooltipContent>{resolved === 'dark' ? 'Light mode' : 'Dark mode'}</TooltipContent></Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8b5cf6,#22d3ee)] text-[10px] font-bold text-white ring-2 ring-background/70" aria-label="Account menu">PS</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Prism Studio</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link href="/dashboard"><FolderOpen className="h-3.5 w-3.5" /> Dashboard</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link href="/settings"><Settings className="h-3.5 w-3.5" /> Settings & AI providers</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShareOpen(true)}><Share2 className="h-3.5 w-3.5" /> Share project</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setPaletteOpen(true)}><Command className="h-3.5 w-3.5" /> Command palette</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setOnboardingStep(0)}><Languages className="h-3.5 w-3.5" /> Take the tour</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/"><Check className="h-3.5 w-3.5" /> Back to home</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <span className={cn('pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(139,92,246,.5),rgba(34,211,238,.35),transparent)]')} />
    </header>
  );
}
