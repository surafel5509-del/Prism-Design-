'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, Clock, Copy, FolderOpen, LayoutGrid, LayoutTemplate, Loader2, MoreHorizontal, Palette, Pencil, Plus, Search, Sparkles, Trash2, Wand2, Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app/AppShell';
import { SceneCanvas } from '@/components/canvas/SceneCanvas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton, EmptyState } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useEditor, persistProject } from '@/lib/store/editor';
import { useAgent } from '@/lib/store/agent';
import { getTemplates, TEMPLATE_CATEGORIES } from '@/lib/data/templates';
import { createProject, gradient } from '@/lib/engine/factory';
import type { Project, TemplateDef } from '@/lib/engine/types';
import { cn, uid } from '@/lib/utils';

type Tab = 'projects' | 'templates' | 'brand' | 'activity';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'projects', label: 'Recent projects', icon: FolderOpen },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'brand', label: 'Brand kits', icon: Palette },
  { id: 'activity', label: 'Activity', icon: Activity },
];

export function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) ?? 'projects');
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = useCallback(async () => {
    const map = new Map<string, Project>();
    try {
      const { idbAll } = await import('@/lib/store/idb');
      const local = await idbAll<Project>('projects');
      local.forEach((p) => { if (p?.id) map.set(p.id, p); });
    } catch { /* idb unavailable */ }
    try {
      const res = await fetch('/api/projects', { cache: 'no-store' });
      if (res.ok) {
        const json = (await res.json()) as { projects?: { id: string }[] };
        for (const meta of json.projects ?? []) {
          if (!map.has(meta.id)) {
            const detail = await fetch(`/api/projects?id=${meta.id}`, { cache: 'no-store' });
            if (detail.ok) {
              const d = await detail.json() as { project?: { data?: Project } };
              if (d.project?.data) map.set(meta.id, d.project.data);
            }
          }
        }
      }
    } catch { /* offline */ }
    setProjects([...map.values()].sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  useEffect(() => { void load(); void useEditor.getState().hydrate(); }, [load]);

  const switchTab = (next: Tab) => {
    setTab(next);
    router.replace(`/dashboard?tab=${next}`, { scroll: false });
  };

  const create = async (template?: TemplateDef) => {
    const id = uid('pr');
    let project: Project;
    if (template) {
      const rendered = template.render();
      project = createProject({
        id, name: template.name, width: rendered.width, height: rendered.height,
        duration: template.duration, background: rendered.background, backgroundGradient: rendered.backgroundGradient ?? null,
        layers: rendered.layers,
      });
    } else {
      project = createProject({ id, name: 'Untitled project', backgroundGradient: gradient(['#0b0b12', '#1b1235', '#0e3b45'], 135) });
    }
    await persistProject(project);
    router.push(`/editor/${id}`);
  };

  const remove = async (id: string) => {
    try {
      const { idbDelete } = await import('@/lib/store/idb');
      await idbDelete('projects', id);
    } catch { /* noop */ }
    void fetch(`/api/projects?id=${id}`, { method: 'DELETE' }).catch(() => undefined);
    setProjects((prev) => (prev ?? []).filter((p) => p.id !== id));
    toast.success('Project deleted');
  };

  const duplicate = async (project: Project) => {
    const copy: Project = { ...project, id: uid('pr'), name: `${project.name} copy`, createdAt: Date.now(), updatedAt: Date.now() };
    await persistProject(copy);
    setProjects((prev) => [copy, ...(prev ?? [])]);
    toast.success('Duplicated');
  };

  const rename = async (id: string) => {
    const trimmed = renameValue.trim();
    setRenameId(null);
    if (!trimmed) return;
    const project = (projects ?? []).find((p) => p.id === id);
    if (!project) return;
    const next = { ...project, name: trimmed, updatedAt: Date.now() };
    await persistProject(next);
    setProjects((prev) => (prev ?? []).map((p) => (p.id === id ? next : p)));
    void fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project: next }) }).catch(() => undefined);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? [])
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.updatedAt - a.updatedAt));
  }, [projects, query, sort]);

  return (
    <AppShell
      title={tab === 'projects' ? 'Your studio' : tab === 'templates' ? 'Templates' : tab === 'brand' ? 'Brand kits' : 'Activity'}
      subtitle={tab === 'projects' ? `${projects?.length ?? 0} projects · autosaved locally and to your cloud library` : tab === 'templates' ? `${getTemplates().length} designs & motion films · one click to a real, editable document` : tab === 'brand' ? 'Design systems that flow into every project and agent brief' : 'Agent runs, models and spend'}
      actions={
        <div className="hidden items-center gap-1.5 md:flex">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-8 w-40 pl-7 text-[11px]" />
          </div>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={cn('inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors', tab === t.id ? 'bg-violet-500/12 text-violet-200 ring-1 ring-inset ring-violet-400/20' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground')}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          {tab === 'projects' && (
            <select value={sort} onChange={(e) => setSort(e.target.value as 'recent' | 'name')} className="h-7 rounded-md border border-border/70 bg-transparent px-1.5 text-[10px] text-muted-foreground outline-none">
              <option value="recent">Recent first</option>
              <option value="name">Name A–Z</option>
            </select>
          )}
          <Button variant="prism" size="sm" className="h-8" onClick={() => void create()}>
            <Plus className="h-3.5 w-3.5" /> New project
          </Button>
        </div>
      </div>

      {tab === 'projects' && (
        <>
          {projects === null ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[188px] rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-white/[0.015] py-16">
              <EmptyState
                icon={<Sparkles className="h-5 w-5 text-violet-300" />}
                title={query ? 'No projects match that search' : 'Your studio is empty'}
                description={query ? 'Try a different name.' : 'Start from a blank canvas or pick a template — the agent can build the rest.'}
                action={<div className="flex gap-1.5"><Button size="sm" variant="prism" onClick={() => void create()}><Plus className="h-3.5 w-3.5" /> Blank project</Button><Button size="sm" variant="outline" onClick={() => switchTab('templates')}><LayoutTemplate className="h-3.5 w-3.5" /> Browse templates</Button></div>}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <button onClick={() => void create()} className="group flex min-h-[188px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-white/[0.012] transition-colors hover:border-violet-400/40 hover:bg-violet-500/[0.04]">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-violet-400/25 bg-violet-500/10 text-violet-200 transition-transform group-hover:scale-105"><Plus className="h-4 w-4" /></span>
                <span className="text-[11.5px] font-medium">New project</span>
                <span className="text-[9.5px] text-muted-foreground">Blank canvas · any aspect</span>
              </button>
              {filtered.map((project) => (
                <div key={project.id} className="group relative overflow-hidden rounded-2xl border border-border/70 bg-white/[0.015] transition-all hover:border-violet-400/30 hover:shadow-[0_20px_60px_-30px_rgba(124,58,237,.5)]">
                  <Link href={`/editor/${project.id}`} className="block">
                    <div className="relative overflow-hidden border-b border-border/60 bg-black/40" style={{ aspectRatio: '16 / 10' }}>
                      <ProjectThumb project={project} />
                      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
                        <span className="rounded bg-black/50 px-1 py-0.5 font-mono text-[8px] text-white/70">{project.width}×{project.height}</span>
                        <span className="rounded bg-black/50 px-1 py-0.5 font-mono text-[8px] text-white/70">{project.layers.length} layers</span>
                        {project.layers.some((l) => Object.keys(l.keyframes ?? {}).length) && <span className="rounded bg-violet-500/40 px-1 py-0.5 text-[8px] text-white">motion</span>}
                      </div>
                    </div>
                    <div className="px-2.5 py-2">
                      {renameId === project.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => void rename(project.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void rename(project.id); if (e.key === 'Escape') setRenameId(null); }}
                          onClick={(e) => e.preventDefault()}
                          className="h-6 w-full rounded border border-violet-400/40 bg-black/40 px-1 text-[11.5px] outline-none"
                        />
                      ) : (
                        <p onDoubleClick={() => { setRenameId(project.id); setRenameValue(project.name); }} className="truncate text-[11.5px] font-medium tracking-tight">{project.name}</p>
                      )}
                      <p className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground"><Clock className="h-2.5 w-2.5" /> {relTime(project.updatedAt)}</p>
                    </div>
                  </Link>
                  <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="grid h-6 w-6 place-items-center rounded-md bg-black/60 text-white/80 backdrop-blur hover:bg-black/80" aria-label="Project menu" onClick={(e) => e.preventDefault()}><MoreHorizontal className="h-3.5 w-3.5" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem asChild><Link href={`/editor/${project.id}`}><FolderOpen className="h-3.5 w-3.5" /> Open</Link></DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void duplicate(project)}><Copy className="h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setRenameId(project.id); setRenameValue(project.name); }}><Pencil className="h-3.5 w-3.5" /> Rename</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-300" onClick={() => void remove(project.id)}><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'templates' && <TemplateGallery query={query} onCreate={create} />}
      {tab === 'brand' && <BrandKits onCreate={create} />}
      {tab === 'activity' && <ActivityFeed />}
    </AppShell>
  );
}

function ProjectThumb({ project }: { project: Project }) {
  const [hover, setHover] = useState(false);
  return (
    <div className="h-full w-full" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <SceneCanvas project={project} time={hover ? 1.2 : 0.4} className="h-full w-full" quality={0.7} ariaLabel={`${project.name} thumbnail`} />
    </div>
  );
}

function TemplateGallery({ query, onCreate }: { query: string; onCreate: (t: TemplateDef) => Promise<void> }) {
  const [category, setCategory] = useState<string>('All');
  const [motionOnly, setMotionOnly] = useState(false);
  const [visible, setVisible] = useState(24);
  const all = useMemo(() => getTemplates(), []);
  const filtered = useMemo(() => all.filter((t) => (category === 'All' || t.category === category) && (!motionOnly || t.duration >= 12) && (!query || t.name.toLowerCase().includes(query.toLowerCase()) || t.tags.some((tag) => tag.includes(query.toLowerCase())))), [all, category, motionOnly, query]);

  useEffect(() => { setVisible(24); }, [category, motionOnly, query]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {['All', ...TEMPLATE_CATEGORIES].map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)} className={cn('rounded-full border px-2 py-1 text-[10px] transition-colors', category === cat ? 'border-violet-400/40 bg-violet-500/12 text-violet-200' : 'border-border/70 text-muted-foreground hover:text-foreground')}>{cat}</button>
        ))}
        <button onClick={() => setMotionOnly((v) => !v)} className={cn('flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] transition-colors', motionOnly ? 'border-violet-400/40 bg-violet-500/12 text-violet-200' : 'border-border/70 text-muted-foreground hover:text-foreground')}><Play className={cn('h-2.5 w-2.5', motionOnly && 'fill-current')} /> Motion 15–30s</button>
        <span className="ml-auto self-center text-[9.5px] text-muted-foreground">{filtered.length} templates</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.slice(0, visible).map((t) => <TemplateCard key={t.id} template={t} onCreate={onCreate} />)}
      </div>
      {visible < filtered.length && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + 24)}>Load more <span className="ml-1 text-[9px] text-muted-foreground">{visible}/{filtered.length}</span></Button>
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, onCreate }: { template: TemplateDef; onCreate: (t: TemplateDef) => Promise<void> }) {
  const [rendered, setRendered] = useState<ReturnType<TemplateDef['render']> | null>(null);
  useEffect(() => { try { setRendered(template.render()); } catch { /* noop */ } }, [template]);
  const [busy, setBusy] = useState(false);
  const [hovering, setHovering] = useState(false);
  const isMotion = template.duration >= 12;

  return (
    <button
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={async () => { setBusy(true); try { await onCreate(template); } finally { setBusy(false); } }}
      className="group overflow-hidden rounded-2xl border border-border/70 bg-white/[0.015] text-left transition-all hover:-translate-y-0.5 hover:border-violet-400/35 hover:shadow-[0_20px_50px_-24px_rgba(124,58,237,.55)]"
    >
      <div className="relative bg-black/40" style={{ aspectRatio: '4 / 3' }}>
        {rendered ? <SceneCanvas project={{ ...rendered, duration: template.duration }} playing={isMotion && hovering} time={Math.min(1.2, template.duration * 0.4)} className="h-full w-full" quality={0.65} ariaLabel={`${template.name} preview`} /> : <div className="h-full w-full animate-pulse bg-white/[0.03]" />}
        {isMotion && <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white/80 backdrop-blur"><Play className="h-2 w-2 fill-current" /> {template.duration}s</span>}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white/70 backdrop-blur">{template.aspect}</span>
        <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1 py-0.5 text-[8px] text-white/70 backdrop-blur">{template.category}</span>
        <span className="absolute inset-0 grid place-items-center bg-violet-950/40 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
          <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-medium text-black">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Use template
          </span>
        </span>
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-[11px] font-medium tracking-tight">{template.name}</p>
        <p className="truncate text-[9px] text-muted-foreground">{template.tags.slice(0, 3).join(' · ')}</p>
      </div>
    </button>
  );
}

function BrandKits({ onCreate }: { onCreate: (t?: TemplateDef) => Promise<void> }) {
  const kits = useEditor((s) => s.brandKits);
  const [ready, setReady] = useState(false);
  useEffect(() => { void useEditor.getState().hydrate().then(() => setReady(true)); }, []);

  const useKit = async (kitId: string) => {
    const kit = useEditor.getState().brandKits.find((k) => k.id === kitId);
    if (!kit) return;
    const id = uid('pr');
    const project = createProject({
      id, name: `${kit.name} project`,
      background: kit.colors[3] ?? '#0b0b12',
      backgroundGradient: gradient([kit.colors[3] ?? '#0b0b12', kit.colors[0], kit.colors[1]], 135),
    });
    await persistProject(project);
    useEditor.getState().loadProject(project);
    useEditor.getState().applyBrandKit(kit.id);
    await persistProject(useEditor.getState().project);
    window.location.href = `/editor/${id}`;
  };

  if (!ready) return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[160px] rounded-2xl" />)}</div>;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {kits.map((kit) => (
        <div key={kit.id} className="overflow-hidden rounded-2xl border border-border/70 bg-white/[0.015]">
          <div className="h-24 w-full" style={{ background: `linear-gradient(120deg, ${kit.colors.slice(0, 4).join(', ')})` }} />
          <div className="p-3">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[12px] font-semibold tracking-tight">{kit.name}</p>
              <span className="ml-auto font-mono text-[8.5px] text-muted-foreground">{kit.colors.length} colors</span>
            </div>
            <div className="mt-1.5 flex gap-1">
              {kit.colors.slice(0, 6).map((c) => <span key={c} className="h-4 w-4 rounded-full border border-white/15" style={{ background: c }} title={c} />)}
            </div>
            <p className="mt-1.5 truncate text-[9.5px] text-muted-foreground">{kit.fonts.heading} · {kit.fonts.body}</p>
            <div className="mt-2 flex gap-1">
              <Button size="xs" variant="soft" className="h-6 flex-1" onClick={() => void useKit(kit.id)}><Sparkles className="h-2.5 w-2.5" /> New project</Button>
              <Link href="/editor/new" className="inline-flex h-6 items-center rounded-md border border-border/70 px-1.5 text-[9.5px] text-muted-foreground hover:text-foreground">Edit</Link>
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => void onCreate()} className="flex min-h-[160px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border/80 text-muted-foreground transition-colors hover:border-violet-400/40 hover:text-foreground">
        <Plus className="h-4 w-4" />
        <span className="text-[10.5px]">Create a brand kit</span>
        <span className="text-[9px] text-muted-foreground/60">in the editor’s Brand panel</span>
      </button>
    </div>
  );
}

