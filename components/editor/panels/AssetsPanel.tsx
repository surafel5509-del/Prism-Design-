'use client';
import * as React from 'react';
import { useEditor } from '@/lib/store/editor';
import { BACKDROPS, STICKERS, FONTS, MUSIC, SFX, LOTTIE_STUBS, iconToDataUrl, searchIcons, loadIcons, searchStock, type LibraryItem, type StockPhoto, type Track } from '@/lib/data/library';
import { SceneCanvas } from '@/components/canvas/SceneCanvas';
import { createLayer, createText, gradient } from '@/lib/engine/factory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton, EmptyState, Segmented, Kbd } from '@/components/ui/misc';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, fileToDataUrl, uid } from '@/lib/utils';
import { synth } from '@/lib/engine/audio';
import { toast } from 'sonner';
import { Search, Upload, Play, Pause, Plus, Trash2, Music2, Volume2, Type, Image as ImageIcon, Sparkles, Star, Loader2, CloudOff } from 'lucide-react';
import { PALETTE_LIST } from '@/lib/store/editor';

const TABS = [
  { id: 'backdrops', label: 'Backdrops' }, { id: 'icons', label: 'Icons' }, { id: 'stickers', label: 'Stickers' },
  { id: 'photos', label: 'Photos' }, { id: 'uploads', label: 'Uploads' }, { id: 'audio', label: 'Audio' },
  { id: 'lottie', label: 'Lottie' }, { id: 'fonts', label: 'Fonts' },
] as const;
type Tab = typeof TABS[number]['id'];

