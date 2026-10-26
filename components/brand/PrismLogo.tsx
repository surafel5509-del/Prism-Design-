import { cn } from '@/lib/utils';

export function PrismLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id="prism-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" /><stop offset=".5" stopColor="#22d3ee" /><stop offset="1" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="currentColor" className="text-violet-500/10" />
      <path d="M32 8 L54 48 H10 Z" fill="url(#prism-g)" />
      <path d="M32 24 L43 43 H21 Z" fill="currentColor" className="text-background" opacity=".85" />
      <path d="M32 8 L54 48" stroke="white" strokeOpacity=".35" strokeWidth="1.2" />
    </svg>
  );
}
