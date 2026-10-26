import { cn } from '@/lib/utils';

export function PrismMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={cn('shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id="prism-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" /><stop offset=".55" stopColor="#22d3ee" /><stop offset="1" stopColor="#e879f9" />
        </linearGradient>
      </defs>
      <path d="M60 10 L110 100 H10 Z" fill="url(#prism-mark-g)" />
      <path d="M60 42 L82 82 H38 Z" fill="currentColor" opacity=".35" />
      <circle cx="60" cy="70" r="6" fill="currentColor" />
    </svg>
  );
}