export function AssetsPanel() {
  const [tab, setTab] = React.useState<Tab>('backdrops');
  const project = useEditor((s) => s.project);
  const addLayer = useEditor((s) => s.addLayer);
  const assets = useEditor((s) => s.assets);
  const addAsset = useEditor((s) => s.addAsset);
  const removeAsset = useEditor((s) => s.removeAsset);
  const insertAsset = useEditor((s) => s.insertAsset);
  const searchQuery = useEditor((s) => s.leftTab);
  void searchQuery;

  const addImage = (src: string, name: string, w?: number, h?: number, fit: 'cover' | 'contain' = 'cover') => {
    const maxW = project.width * 0.7;
    const scale = w ? Math.min(1, maxW / w) : 0.5;
    const lw = w ? w * scale : project.width * 0.5;
    const lh = h && w ? h * scale : lw;
    addLayer(createLayer({
      type: 'image', name, x: (project.width - lw) / 2, y: (project.height - lh) / 2, w: lw, h: lh,
      fill: 'transparent', media: { src, fit }, endTime: project.duration,
    }));
    toast.success(`Added ${name}`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1 border-b border-border/60 px-2 py-1.5">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn('rounded-md px-1.5 py-0.5 text-[10px] transition-colors', tab === t.id ? 'bg-violet-500/15 text-violet-300' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>{t.label}</button>
        ))}
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {tab === 'backdrops' && <Backdrops onPick={(item) => addImage(item.src, item.name, item.w, item.h)} />}
          {tab === 'icons' && <Icons onPick={(src, name) => addImage(src, name, 480, 480, 'contain')} />}
          {tab === 'stickers' && <Stickers onPick={(item) => addImage(item.src, item.name, 300, 300, 'contain')} />}
          {tab === 'photos' && <Photos onPick={(p) => addImage(p.full, p.alt || 'Stock photo')} />}
          {tab === 'uploads' && <Uploads assets={assets} onUpload={(files) => {
            Array.from(files).forEach(async (f) => {
              const src = await fileToDataUrl(f);
              addAsset({ id: uid('as'), name: f.name, type: f.type.startsWith('video') ? 'video' : 'image', src, createdAt: Date.now(), size: f.size });
            });
          }} onInsert={insertAsset} onRemove={removeAsset} />}
          {tab === 'audio' && <AudioLibrary onAdd={(track) => {
            const l = createLayer({
              type: 'audio', name: track.name, x: 0, y: project.height - 70, w: project.width, h: 70,
              fill: 'transparent', endTime: Math.min(project.duration, track.duration),
              media: { src: '', fit: 'fill' }, meta: { track },
            });
            addLayer(l);
            toast.success(`Added ${track.kind === 'music' ? 'music' : 'SFX'}: ${track.name}`);
          }} />}
          {tab === 'lottie' && <Lottie onAdd={(kind) => {
            const base = { x: project.width / 2 - 150, y: project.height / 2 - 150, endTime: project.duration };
            const color = PALETTE_LIST[0].colors[1];
            if (kind === 'pulse') {
              for (let i = 0; i < 3; i++) {
                addLayer(createLayer({ type: 'shape', shape: 'ellipse', name: `Pulse ring ${i + 1}`, x: base.x, y: base.y, w: 300, h: 300, fill: 'transparent', stroke: color, strokeWidth: 3, endTime: base.endTime,
                  keyframes: { scaleX: [{ id: uid('kf'), time: i * 0.6, value: 0.4, easing: { type: 'easeOut' } }, { id: uid('kf'), time: i * 0.6 + 1.8, value: 1.4, easing: { type: 'easeOut' } }], scaleY: [{ id: uid('kf'), time: i * 0.6, value: 0.4, easing: { type: 'easeOut' } }, { id: uid('kf'), time: i * 0.6 + 1.8, value: 1.4 }], opacity: [{ id: uid('kf'), time: i * 0.6, value: 0.9 }, { id: uid('kf'), time: i * 0.6 + 1.8, value: 0 }] } }));
              }
            } else if (kind === 'orbit') {
              const center = { x: project.width / 2, y: project.height / 2 };
              for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                addLayer(createLayer({ type: 'shape', shape: 'ellipse', name: `Orbit dot ${i + 1}`, x: center.x + Math.cos(angle) * 180 - 18, y: center.y + Math.sin(angle) * 180 - 18, w: 36, h: 36, fill: color, endTime: base.endTime,
                  keyframes: { x: [{ id: uid('kf'), time: 0, value: center.x + Math.cos(angle) * 180 }, { id: uid('kf'), time: 4, value: center.x + Math.cos(angle + Math.PI * 2) * 180 }], y: [{ id: uid('kf'), time: 0, value: center.y + Math.sin(angle) * 180 }, { id: uid('kf'), time: 4, value: center.y + Math.sin(angle + Math.PI * 2) * 180 }] } }));
              }
            } else {
              for (let i = 0; i < 7; i++) {
                addLayer(createLayer({ type: 'shape', shape: 'roundedRect', name: `Bar ${i + 1}`, x: project.width / 2 - 140 + i * 40, y: project.height / 2, w: 24, h: 60, radius: 8, fill: color, endTime: base.endTime,
                  keyframes: { h: [{ id: uid('kf'), time: 0, value: 30 }, { id: uid('kf'), time: 0.3 + i * 0.08, value: 160, easing: { type: 'easeInOut' } }, { id: uid('kf'), time: 0.7 + i * 0.08, value: 40 }] } }));
              }
            }
            toast.success('Animated element added');
          }} />}
          {tab === 'fonts' && <Fonts onPick={(font) => {
            addLayer(createText('Type with intent', {
              x: project.width * 0.1, y: project.height * 0.42, w: project.width * 0.8, h: project.height * 0.2, endTime: project.duration,
            }, { fontFamily: font, fontSize: Math.round(project.width / 16), fontWeight: 600, color: '#ffffff' }));
            toast.success(`${font} applied`);
          }} />}
        </div>
      </ScrollArea>
    </div>
  );
}