function ActivityFeed() {
  const [data, setData] = useState<{ runs: { id: string; prompt: string; status: string; provider: string; model: string; toolCalls: number; steps: number; tokensIn: number; tokensOut: number; cost: number; durationMs: number; at: number }[] } | null>(null);
  const runs = useAgent((s) => s.runLog);
  useEffect(() => {
    void (async () => {
      try { const res = await fetch('/api/ai/usage', { cache: 'no-store' }); if (res.ok) setData(await res.json()); } catch { /* offline */ }
    })();
  }, []);

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
      <div className="rounded-2xl border border-border/70 bg-white/[0.015] p-3">
        <p className="text-[11px] font-semibold tracking-tight">Agent runs</p>
        <p className="text-[9.5px] text-muted-foreground">Server-persisted history with tokens and cost.</p>
        <div className="mt-2 space-y-1.5">
          {!data && <Skeleton className="h-12 rounded-lg" />}
          {data?.runs.length === 0 && <p className="rounded-lg border border-dashed border-border/70 py-8 text-center text-[10px] text-muted-foreground">No runs recorded yet.</p>}
          {data?.runs.map((run) => (
            <div key={run.id} className="flex items-start gap-2 rounded-lg border border-border/50 bg-black/15 px-2 py-1.5">
              <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', run.status === 'done' ? 'bg-emerald-400' : run.status === 'error' ? 'bg-rose-400' : 'bg-amber-400')} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10.5px] text-foreground/80">{run.prompt || '(no prompt)'}</p>
                <p className="text-[8.5px] text-muted-foreground">{run.provider}/{run.model} · {run.toolCalls} tools · {run.steps} steps · {((run.durationMs ?? 0) / 1000).toFixed(1)}s</p>
              </div>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-[9.5px] text-foreground/70">${(run.cost ?? 0).toFixed(3)}</span>
                <span className="block text-[8px] text-muted-foreground">{new Date(run.at).toLocaleString()}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-border/70 bg-white/[0.015] p-3">
          <p className="text-[11px] font-semibold tracking-tight">This browser</p>
          <p className="text-[9.5px] text-muted-foreground">Local run log (not synced)</p>
          <div className="mt-2 space-y-1">
            {runs.length === 0 && <p className="text-[9.5px] text-muted-foreground/60">Nothing yet.</p>}
            {runs.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center gap-1.5 rounded-md bg-white/[0.025] px-1.5 py-1">
                <span className="truncate text-[9.5px] text-foreground/70">{r.prompt}</span>
                <Badge variant={r.status === 'done' ? 'success' : r.status === 'error' ? 'danger' : 'secondary'} className="ml-auto h-3.5 px-1 text-[7.5px]">{r.status}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-3">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-violet-100"><Sparkles className="h-3 w-3" /> Agent tips</p>
          <ul className="mt-1.5 space-y-1 text-[9.5px] leading-relaxed text-muted-foreground">
            <li>• Attach a reference image and ask for the same mood, not the same pixels.</li>
            <li>• Say &ldquo;animate the current design&rdquo; to add motion without rebuilding.</li>
            <li>• Ask for a 9:16 cut to test smart reframe.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function relTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
