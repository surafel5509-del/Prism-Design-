import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getShare } from '@/lib/server/store';
import type { Project } from '@/lib/engine/types';
import { normalizeLayer } from '@/lib/engine/ops';
import { SharePlayer } from '@/components/share/SharePlayer';
import { PrismLogo } from '@/components/brand/PrismLogo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const share = await getShare(params.id);
  if (!share) return { title: 'Share not found — Prism' };
  return { title: `${share.name} — Prism`, description: 'A project shared from Prism Studio.', openGraph: { title: share.name, description: 'Made with Prism Studio' } };
}

export default async function SharePage({ params }: { params: { id: string } }) {
  const share = await getShare(params.id);
  if (!share || share.revoked) notFound();
  const raw = share.data as Partial<Project> & { layers?: unknown[] };
  const project: Project = {
    id: share.projectId,
    name: share.name,
    width: Number(raw.width) || 1080,
    height: Number(raw.height) || 1080,
    fps: Number(raw.fps) || 30,
    duration: Number(raw.duration) || 5,
    background: typeof raw.background === 'string' ? raw.background : '#0b0b12',
    backgroundGradient: raw.backgroundGradient ?? null,
    layers: (raw.layers ?? []).map((l) => normalizeLayer(l as never)),
    tags: [],
    createdAt: share.createdAt,
    updatedAt: share.updatedAt ?? share.createdAt,
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07070c] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(124,58,237,.28),transparent_60%),radial-gradient(60%_50%_at_100%_100%,rgba(6,182,212,.14),transparent_60%)]" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center gap-2 px-5 py-4">
        <Link href="/" className="flex items-center gap-2">
          <PrismLogo className="h-6 w-6" />
          <span className="prism-text text-[13px] font-semibold tracking-tight">Prism</span>
        </Link>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-widest text-white/50">Shared project</span>
        <Link href="/editor/new" className="ml-auto rounded-lg bg-[linear-gradient(110deg,#7c3aed,#0891b2_52%,#c026d3)] px-3 py-1.5 text-[11.5px] font-medium text-white shadow-[0_6px_24px_-8px_rgba(139,92,246,.9)]">
          Make your own
        </Link>
      </header>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-16">
        <SharePlayer project={project} shareId={share.id} name={share.name} author={share.ownerId ? 'Prism creator' : 'Prism'} allowComments={share.allowComments} initialComments={share.comments} />
      </div>

      <footer className="relative z-10 border-t border-white/[0.06] py-4 text-center text-[10px] text-white/35">
        Rendered live in your browser by Prism Studio — no images, real vector layers and keyframes.
      </footer>
    </main>
  );
}
