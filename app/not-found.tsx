import Link from 'next/link';
import { PrismLogo } from '@/components/brand/PrismLogo';

export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#07070c] px-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(124,58,237,.28),transparent_60%)]" />
      <div className="relative max-w-md text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <PrismLogo className="h-7 w-7" />
        </div>
        <p className="prism-text text-[11px] font-semibold uppercase tracking-[0.3em]">404</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-tight">This frame doesn&rsquo;t exist</h1>
        <p className="mt-2 text-[12px] leading-relaxed text-white/45">
          The project or share link may have been deleted, or the URL is off by a character. Your local projects are safe in the studio.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/dashboard" className="rounded-lg bg-[linear-gradient(110deg,#7c3aed,#0891b2_52%,#c026d3)] px-3 py-2 text-[12px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(139,92,246,.9)]">
            Open studio
          </Link>
          <Link href="/" className="rounded-lg border border-white/12 px-3 py-2 text-[12px] text-white/70 transition-colors hover:text-white">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