function Backdrops({ onPick }: { onPick: (item: LibraryItem) => void }) {
  return (
    <div>
      <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground">Procedurally generated gradients, meshes and textures — no licensing, infinitely scalable.</p>
      <div className="grid grid-cols-3 gap-1.5">
        {BACKDROPS.map((b) => (
          <button key={b.id} onClick={() => onPick(b)} className="group relative aspect-square overflow-hidden rounded-md border border-border/60 transition-transform hover:scale-[1.03] hover:border-violet-500/50" title={b.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.src} alt={b.name} className="h-full w-full object-cover" loading="lazy" />
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-left text-[8px] text-white opacity-0 transition-opacity group-hover:opacity-100">{b.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Icons({ onPick }: { onPick: (src: string, name: string) => void }) {
  const [query, setQuery] = React.useState('sparkles');
  const [icons, setIcons] = React.useState<{ name: string; label: string; svg: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [color, setColor] = React.useState('#ffffff');

  React.useEffect(() => { loadIcons().then((all) => setTotal(Object.keys(all).length)).catch(() => setTotal(0)); }, []);
  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    const timer = setTimeout(() => {
      searchIcons(query, 120).then((r) => { if (alive) { setIcons(r); setLoading(false); } });
    }, 120);
    return () => { alive = false; clearTimeout(timer); };
  }, [query]);

  return (
    <div>
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${total ? `${total.toLocaleString()} ` : ''}icons`} className="h-7 pl-7 text-[11px]" aria-label="Search icons" />
      </div>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[9.5px] text-muted-foreground">Tint</span>
        {['#ffffff', '#0b0b12', '#8b5cf6', '#22d3ee', '#e879f9', '#fbbf24'].map((c) => (
          <button key={c} onClick={() => setColor(c)} aria-label={`Icon color ${c}`} className={cn('h-3.5 w-3.5 rounded-full border', color === c ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-background' : 'border-border')} style={{ background: c }} />
        ))}
        <Badge variant="secondary" className="ml-auto text-[8px]">{total ? `${total.toLocaleString()} icons` : 'loading'}</Badge>
      </div>
      {loading ? (
        <div className="grid grid-cols-6 gap-1.5">{Array.from({ length: 24 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}</div>
      ) : (
        <div className="grid grid-cols-6 gap-1.5">
          {icons.map((icon) => (
            <Tooltip key={icon.name}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onPick(iconToDataUrl(icon.svg, color, 1.75, 512), icon.label)}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('application/x-prism-library', JSON.stringify({ src: iconToDataUrl(icon.svg, color, 1.75, 512), name: icon.label, type: 'icon', w: 400, h: 400 }))}
                  className="flex aspect-square items-center justify-center rounded-md border border-transparent text-foreground transition-all hover:border-violet-500/40 hover:bg-violet-500/10"
                  style={{ color }}
                  aria-label={icon.label}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icon.svg }} />
                </button>
              </TooltipTrigger>
              <TooltipContent>{icon.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
      {!loading && icons.length === 0 && <EmptyState icon={<Search className="h-4 w-4" />} title="No icons found" description={`Try “arrow”, “chart” or “music”.`} />}
    </div>
  );
}

function Stickers({ onPick }: { onPick: (item: LibraryItem) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {STICKERS.map((s) => (
        <button key={s.id} onClick={() => onPick(s)} className="aspect-square rounded-md border border-border/60 bg-[repeating-conic-gradient(hsl(var(--muted))_0%_25%,transparent_0%_50%)] bg-[length:12px_12px] p-2 transition-transform hover:scale-[1.03]" title={s.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.src} alt={s.name} className="h-full w-full object-contain" />
        </button>
      ))}
    </div>
  );
}

function Photos({ onPick }: { onPick: (p: StockPhoto) => void }) {
  const [query, setQuery] = React.useState('gradient abstract');
  const [provider, setProvider] = React.useState<'unsplash' | 'pexels'>('unsplash');
  const [results, setResults] = React.useState<StockPhoto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);

  const run = async () => {
    setLoading(true); setSearched(true);
    const r = await searchStock(query, provider);
    setResults(r); setLoading(false);
  };

  return (
    <div>
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="Search stock photography" className="h-7 pl-7 pr-16 text-[11px]" aria-label="Search stock photos" />
        <Button size="xs" variant="ghost" className="absolute right-1 top-1" onClick={run} disabled={loading}>{loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Search'}</Button>
      </div>
      <div className="mb-2"><Segmented size="xs" value={provider} onChange={(v) => setProvider(v)} options={[{ value: 'unsplash', label: 'Unsplash' }, { value: 'pexels', label: 'Pexels' }]} /></div>
      {results.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {results.map((p) => (
            <button key={p.id} onClick={() => onPick(p)} className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt={p.alt} className="h-full w-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[8px] text-white/90">{p.author}</span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState icon={<CloudOff className="h-4 w-4" />} title={searched && !loading ? 'No results — provider key missing?' : 'Stock photography'} description="Add UNSPLASH_ACCESS_KEY or PEXELS_API_KEY to .env.local to search live photos. Prism ships with procedural backdrops that always work." action={<Button size="sm" variant="outline" onClick={run}>Try a search</Button>} />
      )}
    </div>
  );
}

function Uploads({ assets, onUpload, onInsert, onRemove }: { assets: ReturnType<typeof useEditor.getState>['assets']; onUpload: (files: FileList) => void; onInsert: (id: string) => void; onRemove: (id: string) => void }) {
  const [over, setOver] = React.useState(false);
  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files); }}
        className={cn('mb-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-5 text-center transition-colors', over ? 'border-violet-500 bg-violet-500/10' : 'border-border hover:border-violet-500/50 hover:bg-accent/40')}
      >
        <Upload className="h-4 w-4 text-muted-foreground" />
        <span className="text-[10.5px] font-medium">Drop files or click to upload</span>
        <span className="text-[9px] text-muted-foreground">PNG · JPG · SVG · GIF · MP4 · MP3</span>
        <input type="file" multiple accept="image/*,video/*,audio/*,.svg,.json" className="hidden" onChange={(e) => { if (e.target.files) onUpload(e.target.files); e.target.value = ''; }} />
      </label>
      {assets.length === 0 ? (
        <EmptyState icon={<ImageIcon className="h-4 w-4" />} title="No uploads yet" description="Assets live in your browser session. Drag them onto the canvas too." />
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {assets.map((a) => (
            <div key={a.id} className="group relative aspect-square overflow-hidden rounded-md border border-border/60">
              {a.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.src} alt={a.name} className="h-full w-full cursor-pointer object-cover" onClick={() => onInsert(a.id)} loading="lazy" />
              ) : (
                <button onClick={() => onInsert(a.id)} className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/40 text-muted-foreground">
                  {a.type === 'audio' ? <Music2 className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  <span className="px-1 text-center text-[8px] leading-tight">{a.name}</span>
                </button>
              )}
              <button onClick={() => onRemove(a.id)} className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100" aria-label={`Delete ${a.name}`}><Trash2 className="h-2.5 w-2.5" /></button>
              <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[7.5px] text-white/90">{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AudioLibrary({ onAdd }: { onAdd: (track: Track) => void }) {
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  React.useEffect(() => () => synth?.stop(), []);
  const play = (track: Track) => {
    if (!synth) return;
    if (playingId === track.id) { synth.stop(); setPlayingId(null); return; }
    if (track.kind === 'music') synth.playMusic(track, 10); else synth.playSfx(track);
    setPlayingId(track.id);
    setTimeout(() => setPlayingId(null), Math.min(10, track.duration) * 1000);
  };
  return (
    <div>
      <div className="mb-2 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-2 py-1.5 text-[9.5px] leading-relaxed text-emerald-300/90">
        <Volume2 className="mr-1 inline h-3 w-3" /> Procedurally synthesized in-browser — royalty-free by construction.
      </div>
      <p className="panel-title mb-1.5">Music</p>
      <div className="mb-3 space-y-1">
        {MUSIC.map((t) => (
          <div key={t.id} className="group flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-1.5 py-1">
            <button onClick={() => play(t)} className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 text-emerald-400" aria-label={playingId === t.id ? `Pause ${t.name}` : `Play ${t.name}`}>
              {playingId === t.id ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 translate-x-[0.5px]" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px]">{t.name}</p>
              <p className="truncate text-[8.5px] text-muted-foreground">{t.mood} · {t.bpm} BPM · {t.duration}s</p>
            </div>
            <Button size="xs" variant="ghost" onClick={() => onAdd(t)} className="opacity-0 group-hover:opacity-100" aria-label={`Add ${t.name} to timeline`}><Plus className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
      <p className="panel-title mb-1.5">SFX</p>
      <div className="space-y-1">
        {SFX.map((t) => (
          <div key={t.id} className="group flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-1.5 py-1">
            <button onClick={() => play(t)} className="flex h-5 w-5 items-center justify-center rounded bg-violet-500/15 text-violet-300" aria-label={`Preview ${t.name}`}><Play className="h-2.5 w-2.5" /></button>
            <div className="min-w-0 flex-1"><p className="truncate text-[10px]">{t.name}</p><p className="text-[8.5px] text-muted-foreground">{t.mood} · {t.duration}s</p></div>
            <Button size="xs" variant="ghost" onClick={() => onAdd(t)} className="opacity-0 group-hover:opacity-100" aria-label={`Add ${t.name}`}><Plus className="h-3 w-3" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Lottie({ onAdd }: { onAdd: (kind: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground">Motion primitives that expand into fully editable layers — not locked videos.</p>
      <div className="grid grid-cols-2 gap-1.5">
        {LOTTIE_STUBS.map((l) => (
          <button key={l.id} onClick={() => onAdd(String(l.meta?.kind))} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-md border border-border/60 bg-gradient-to-br from-violet-500/10 to-cyan-500/5 transition-colors hover:border-violet-500/40">
            <span className="relative flex h-8 w-8 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
              <span className="relative flex h-6 w-6 items-center justify-center rounded-full border border-violet-400/60"><Sparkles className="h-3 w-3 text-violet-300" /></span>
            </span>
            <span className="text-[9.5px] text-muted-foreground">{l.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Fonts({ onPick }: { onPick: (font: string) => void }) {
  const [q, setQ] = React.useState('');
  const filtered = FONTS.filter((f) => f.family.toLowerCase().includes(q.toLowerCase()) || f.category.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div className="relative mb-2">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search fonts" className="h-7 pl-7 text-[11px]" aria-label="Search fonts" />
      </div>
      <div className="space-y-1">
        {filtered.map((f) => (
          <button key={f.family} onClick={() => onPick(f.family)} className="flex w-full items-center justify-between rounded-md border border-border/50 bg-background/30 px-2 py-1.5 text-left transition-colors hover:border-violet-500/40 hover:bg-accent/50">
            <span className="truncate text-[14px]" style={{ fontFamily: `'${f.family}', Inter, sans-serif` }}>{f.family}</span>
            <span className="ml-2 shrink-0 text-[8.5px] uppercase tracking-wider text-muted-foreground">{f.category}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-[9px] leading-relaxed text-muted-foreground">
        <Type className="mt-0.5 h-3 w-3 shrink-0" /> 19 Google Fonts load on demand. Upload custom fonts via Settings → Brand.
      </div>
      <div className="mt-2 flex items-center gap-1 text-[9px] text-muted-foreground"><Star className="h-2.5 w-2.5" /> Pixel-perfect on canvas export</div>
      <Kbd className="mt-2 inline-flex">tip: double-click text on canvas to edit</Kbd>
    </div>
  );
}
