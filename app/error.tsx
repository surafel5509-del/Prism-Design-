'use client';
import { useEffect } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[prism] route error', error); }, [error]);
  return (
    <main className="grid min-h-[60vh] place-items-center px-6">
      <div className="max-w-md rounded-2xl border border-rose-400/25 bg-rose-500/[0.05] p-5 text-center">
        <TriangleAlert className="mx-auto h-6 w-6 text-rose-300" />
        <h1 className="mt-2 text-[16px] font-semibold tracking-tight">Something broke in this view</h1>
        <p className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground">{error.message || 'An unexpected error occurred.'}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/60">Your project is autosaved locally — nothing was lost.</p>
        <button onClick={reset} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] transition-colors hover:bg-white/[0.05]">
          <RotateCcw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    </main>
  );
}
