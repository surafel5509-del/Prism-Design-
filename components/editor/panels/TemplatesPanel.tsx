'use client';
import * as React from 'react';
import { getTemplates, TEMPLATE_CATEGORIES } from '@/lib/data/templates';
import type { TemplateDef, Aspect } from '@/lib/engine/types';
import { useEditor } from '@/lib/store/editor';
import { SceneCanvas } from '@/components/canvas/SceneCanvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Segmented, Skeleton } from '@/components/ui/misc';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Search, Star, Plus, Check, LayoutTemplate, Wand2, Clock } from 'lucide-react';
import { toast } from 'sonner';

const ASPECTS: (Aspect | 'All')[] = ['All', '16:9', '9:16', '1:1', '4:5'];

export function TemplatesPanel() {
  const all = React.useMemo(() => getTemplates(), []);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState<string>('All');
  const [aspect, setAspect] = React.useState<Aspect | 'All'>('All');
  const [onlyFavs, setOnlyFavs] = React.useState(false);
  const [limit, setLimit] = React.useState(36);
  const favorites = useEditor((s) => s.favorites);
  const toggleFavorite = useEditor((s) => s.toggleFavorite);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((t) => {
      if (category !== 'All' && t.category !== category) return false;
      if (aspect !== 'All' && t.aspect !== aspect) return false;
      if (onlyFavs && !favorites.includes(t.id)) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q)) || t.category.toLowerCase().includes(q);
    });
  }, [all, query, category, aspect, onlyFavs, favorites]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-1.5 border-b border-border/60 px-2 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(36); }} placeholder={`Search ${all.length} templates`} className="h-7 pl-7 text-[11px]" aria-label="Search templates" />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
          <FilterChip active={onlyFavs} onClick={() => setOnlyFavs(!onlyFavs)}><Star className={cn('h-2.5 w-2.5', onlyFavs && 'fill-current')} /></FilterChip>
          {['All', ...TEMPLATE_CATEGORIES].map((c) => <FilterChip key={c} active={category === c} onClick={() => { setCategory(c); setLimit(36); }}>{c}</FilterChip>)}
        </div>
        <Segmented size="xs" value={aspect} onChange={(v) => { setAspect(v); setLimit(36); }} options={ASPECTS.map((a) => ({ value: a, label: a }))} />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <EmptyState icon={<LayoutTemplate className="h-4 w-4" />} title="No templates match" description="Try another category, aspect ratio, or search term." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {filtered.slice(0, limit).map((t) => <TemplateCard key={t.id} template={t} favorite={favorites.includes(t.id)} onFav={() => toggleFavorite(t.id)} />)}
            </div>
            {filtered.length > limit && (
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setLimit((l) => l + 36)}>Load {Math.min(36, filtered.length - limit)} more · {filtered.length} total</Button>
            )}
            <p className="mt-2 text-center text-[9px] text-muted-foreground">Templates are fully editable layer trees — no flattened images.</p>
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] transition-colors', active ? 'border-violet-500/50 bg-violet-500/15 text-violet-300' : 'border-border text-muted-foreground hover:text-foreground')}>
      {children}
    </button>
  );
}

function TemplateCard({ template, favorite, onFav }: { template: TemplateDef; favorite: boolean; onFav: () => void }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [rendered, setRendered] = React.useState<(ReturnType<TemplateDef['render']> & { duration: number }) | null>(null);
  const applyTemplate = useEditor((s) => s.applyTemplate);
  const setLeftTab = useEditor((s) => s.setLeftTab);
  const setTool = useEditor((s) => s.setTool);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setRendered({ ...template.render(), duration: template.duration }), 30);
    return () => clearTimeout(t);
  }, [visible, template]);

  return (
    <div ref={ref} className="group relative overflow-hidden rounded-lg border border-border/60 bg-background/40 transition-colors hover:border-violet-500/50">
      <div className="relative aspect-[4/5] overflow-hidden bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:14px_14px]">
        {rendered ? <SceneCanvas project={rendered} playing={false} quality={0.7} /> : <Skeleton className="h-full w-full rounded-none" />}
        <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/80 via-black/10 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="xs" variant="prism" className="w-full" onClick={() => { applyTemplate(template); setLeftTab('layers'); setTool('select'); toast.success(`${template.name} applied`, { description: `${template.palette[0]} palette · ${template.duration}s` }); }}>
            <Wand2 className="h-2.5 w-2.5" /> Use template
          </Button>
          <Button size="xs" variant="secondary" className="w-full" onClick={() => { applyTemplate(template, 'append'); toast.success('Layers added to project'); }}>
            <Plus className="h-2.5 w-2.5" /> Add layers
          </Button>
        </div>
        <button onClick={onFav} className={cn('absolute right-1 top-1 rounded-md bg-black/45 p-1 backdrop-blur transition-colors', favorite ? 'text-amber-400' : 'text-white/70 hover:text-white')} aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}>
          <Star className={cn('h-2.5 w-2.5', favorite && 'fill-current')} />
        </button>
        {template.pro && <Badge variant="prism" className="absolute left-1 top-1 px-1 py-0 text-[7.5px]">PRO</Badge>}
      </div>
      <div className="flex items-center justify-between px-1.5 py-1">
        <div className="min-w-0">
          <p className="truncate text-[9.5px] text-foreground/85">{template.name}</p>
          <p className="flex items-center gap-1 text-[8px] text-muted-foreground"><Clock className="h-2 w-2" />{template.duration}s · {template.aspect}</p>
        </div>
        <div className="flex gap-0.5">{template.palette.slice(0, 3).map((c, i) => <span key={i} className="h-2 w-2 rounded-full ring-1 ring-black/20" style={{ background: c }} />)}</div>
      </div>
    </div>
  );
}
