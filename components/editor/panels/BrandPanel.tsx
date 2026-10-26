'use client';
import * as React from 'react';
import { useEditor } from '@/lib/store/editor';
import { DEFAULT_BRAND_KIT, PALETTES, createLayer } from '@/lib/engine/factory';
import type { BrandKit } from '@/lib/engine/types';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { EmptyState, Kbd } from '@/components/ui/misc';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FONTS } from '@/lib/data/library';
import { cn, fileToDataUrl, hexToHsl, hslToHex, readableOn, uid } from '@/lib/utils';
import { Plus, Trash2, Wand2, Palette, Type, Mic, Upload, Check, Shuffle, Save, Sparkles, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

export function BrandPanel() {
  const brandKits = useEditor((s) => s.brandKits);
  const activeId = useEditor((s) => s.activeBrandKitId);
  const saveBrandKit = useEditor((s) => s.saveBrandKit);
  const deleteBrandKit = useEditor((s) => s.deleteBrandKit);
  const applyBrandKit = useEditor((s) => s.applyBrandKit);
  const patchProject = useEditor((s) => s.patchProject);
  const addLayer = useEditor((s) => s.addLayer);
  const project = useEditor((s) => s.project);

  const kit = brandKits.find((k) => k.id === activeId) ?? brandKits[0] ?? DEFAULT_BRAND_KIT;
  const [draft, setDraft] = React.useState<BrandKit>(kit);
  React.useEffect(() => setDraft(kit), [kit.id, kit.updatedAt]);

  const update = (patch: Partial<BrandKit>) => setDraft((d) => ({ ...d, ...patch }));
  const commit = () => { saveBrandKit({ ...draft, updatedAt: Date.now() }); toast.success('Brand kit saved'); };

  const addColor = () => update({ colors: [...draft.colors, '#8b5cf6'] });
  const generatePalette = () => {
    const base = draft.colors[0] ?? '#8b5cf6';
    const [h, s, l] = hexToHsl(base);
    const colors = [base, hslToHex((h + 42) % 360, Math.min(100, s + 8), l), hslToHex((h + 186) % 360, Math.min(96, s + 4), Math.max(28, l - 6)), hslToHex(h, Math.min(40, s * 0.5), 8), hslToHex(h, 30, 97)];
    update({ colors });
    toast.success('Harmonious palette generated');
  };

  const applyPaletteToCanvas = () => {
    patchProject({ background: draft.colors[3] ?? '#0b0b12', backgroundGradient: null });
    project.layers.filter((l) => l.type === 'text').forEach((l, i) => {
      useEditor.getState().updateLayer(l.id, { text: { ...l.text!, fontFamily: i === 0 ? draft.fonts.heading : draft.fonts.body, color: draft.colors[4] ?? '#ffffff' } });
    });
    toast.success('Brand applied to canvas');
  };

  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border/60 px-2 py-2">
        <Select value={kit.id} onChange={(e) => useEditor.setState({ activeBrandKitId: e.target.value })} containerClassName="flex-1">
          {brandKits.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </Select>
        <Button variant="ghost" size="icon-sm" onClick={() => setCreating(!creating)} aria-label="New brand kit"><Plus className="h-3.5 w-3.5" /></Button>
        {brandKits.length > 1 && <Button variant="ghost" size="icon-sm" onClick={() => { deleteBrandKit(kit.id); toast.success('Brand kit removed'); }} aria-label="Delete brand kit"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>}
      </div>
      {creating && (
        <div className="flex gap-1 border-b border-border/60 p-2">
          <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Brand name" className="h-7 text-[11px]" />
          <Button size="sm" onClick={() => { if (!newName.trim()) return; const k: BrandKit = { ...DEFAULT_BRAND_KIT, id: uid('bk'), name: newName.trim(), updatedAt: Date.now() }; saveBrandKit(k); useEditor.setState({ activeBrandKitId: k.id }); setNewName(''); setCreating(false); toast.success('Brand kit created'); }}>Add</Button>
        </div>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto p-2.5">
        <section>
          <div className="mb-1.5 flex items-center justify-between"><Label className="flex items-center gap-1"><Palette className="h-3 w-3" /> Palette</Label>
            <div className="flex gap-1">
              <Button variant="ghost" size="xs" onClick={generatePalette}><Shuffle className="h-2.5 w-2.5" /> Harmonise</Button>
              <Button variant="ghost" size="xs" onClick={addColor}><Plus className="h-2.5 w-2.5" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {draft.colors.map((c, i) => (
              <Popover key={i}>
                <PopoverTrigger asChild>
                  <button className="relative aspect-square rounded-md border border-white/15 transition-transform hover:scale-105" style={{ background: c }} aria-label={`Color ${i + 1} ${c}`}>
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/40 text-center font-mono text-[6.5px] text-white/80">{c.replace('#', '')}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-2">
                  <p className="panel-title mb-1.5">Colour {i + 1}</p>
                  <input type="color" value={c} onChange={(e) => { const next = draft.colors.slice(); next[i] = e.target.value; update({ colors: next }); }} className="h-8 w-full cursor-pointer rounded border border-border bg-transparent" aria-label="Pick colour" />
                  <Input value={c} onChange={(e) => { const next = draft.colors.slice(); next[i] = e.target.value; update({ colors: next }); }} className="mt-1.5 h-7 font-mono text-[10px]" />
                  {draft.colors.length > 2 && <Button variant="ghost" size="sm" className="mt-1.5 w-full text-red-400" onClick={() => update({ colors: draft.colors.filter((_, j) => j !== i) })}><Trash2 className="h-3 w-3" /> Remove</Button>}
                </PopoverContent>
              </Popover>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1">
            {PALETTES.slice(0, 5).map((p) => (
              <button key={p.name} onClick={() => update({ colors: p.colors })} className="flex gap-0.5 rounded border border-border/50 p-0.5 hover:border-violet-500/50" title={p.name}>
                {p.colors.slice(0, 5).map((c) => <span key={c} className="h-2 w-2 rounded-[2px]" style={{ background: c }} />)}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-1.5">
          <Label className="flex items-center gap-1"><Type className="h-3 w-3" /> Typography</Label>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <p className="mb-0.5 text-[8.5px] uppercase tracking-wider text-muted-foreground">Heading</p>
              <Select value={draft.fonts.heading} onChange={(e) => update({ fonts: { ...draft.fonts, heading: e.target.value } })}>
                {FONTS.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
              </Select>
            </div>
            <div>
              <p className="mb-0.5 text-[8.5px] uppercase tracking-wider text-muted-foreground">Body</p>
              <Select value={draft.fonts.body} onChange={(e) => update({ fonts: { ...draft.fonts, body: e.target.value } })}>
                {FONTS.map((f) => <option key={f.family} value={f.family}>{f.family}</option>)}
              </Select>
            </div>
          </div>
        </section>

        <section>
          <Label className="mb-1 flex items-center gap-1"><Mic className="h-3 w-3" /> Brand voice</Label>
          <Textarea value={draft.voice ?? ''} onChange={(e) => update({ voice: e.target.value })} rows={3} className="text-[10.5px] leading-relaxed" placeholder="Confident, modern, no jargon…" />
          <p className="mt-1 text-[8.5px] text-muted-foreground">Used by the AI agent for copywriting.</p>
        </section>

        <section>
          <Label className="mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Visual style</Label>
          <Textarea value={draft.style ?? ''} onChange={(e) => update({ style: e.target.value })} rows={2} className="text-[10.5px] leading-relaxed" placeholder="Editorial gradients, soft glow…" />
        </section>

        <section>
          <Label className="mb-1 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Logo</Label>
          {draft.logo ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.logo} alt="Brand logo" className="h-10 w-10 rounded object-contain" />
              <div className="flex-1">
                <Button variant="outline" size="xs" onClick={() => addLayer(createLayer({ type: 'image', name: `${draft.name} logo`, x: project.width * 0.05, y: project.height * 0.05, w: 180, h: 180, fill: 'transparent', media: { src: draft.logo!, fit: 'contain' }, endTime: project.duration }))}>Insert logo</Button>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => update({ logo: null })} aria-label="Remove logo"><Trash2 className="h-3 w-3" /></Button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-3 text-[10px] text-muted-foreground hover:border-violet-500/50">
              <Upload className="h-3 w-3" /> Upload logo (SVG / PNG)
              <input type="file" accept="image/*,.svg" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; update({ logo: await fileToDataUrl(f) }); toast.success('Logo added to kit'); }} />
            </label>
          )}
        </section>

        <div className="rounded-lg border border-border/60 bg-background/30 p-2">
          <p className="mb-1 text-[9px] uppercase tracking-wider text-muted-foreground">Preview</p>
          <div className="rounded-md p-2.5" style={{ background: draft.colors[3], border: `1px solid ${draft.colors[0]}` }}>
            <p style={{ fontFamily: `'${draft.fonts.heading}', sans-serif`, color: draft.colors[4], fontSize: 17, fontWeight: 700, letterSpacing: -0.4 }}>{draft.name}</p>
            <p style={{ fontFamily: `'${draft.fonts.body}', sans-serif`, color: draft.colors[4], opacity: 0.7, fontSize: 9 }}>Design that moves.</p>
            <div className="mt-1.5 flex gap-1">
              {draft.colors.slice(0, 4).map((c, i) => <span key={i} className="h-2.5 flex-1 rounded-[2px]" style={{ background: c }} />)}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 border-t border-border/60 p-2">
        <Button variant="outline" size="sm" onClick={applyPaletteToCanvas} className="gap-1"><Wand2 className="h-3 w-3" /> Apply</Button>
        <Button variant="default" size="sm" onClick={commit} className="gap-1"><Save className="h-3 w-3" /> Save kit</Button>
        <Button variant="ghost" size="sm" onClick={() => applyBrandKit(kit.id)} className="col-span-2 gap-1 text-[10px]"><Check className="h-3 w-3" /> Re-link fonts on existing text layers</Button>
      </div>
    </div>
  );
}
