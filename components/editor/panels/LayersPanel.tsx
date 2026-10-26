'use client';
import * as React from 'react';
import { useEditor } from '@/lib/store/editor';
import type { Layer } from '@/lib/engine/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';
import { EmptyState, Kbd } from '@/components/ui/misc';
import {
  Type, Image as ImageIcon, Film, AudioLines, Layers, Shapes, Activity, PawPrint,
  Eye, EyeOff, Lock, Unlock, ChevronRight, ChevronDown, GripVertical, Group, Ungroup,
  Copy, Scissors, CopyPlus, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine, Sparkles, FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';

export function LayersPanel() {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const toggleSelect = useEditor((s) => s.toggleSelect);
  const updateLayer = useEditor((s) => s.updateLayer);
  const reorderLayer = useEditor((s) => s.reorderLayer);
  const moveLayerBy = useEditor((s) => s.moveLayerBy);
  const deleteLayers = useEditor((s) => s.deleteLayers);
  const duplicateLayers = useEditor((s) => s.duplicateLayers);
  const groupSelected = useEditor((s) => s.groupSelected);
  const ungroup = useEditor((s) => s.ungroup);
  const selectAll = useEditor((s) => s.selectAll);
  const [query, setQuery] = React.useState('');
  const [collapsed, setCollapsed] = React.useState<string[]>([]);
  const [renaming, setRenaming] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);

  const layers = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...project.layers].reverse().filter((l) => !q || l.name.toLowerCase().includes(q));
  }, [project.layers, query]);

  const roots = layers.filter((l) => !l.parentId || !project.layers.some((p) => p.id === l.parentId));
  const childrenOf = (id: string) => layers.filter((l) => l.parentId === id);

  const renderRow = (layer: Layer, depth = 0): React.ReactNode => {
    const selected = selection.includes(layer.id);
    const kids = childrenOf(layer.id);
    const isCollapsed = collapsed.includes(layer.id);
    return (
      <React.Fragment key={layer.id}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              draggable
              onDragStart={() => setDragId(layer.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== layer.id) reorderLayer(dragId, project.layers.findIndex((l) => l.id === layer.id)); setDragId(null); }}
              onClick={(e) => { if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelect(layer.id, true); else select([layer.id]); }}
              onDoubleClick={() => setRenaming(layer.id)}
              className={cn('group relative flex h-[30px] cursor-default items-center gap-1.5 border-b border-border/30 pr-1.5 text-[11px] transition-colors',
                selected ? 'bg-violet-500/[0.12] text-foreground' : 'text-foreground/75 hover:bg-accent/40',
                dragId === layer.id && 'opacity-40')}
              style={{ paddingLeft: 6 + depth * 12 }}
              role="treeitem"
              aria-selected={selected}
            >
              {selected && <span className="absolute left-0 h-full w-[2px] bg-[linear-gradient(180deg,#8b5cf6,#22d3ee)]" />}
              <span className="text-muted-foreground/30"><GripVertical className="h-3 w-3" /></span>
              {kids.length > 0 ? (
                <button onClick={(e) => { e.stopPropagation(); setCollapsed((c) => (c.includes(layer.id) ? c.filter((x) => x !== layer.id) : [...c, layer.id])); }} aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              ) : <span className="w-3" />}
              <LayerIcon layer={layer} />
              {renaming === layer.id ? (
                <Input autoFocus defaultValue={layer.name} onBlur={(e) => { const v = e.target.value.trim(); if (v) updateLayer(layer.id, { name: v }); setRenaming(null); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); }} className="h-5 flex-1 px-1 py-0 text-[10.5px]" onClick={(e) => e.stopPropagation()} />
              ) : (
                <span className={cn('min-w-0 flex-1 truncate', !layer.visible && 'text-muted-foreground/45 line-through')}>{layer.name}</span>
              )}
              {Object.keys(layer.keyframes).length > 0 && <span className="font-mono text-[8px] text-cyan-400/80">{Object.values(layer.keyframes).reduce((a, k) => a + (k?.length ?? 0), 0)}◆</span>}
              <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }); }} className={cn('opacity-0 transition-opacity group-hover:opacity-100', !layer.visible && 'opacity-100')} aria-label="Toggle visibility">
                {layer.visible ? <Eye className="h-3 w-3 text-muted-foreground/60 hover:text-foreground" /> : <EyeOff className="h-3 w-3 text-red-400/80" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }} className={cn('opacity-0 transition-opacity group-hover:opacity-100', layer.locked && 'opacity-100')} aria-label="Toggle lock">
                {layer.locked ? <Lock className="h-3 w-3 text-amber-400/90" /> : <Unlock className="h-3 w-3 text-muted-foreground/60 hover:text-foreground" />}
              </button>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuLabel>{layer.type} layer</ContextMenuLabel>
            <ContextMenuItem onClick={() => duplicateLayers([layer.id])}><CopyPlus className="h-3.5 w-3.5" /> Duplicate</ContextMenuItem>
            <ContextMenuItem onClick={() => { select([layer.id]); useEditor.getState().copySelection(); }}><Copy className="h-3.5 w-3.5" /> Copy</ContextMenuItem>
            <ContextMenuItem onClick={() => { select([layer.id]); groupSelected(); }} disabled={selection.length < 2}><Group className="h-3.5 w-3.5" /> Group selection</ContextMenuItem>
            <ContextMenuItem onClick={() => ungroup(layer.id)} disabled={layer.type !== 'group'}><Ungroup className="h-3.5 w-3.5" /> Ungroup</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => moveLayerBy(layer.id, 1)}><ArrowUp className="h-3.5 w-3.5" /> Bring forward</ContextMenuItem>
            <ContextMenuItem onClick={() => moveLayerBy(layer.id, -1)}><ArrowDown className="h-3.5 w-3.5" /> Send backward</ContextMenuItem>
            <ContextMenuItem onClick={() => reorderLayer(layer.id, project.layers.length - 1)}><ArrowUpToLine className="h-3.5 w-3.5" /> Bring to front</ContextMenuItem>
            <ContextMenuItem onClick={() => reorderLayer(layer.id, 0)}><ArrowDownToLine className="h-3.5 w-3.5" /> Send to back</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => useEditor.getState().keyframeProp(layer.id, 'opacity')}><Sparkles className="h-3.5 w-3.5" /> Keyframe opacity</ContextMenuItem>
            <ContextMenuItem onClick={() => updateLayer(layer.id, { locked: !layer.locked })}><Lock className="h-3.5 w-3.5" /> {layer.locked ? 'Unlock' : 'Lock'}</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => deleteLayers([layer.id])} className="text-red-400 focus:bg-red-500/10"><Scissors className="h-3.5 w-3.5" /> Delete</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {!isCollapsed && kids.map((k) => renderRow(k, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b border-border/60 px-2 py-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search layers" className="h-7 flex-1 text-[11px]" aria-label="Search layers" />
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={groupSelected} disabled={selection.length < 2} aria-label="Group"><Group className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Group <Kbd className="ml-1">⌘G</Kbd></TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-sm" onClick={() => ungroup()} disabled={!selection.length} aria-label="Ungroup"><Ungroup className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Ungroup</TooltipContent></Tooltip>
      </div>
      <div role="tree" aria-label="Layers" className="flex-1 overflow-y-auto">
        {roots.length === 0 ? (
          <EmptyState icon={<Layers className="h-4 w-4" />} title={query ? 'No matching layers' : 'No layers yet'} description={query ? 'Try a different search term.' : 'Draw a shape, add text, or ask the AI agent to build a scene.'} />
        ) : roots.map((l) => renderRow(l))}
      </div>
      <div className="flex items-center justify-between border-t border-border/60 px-2 py-1.5 text-[9.5px] text-muted-foreground">
        <button onClick={selectAll} className="hover:text-foreground">{project.layers.length} layer{project.layers.length === 1 ? '' : 's'} · select all</button>
        <span className="font-mono">{selection.length ? `${selection.length} selected` : ''}</span>
      </div>
    </div>
  );
}

function LayerIcon({ layer }: { layer: Layer }) {
  const cls = 'h-3 w-3 shrink-0';
  if (layer.type === 'text') return <Type className={cn(cls, 'text-fuchsia-400')} />;
  if (layer.type === 'image') return <ImageIcon className={cn(cls, 'text-cyan-400')} />;
  if (layer.type === 'video') return <Film className={cn(cls, 'text-sky-400')} />;
  if (layer.type === 'audio') return <AudioLines className={cn(cls, 'text-emerald-400')} />;
  if (layer.type === 'group') return <FolderOpen className={cn(cls, 'text-amber-400')} />;
  if (layer.type === 'path') return <Activity className={cn(cls, 'text-violet-400')} />;
  if (layer.type === 'particles') return <PawPrint className={cn(cls, 'text-violet-300')} />;
  return <Shapes className={cn(cls, 'text-violet-400')} />;
}
