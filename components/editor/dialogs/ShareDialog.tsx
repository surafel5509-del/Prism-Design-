'use client';
import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Globe2, Link2, Loader2, MessageSquare, RefreshCw, Share2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useEditor } from '@/lib/store/editor';

interface SharePayload { id: string; url: string; created?: boolean; updated?: boolean }

export function ShareDialog() {
  const open = useEditor((s) => s.shareOpen);
  const setOpen = useEditor((s) => s.setShareOpen);
  const project = useEditor((s) => s.project);
  const [name, setName] = useState(project.name);
  const [allowComments, setAllowComments] = useState(true);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [comments, setComments] = useState<{ id: string; author: string; text: string; at: number }[]>([]);

  useEffect(() => { if (open) setName(project.name); }, [open, project.name]);

  useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(`prism:share:${project.id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { id: string; name?: string; allowComments?: boolean };
        setLink(`${window.location.origin}/s/${parsed.id}`);
        void loadComments(parsed.id);
      }
    } catch { /* noop */ }
  }, [open, project.id]);

  const loadComments = async (id: string) => {
    try {
      const res = await fetch(`/api/share/${id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setComments(json.share?.comments ?? []);
    } catch { /* offline */ }
  };

  const create = async () => {
    setBusy(true);
    try {
      const existing = link ? link.split('/s/')[1] : undefined;
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, name, data: project, allowComments, existingId: existing }),
      });
      const json = (await res.json()) as SharePayload & { error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Could not create link');
      const url = `${window.location.origin}${json.url}`;
      setLink(url);
      localStorage.setItem(`prism:share:${project.id}`, JSON.stringify({ id: json.id, name, allowComments }));
      toast.success(json.updated ? 'Share link updated' : 'Share link created');
      void loadComments(json.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create link');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); toast.success('Link copied'); }
    catch { toast.error('Could not copy — select the link manually'); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Share project</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-500/25 to-violet-500/15 ring-1 ring-fuchsia-400/25">
            <Share2 className="h-3.5 w-3.5 text-fuchsia-200" />
          </span>
          <div>
            <p className="text-[12.5px] font-semibold tracking-tight">Share</p>
            <p className="text-[9.5px] text-muted-foreground">Anyone with the link can view this project in the Prism player.</p>
          </div>
        </div>

        <div className="space-y-3 p-3.5">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/80">Title</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-8 text-[12px]" maxLength={120} />
          </div>

          <button onClick={() => setAllowComments(!allowComments)} className="flex w-full items-center gap-2 rounded-lg border border-border/70 bg-white/[0.02] px-2.5 py-2 text-left">
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-foreground/85">Allow comments</p>
              <p className="text-[9.5px] text-muted-foreground">Reviewers can leave timestamped notes on the shared link.</p>
            </div>
            <span className={`relative h-4 w-7 rounded-full transition-colors ${allowComments ? 'bg-violet-500' : 'bg-white/15'}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${allowComments ? 'left-3.5' : 'left-0.5'}`} />
            </span>
          </button>

          {link ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-violet-400/25 bg-violet-500/[0.07] px-2 py-1.5">
                <Globe2 className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                <input readOnly value={link} className="min-w-0 flex-1 bg-transparent font-mono text-[10px] text-violet-100 outline-none" onFocus={(e) => e.currentTarget.select()} />
                <Button size="icon-sm" variant="ghost" onClick={copy} aria-label="Copy link"><Copy className="h-3 w-3" /></Button>
                <a href={link} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-md text-violet-200 transition-colors hover:bg-white/10" aria-label="Open link"><ExternalLink className="h-3 w-3" /></a>
              </div>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" className="flex-1" onClick={copy}><Copy className="h-3.5 w-3.5" /> Copy link</Button>
                <Button variant="outline" size="sm" onClick={create} disabled={busy}>
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Update snapshot
                </Button>
              </div>

              <div className="rounded-lg border border-border/70 bg-black/20">
                <div className="flex items-center gap-1.5 border-b border-border/60 px-2 py-1.5">
                  <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-foreground/80">Comments</span>
                  <Badge variant="secondary" className="ml-auto h-4">{comments.length}</Badge>
                </div>
                <div className="max-h-40 overflow-y-auto p-2">
                  {comments.length === 0 ? (
                    <p className="py-2 text-center text-[10px] text-muted-foreground">No comments yet. Share the link to collect notes.</p>
                  ) : comments.slice(-8).map((c) => (
                    <div key={c.id} className="mb-1.5 rounded-md bg-white/[0.03] px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9.5px] font-medium text-foreground/80">{c.author}</span>
                        <span className="ml-auto text-[8.5px] text-muted-foreground">{new Date(c.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{c.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/80 bg-white/[0.02] p-4 text-center">
              <Link2 className="mx-auto h-5 w-5 text-muted-foreground/60" />
              <p className="mt-1.5 text-[11px] font-medium text-foreground/80">Create a live share link</p>
              <p className="mx-auto mt-0.5 max-w-[260px] text-[9.5px] leading-relaxed text-muted-foreground">Snapshots the current document. Re-share anytime to update it — the link stays the same.</p>
              <Button variant="prism" size="sm" className="mt-2" onClick={create} disabled={busy}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Create link
              </Button>
            </div>
          )}

          <div className="flex items-start gap-1.5 rounded-md bg-white/[0.02] px-2 py-1.5 text-[9px] leading-relaxed text-muted-foreground">
            <Shield className="mt-0.5 h-2.5 w-2.5 shrink-0 text-emerald-400/70" />
            Shared links only expose this project snapshot. API keys and account settings are never included.
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/70 bg-panel/50 px-3.5 py-2">
          <span className="flex items-center gap-1 text-[9.5px] text-muted-foreground"><Check className="h-2.5 w-2.5 text-emerald-400" /> Autosaved locally</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
