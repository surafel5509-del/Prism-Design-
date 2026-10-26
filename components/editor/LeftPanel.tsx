'use client';
import * as React from 'react';
import { useEditor, type LeftTab } from '@/lib/store/editor';
import { LayersPanel } from './panels/LayersPanel';
import { AssetsPanel } from './panels/AssetsPanel';
import { TemplatesPanel } from './panels/TemplatesPanel';
import { BrandPanel } from './panels/BrandPanel';
import { EffectsPanel } from './panels/EffectsPanel';
import { Layers, Image as ImageIcon, LayoutTemplate, Palette, Sparkles, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const TABS: { id: LeftTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'assets', label: 'Assets', icon: ImageIcon },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'brand', label: 'Brand', icon: Palette },
  { id: 'effects', label: 'Effects', icon: Sparkles },
];

export function LeftPanel() {
  const leftTab = useEditor((s) => s.leftTab);
  const leftOpen = useEditor((s) => s.leftOpen);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  const toggle = useEditor((s) => s.toggle);

  return (
    <aside className={cn('relative flex shrink-0 flex-col border-r border-border/70 bg-panel/60 transition-[width] duration-200', leftOpen ? 'w-[264px]' : 'w-0 overflow-hidden')} aria-label="Left panel">
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-border/60 px-1.5">
        {TABS.map((t) => (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setLeftTab(t.id)}
                aria-pressed={leftTab === t.id}
                className={cn('relative flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[10px] transition-colors', leftTab === t.id ? 'bg-violet-500/12 text-violet-300' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
              >
                <t.icon className="h-3 w-3" /><span className="hidden xl:inline">{t.label}</span>
                {leftTab === t.id && <span className="absolute -bottom-[5px] left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,#8b5cf6,#22d3ee)]" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t.label}</TooltipContent>
          </Tooltip>
        ))}
        <button onClick={() => toggle('leftOpen')} className="ml-0.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Collapse left panel"><ChevronsLeft className="h-3 w-3" /></button>
      </div>
      <div className="min-h-0 flex-1">
        {leftTab === 'layers' && <LayersPanel />}
        {leftTab === 'assets' && <AssetsPanel />}
        {leftTab === 'templates' && <TemplatesPanel />}
        {leftTab === 'brand' && <BrandPanel />}
        {leftTab === 'effects' && <EffectsPanel />}
      </div>
      {!leftOpen && <div className="absolute inset-y-0 right-0 w-1 cursor-pointer bg-transparent" onClick={() => toggle('leftOpen')} />}
    </aside>
  );
}

export function LeftPanelOpenButton() {
  const leftOpen = useEditor((s) => s.leftOpen);
  const toggle = useEditor((s) => s.toggle);
  if (leftOpen) return null;
  return (
    <button onClick={() => toggle('leftOpen')} className="absolute left-14 top-14 z-20 flex items-center gap-1 rounded-md border border-border bg-panel px-2 py-1 text-[10px] text-muted-foreground shadow-md hover:text-foreground" aria-label="Open left panel">
      <ChevronsRight className="h-3 w-3" /> Panels
    </button>
  );
}
